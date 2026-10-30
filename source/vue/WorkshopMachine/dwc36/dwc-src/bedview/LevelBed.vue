<template>
	<div class="level-bed" @keydown="onKey">
		<v-alert v-if="!model.bed" dense outlined type="info" class="mb-0">
			<div>{{ t('bed.no_bed') }}</div>
			<div v-for="m in model.missing" :key="m" class="text-caption">{{ t('bed.missing_' + m) }}</div>
		</v-alert>
		<template v-else>
			<point-mode-bar
				v-if="screws.length && editable" :count="points.length" :can-undo="canUndo(lp)" :can-redo="canRedo(lp)" :can-reset="lp.edited" :notice="notice"
				@undo="undo" @redo="redo" @reset="reset" @add="addTyped"
			/>
			<div v-if="screws.length && editable" class="text-caption machine-faint mb-2">{{ t('bed.level_help') }}</div>
			<v-alert v-for="m in model.missing" :key="m" dense outlined type="info" class="mb-2 text-caption">{{ t('bed.missing_' + m) }}</v-alert>
			<v-alert v-if="lp.edited" dense outlined type="info" class="mb-2 text-caption">{{ t('bed.level_preview_note') }}</v-alert>
			<v-alert v-if="screws.length && !validation.ok" dense outlined type="warning" class="mb-2">
				<div v-for="i in validation.issues" :key="i.code">{{ t(i.key, i.params) }}</div>
			</v-alert>
			<v-row dense>
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
						<v-btn v-if="editable && point" small outlined color="error" class="mt-2" style="min-height:44px" @click="remove()"><v-icon small left>mdi-delete-outline</v-icon>{{ t('bed.remove_point') }}</v-btn>
						<template #actions="slotProps"><slot name="actions" v-bind="slotProps" /></template>
					</point-detail>
					<point-sets
						v-if="sets && screws.length" class="mt-3" :view="sets" :editable="editable" :can-save="points.length > 0" :max="max"
						@load="loadSet" @save="$emit('save-set', { name: $event, points: points.map(p => ({ x: p.x, y: p.y })) })" @remove="$emit('delete-set', $event)"
					/>
					<div v-if="corrections.length" class="mt-3">
						<div class="text-subtitle-2">{{ t('bed.corr_title') }}</div>
						<div class="text-caption machine-faint">{{ t(corrections[0].source === 'service' ? 'bed.corr_service' : 'bed.corr_estimate') }}</div>
						<div v-for="c in corrections" :key="c.motor" class="text-body-2 d-flex align-center">
							<v-icon small class="mr-1">{{ c.direction === 'raise' ? 'mdi-arrow-up-bold' : c.direction === 'lower' ? 'mdi-arrow-down-bold' : 'mdi-minus' }}</v-icon>
							Z{{ c.motor }}: {{ c.direction === 'none' ? t('bed.corr_none') : t('bed.corr_' + c.direction, { mm: Math.abs(c.mm).toFixed(3) }) }}
						</div>
					</div>
				</v-col>
			</v-row>
			<level-pass-strip v-if="hasPasses" class="mt-3" :result="result" />
		</template>
	</div>
</template>

<script>
'use strict'

// The bed for levelling: the Z motors where M671 puts them, the measurement points (suggested over each leadscrew, then yours: tap an empty
// spot to add, drag or use the arrows to move, Delete to remove, undo / redo, named sets: the same controls as the Mesh Points mode), the order, the leadscrew each point is nearest to, the correction per leadscrew after a pass
// and the pass history. A point set that cannot work is said so, with the reason. Geometry: lib/bed-level-plan.js.

import BedSvg from './BedSvg.vue'
import BedPoints from './BedPoints.vue'
import BedScrews from './BedScrews.vue'
import BedLegend from './BedLegend.vue'
import PointDetail from './PointDetail.vue'
import PointModeBar from './PointModeBar.vue'
import PointSets from './PointSets.vue'
import LevelPassStrip from './LevelPassStrip.vue'
import { textMixin } from '../modules/text-mixin.js'
import { validatePoints, serviceIssues, correctionsOf, nearestScrew } from '../lib/bed-level-plan.js'
import { countsOf, inside } from '../lib/bed-mesh-plan.js'
import { pointsForBed } from '../lib/point-sets.js'
import { pointsOf, movePoint, removePoint, resetPoints, MAX_POINTS } from '../state/level-points-state.js'
import * as edit from '../state/point-edit-state.js'
import { canUndo, canRedo } from '../state/point-edit-state.js'
import { createDrag, begin, update, finish, cancel, isTap } from '../state/region-drag.js'
import { normalizePasses, normalizeHeights } from '../api/machine-api-p6.js'

export default {
	components: { BedSvg, BedPoints, BedScrews, BedLegend, PointDetail, PointModeBar, PointSets, LevelPassStrip },
	mixins: [textMixin],
	props: {
		model: { type: Object, required: true }, // state/bed-state.js modelOf(...)
		lp: { type: Object, required: true }, // state/level-points-state.js createLevelPoints()
		serviceLevel: { type: Object, default: null }, // layout.level of the answer to THIS draft {points, errors, descent, ...}
		lastLevel: { type: Object, default: null }, // layout.lastLevel {deviation, mean, points: [{x, y, dz}], ...}
		result: { type: Object, default: null }, // result of the run in this page
		editable: { type: Boolean, default: false },
		sets: { type: Object, default: null } // the point sets card {available, reason, sets, canWrite, busy, notice, error}; null = not offered
	},
	data() {
		return { selected: '', notice: '', drag: createDrag(), max: MAX_POINTS }
	},
	computed: {
		screws() {
			return this.model.screws
		},
		points() {
			return pointsOf(this.lp, this.screws, this.model.reach, this.serviceLevel)
		},
		// the service verdict wins; without it the local check says what it can
		validation() {
			return this.serviceLevel ? serviceIssues(this.serviceLevel, this.points.length) : validatePoints(this.points, this.screws)
		},
		counts() {
			return countsOf(this.points)
		},
		links() {
			return this.points.filter(p => p.screw !== null && p.screw !== undefined).map(p => ({ id: p.id, from: p, to: this.screws.find(s => s.index === p.screw) })).filter(l => l.to)
		},
		passes() {
			return this.result && Array.isArray(this.result.passes) ? normalizePasses(this.result) : []
		},
		hasPasses() {
			return this.passes.length > 0
		},
		corrections() {
			const heights = this.result && this.result.points ? normalizeHeights(this.result) : this.lastLevel ? this.lastLevel.points : []
			return correctionsOf(this.screws, this.passes.length ? this.passes[this.passes.length - 1] : null, heights)
		},
		point() {
			return this.points.find(p => p.id === this.selected) || null
		},
		title() {
			return this.point && this.point.order > 0 ? this.t('bed.point_step_of', { n: this.point.order, total: this.points.filter(p => p.order > 0).length }) : this.t('bed.point_plain')
		},
		rows() {
			const p = this.point
			if (!p) return []
			const rows = [{ label: 'X / Y', value: p.x.toFixed(1) + ' / ' + p.y.toFixed(1) }]
			const o = this.model.offset
			if (o) rows.push({ label: this.t('bed.head_at'), value: (p.x - o.x).toFixed(1) + ' / ' + (p.y - o.y).toFixed(1) })
			const s = this.screws.length ? nearestScrew(p, this.screws) : null
			if (s) rows.push({ label: this.t('bed.nearest_screw'), value: 'Z' + s.index + ' (' + Math.hypot(s.x - p.x, s.y - p.y).toFixed(0) + ' mm)' })
			return rows
		}
	},
	methods: {
		canUndo,
		canRedo,
		say(key, params) {
			this.notice = key ? this.t(key, params) : ''
		},
		onSelect(id) {
			this.selected = this.selected === id ? '' : id
		},
		area() {
			return this.model.reach || this.model.bed
		},
		clampTo(x, y) {
			const a = this.area()
			return { x: Math.min(a.xmax, Math.max(a.xmin, x)), y: Math.min(a.ymax, Math.max(a.ymin, y)) }
		},
		onPointer(ev) {
			const px = { x: ev.px, y: ev.py }
			if (ev.type === 'cancel') {
				cancel(this.drag)
				edit.endMove(this.lp)
			} else if (ev.type === 'down') begin(this.drag, ev, px, null, false)
			else if (ev.type === 'move') {
				const r = this.editable ? update(this.drag, ev, px, this.model.bed, 0) : null
				if (r && r.point) {
					const c = this.clampTo(r.point.x, r.point.y)
					movePoint(this.lp, this.points, r.point.id, c.x, c.y)
				}
			} else this.pointerUp(ev, px)
		},
		pointerUp(ev, px) {
			const hit = this.drag.hit
			const tap = isTap(this.drag, px)
			edit.endMove(this.lp)
			finish(this.drag)
			if (hit.indexOf('p:') === 0 && tap) this.onSelect(hit.slice(2))
			else if (hit === '' && tap && this.editable) this.addAt(ev.wx, ev.wy)
		},
		addAt(x, y) {
			const a = this.area()
			if (!inside(a, x, y)) return this.say('bed.note_outside_reach')
			if (edit.addPoint(this.lp, this.points, x, y, MAX_POINTS)) return this.say('')
			this.say(this.points.length >= MAX_POINTS ? 'bed.note_limit' : 'bed.note_duplicate', { n: MAX_POINTS })
		},
		addTyped(p) {
			this.addAt(p.x, p.y)
		},
		// arrows on a focused point move it 1 mm (Shift: 10 mm), kept inside the reach
		nudgePoint(ev) {
			const p = this.points.find(q => q.id === ev.id)
			const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[ev.key]
			if (!p || !d || !this.editable) return
			const k = ev.shift ? 10 : 1
			const c = this.clampTo(p.x + d[0] * k, p.y + d[1] * k)
			movePoint(this.lp, this.points, ev.id, c.x, c.y)
			edit.endMove(this.lp)
		},
		remove() {
			removePoint(this.lp, this.points, this.selected)
			this.selected = ''
		},
		undo() {
			edit.undo(this.lp)
			this.selected = ''
			this.say('')
		},
		redo() {
			edit.redo(this.lp)
			this.selected = ''
			this.say('')
		},
		reset() {
			resetPoints(this.lp)
			this.selected = ''
			this.say('')
		},
		loadSet(id) {
			const set = this.sets.sets.find(q => q.id === id)
			if (!set) return
			const r = pointsForBed(set, this.model.bed)
			edit.setPoints(this.lp, this.points, r.points, MAX_POINTS)
			this.selected = ''
			this.say(r.dropped ? 'bed.note_set_dropped' : '', { n: r.dropped })
		},
		// keyboard on the whole bed area: Delete removes the selected point, Ctrl+Z undoes, Ctrl+Y / Ctrl+Shift+Z redoes
		onKey(ev) {
			if (['INPUT', 'TEXTAREA', 'SELECT'].indexOf(ev.target && ev.target.tagName) >= 0 || !this.editable) return
			const ctrl = ev.ctrlKey || ev.metaKey
			if ((ev.key === 'Delete' || ev.key === 'Backspace') && this.selected) this.remove()
			else if (ctrl && (ev.key === 'z' || ev.key === 'Z')) ev.shiftKey ? this.redo() : this.undo()
			else if (ctrl && (ev.key === 'y' || ev.key === 'Y')) this.redo()
			else return
			ev.preventDefault()
		}
	}
}
</script>
