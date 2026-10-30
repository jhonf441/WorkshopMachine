<template>
	<div class="level-bed" @keydown="onKey">
		<v-alert v-if="!model.bed" density="compact" variant="outlined" type="info" class="mb-0">
			<div>{{ t('bed.no_bed') }}</div>
			<div v-for="m in model.missing" :key="m" class="text-body-small">{{ t('bed.missing_' + m) }}</div>
		</v-alert>
		<template v-else>
			<point-mode-bar
				v-if="screws.length && editable" :count="points.length" :can-undo="canUndo(lp)" :can-redo="canRedo(lp)" :can-reset="lp.edited" :notice="notice"
				@undo="undo" @redo="redo" @reset="reset" @add="addTyped"
			/>
			<div v-if="screws.length && editable" class="text-body-small machine-faint mb-2">{{ t('bed.level_help') }}</div>
			<v-alert v-for="m in model.missing" :key="m" density="compact" text type="info" class="mb-2 text-body-small">{{ t('bed.missing_' + m) }}</v-alert>
			<v-alert v-if="lp.edited" density="compact" text type="info" class="mb-2 text-body-small">{{ t('bed.level_preview_note') }}</v-alert>
			<v-alert v-if="screws.length && !validation.ok" density="compact" variant="outlined" type="warning" class="mb-2">
				<div v-for="i in validation.issues" :key="i.code">{{ t(i.key, i.params) }}</div>
			</v-alert>
			<v-row density="compact">
				<v-col cols="12" md="8">
					<bed-svg :bed="model.bed" :include="screws" :reach="model.reach" :label="t('bed.level_label')" @pointer="onPointer">
						<template #default="{ frame }">
							<bed-screws :frame="frame" :screws="screws" :corrections="corrections" :links="links" />
							<bed-points :frame="frame" :points="points" :selected="selected" :draggable="editable" :show-path="true" @select="onSelect" @nudge="nudgePoint" />
						</template>
					</bed-svg>
					<bed-legend class="mt-2" :ids="['measure', 'clipped', 'outside_reach']" :counts="counts" />
				</v-col>
				<v-col cols="12" md="4">
					<point-detail :point="point" :title="title" :rows="rows" @close="selected = ''">
						<v-btn v-if="editable && point" size="small" variant="outlined" color="error" class="mt-2" style="min-height:44px" @click="remove()"><v-icon size="small" start>mdi-delete-outline</v-icon>{{ t('bed.remove_point') }}</v-btn>
						<template #actions="slotProps"><slot name="actions" v-bind="slotProps" /></template>
					</point-detail>
					<point-sets
						v-if="sets && screws.length" class="mt-3" :view="sets" :editable="editable" :can-save="points.length > 0" :max="max"
						@load="loadSet" @save="$emit('save-set', { name: $event, points: points.map(p => ({ x: p.x, y: p.y })) })" @remove="$emit('delete-set', $event)"
					/>
					<div v-if="corrections.length" class="mt-3">
						<div class="text-title-small">{{ t('bed.corr_title') }}</div>
						<div class="text-body-small machine-faint">{{ t(corrections[0].source === 'service' ? 'bed.corr_service' : 'bed.corr_estimate') }}</div>
						<div v-for="c in corrections" :key="c.motor" class="text-body-medium d-flex align-center">
							<v-icon size="small" class="mr-1">{{ c.direction === 'raise' ? 'mdi-arrow-up-bold' : c.direction === 'lower' ? 'mdi-arrow-down-bold' : 'mdi-minus' }}</v-icon>
							Z{{ c.motor }}: {{ c.direction === 'none' ? t('bed.corr_none') : t('bed.corr_' + c.direction, { mm: Math.abs(c.mm).toFixed(3) }) }}
						</div>
					</div>
				</v-col>
			</v-row>
			<level-pass-strip v-if="hasPasses" class="mt-3" :result="result" />
		</template>
	</div>
</template>

<script setup>
// The bed for levelling: the Z motors where M671 puts them, the measurement points (suggested over each leadscrew, then yours: tap an empty
// spot to add, drag or use the arrows to move, Delete to remove, undo / redo, named sets: the same controls as the Mesh Points mode), the order, the leadscrew each point is nearest to, the correction per leadscrew after a pass
// and the pass history. A point set that cannot work is said so, with the reason. Geometry: lib/bed-level-plan.js.

import { computed, reactive, ref } from 'vue'
import BedSvg from './BedSvg.vue'
import BedPoints from './BedPoints.vue'
import BedScrews from './BedScrews.vue'
import BedLegend from './BedLegend.vue'
import PointDetail from './PointDetail.vue'
import PointModeBar from './PointModeBar.vue'
import PointSets from './PointSets.vue'
import LevelPassStrip from './LevelPassStrip.vue'
import { t } from '../text.js'
import { validatePoints, serviceIssues, correctionsOf, nearestScrew } from '../lib/bed-level-plan.js'
import { countsOf, inside } from '../lib/bed-mesh-plan.js'
import { pointsForBed } from '../lib/point-sets.js'
import { pointsOf, movePoint, removePoint, resetPoints, MAX_POINTS } from '../state/level-points-state.js'
import * as edit from '../state/point-edit-state.js'
import { canUndo, canRedo } from '../state/point-edit-state.js'
import { createDrag, begin, update, finish, cancel, isTap } from '../state/region-drag.js'
import { normalizePasses, normalizeHeights } from '../api/machine-api-p6.js'

const props = defineProps({
	model: { type: Object, required: true }, // state/bed-state.js modelOf(...)
	lp: { type: Object, required: true }, // state/level-points-state.js createLevelPoints()
	serviceLevel: { type: Object, default: null }, // layout.level of the answer to THIS draft {points, errors, descent, ...}
	lastLevel: { type: Object, default: null }, // layout.lastLevel {deviation, mean, points: [{x, y, dz}], ...}
	result: { type: Object, default: null }, // result of the run in this page
	editable: { type: Boolean, default: false },
	sets: { type: Object, default: null } // the point sets card {available, reason, sets, canWrite, busy, notice, error}; null = not offered
})
defineEmits(['save-set', 'delete-set'])

const selected = ref('')
const notice = ref('')
const drag = reactive(createDrag())
const max = MAX_POINTS

const screws = computed(() => props.model.screws)
const points = computed(() => pointsOf(props.lp, screws.value, props.model.reach, props.serviceLevel))
// the service verdict wins; without it the local check says what it can
const validation = computed(() => (props.serviceLevel ? serviceIssues(props.serviceLevel, points.value.length) : validatePoints(points.value, screws.value)))
const counts = computed(() => countsOf(points.value))
const links = computed(() => points.value.filter(p => p.screw !== null && p.screw !== undefined).map(p => ({ id: p.id, from: p, to: screws.value.find(s => s.index === p.screw) })).filter(l => l.to))
const passes = computed(() => (props.result && Array.isArray(props.result.passes) ? normalizePasses(props.result) : []))
const hasPasses = computed(() => passes.value.length > 0)
const corrections = computed(() => {
	const heights = props.result && props.result.points ? normalizeHeights(props.result) : props.lastLevel ? props.lastLevel.points : []
	return correctionsOf(screws.value, passes.value.length ? passes.value[passes.value.length - 1] : null, heights)
})
const point = computed(() => points.value.find(p => p.id === selected.value) || null)
const title = computed(() => (point.value && point.value.order > 0 ? t('bed.point_step_of', { n: point.value.order, total: points.value.filter(p => p.order > 0).length }) : t('bed.point_plain')))
const rows = computed(() => {
	const p = point.value
	if (!p) return []
	const out = [{ label: 'X / Y', value: p.x.toFixed(1) + ' / ' + p.y.toFixed(1) }]
	const o = props.model.offset
	if (o) out.push({ label: t('bed.head_at'), value: (p.x - o.x).toFixed(1) + ' / ' + (p.y - o.y).toFixed(1) })
	const s = screws.value.length ? nearestScrew(p, screws.value) : null
	if (s) out.push({ label: t('bed.nearest_screw'), value: 'Z' + s.index + ' (' + Math.hypot(s.x - p.x, s.y - p.y).toFixed(0) + ' mm)' })
	return out
})

function say(key, params) {
	notice.value = key ? t(key, params) : ''
}
function onSelect(id) {
	selected.value = selected.value === id ? '' : id
}
function area() {
	return props.model.reach || props.model.bed
}
function clampTo(x, y) {
	const a = area()
	return { x: Math.min(a.xmax, Math.max(a.xmin, x)), y: Math.min(a.ymax, Math.max(a.ymin, y)) }
}
function onPointer(ev) {
	const px = { x: ev.px, y: ev.py }
	if (ev.type === 'cancel') {
		cancel(drag)
		edit.endMove(props.lp)
	} else if (ev.type === 'down') begin(drag, ev, px, null, false)
	else if (ev.type === 'move') {
		const r = props.editable ? update(drag, ev, px, props.model.bed, 0) : null
		if (r && r.point) {
			const c = clampTo(r.point.x, r.point.y)
			movePoint(props.lp, points.value, r.point.id, c.x, c.y)
		}
	} else pointerUp(ev, px)
}
function pointerUp(ev, px) {
	const hit = drag.hit
	const tap = isTap(drag, px)
	edit.endMove(props.lp)
	finish(drag)
	if (hit.indexOf('p:') === 0 && tap) onSelect(hit.slice(2))
	else if (hit === '' && tap && props.editable) addAt(ev.wx, ev.wy)
}
function addAt(x, y) {
	const a = area()
	if (!inside(a, x, y)) return say('bed.note_outside_reach')
	if (edit.addPoint(props.lp, points.value, x, y, MAX_POINTS)) return say('')
	say(points.value.length >= MAX_POINTS ? 'bed.note_limit' : 'bed.note_duplicate', { n: MAX_POINTS })
}
function addTyped(p) {
	addAt(p.x, p.y)
}
// arrows on a focused point move it 1 mm (Shift: 10 mm), kept inside the reach
function nudgePoint(ev) {
	const p = points.value.find(q => q.id === ev.id)
	const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[ev.key]
	if (!p || !d || !props.editable) return
	const k = ev.shift ? 10 : 1
	const c = clampTo(p.x + d[0] * k, p.y + d[1] * k)
	movePoint(props.lp, points.value, ev.id, c.x, c.y)
	edit.endMove(props.lp)
}
function remove() {
	removePoint(props.lp, points.value, selected.value)
	selected.value = ''
}
function undo() {
	edit.undo(props.lp)
	selected.value = ''
	say('')
}
function redo() {
	edit.redo(props.lp)
	selected.value = ''
	say('')
}
function reset() {
	resetPoints(props.lp)
	selected.value = ''
	say('')
}
function loadSet(id) {
	const set = props.sets.sets.find(q => q.id === id)
	if (!set) return
	const r = pointsForBed(set, props.model.bed)
	edit.setPoints(props.lp, points.value, r.points, MAX_POINTS)
	selected.value = ''
	say(r.dropped ? 'bed.note_set_dropped' : '', { n: r.dropped })
}
// keyboard on the whole bed area: Delete removes the selected point, Ctrl+Z undoes, Ctrl+Y / Ctrl+Shift+Z redoes
function onKey(ev) {
	if (['INPUT', 'TEXTAREA', 'SELECT'].indexOf(ev.target && ev.target.tagName) >= 0 || !props.editable) return
	const ctrl = ev.ctrlKey || ev.metaKey
	if ((ev.key === 'Delete' || ev.key === 'Backspace') && selected.value) remove()
	else if (ctrl && (ev.key === 'z' || ev.key === 'Z')) ev.shiftKey ? redo() : undo()
	else if (ctrl && (ev.key === 'y' || ev.key === 'Y')) redo()
	else return
	ev.preventDefault()
}
</script>
