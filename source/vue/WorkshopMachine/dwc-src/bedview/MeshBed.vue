<template>
	<div class="mesh-bed" @keydown="onKey">
		<v-alert v-if="!model.bed" density="compact" variant="outlined" type="info" class="mb-0">
			<div>{{ t('bed.no_bed') }}</div>
			<div v-for="m in model.missing" :key="m" class="text-body-small">{{ t('bed.missing_' + m) }}</div>
		</v-alert>
		<template v-else>
			<plan-tabs :view="view" :has-result="!!grid" @view="view = $event" />
			<mesh-bed-tools
				:view="view" :editable="editable" :points-mode="pointsMode" :compare="compare" :can-compare="cmp.ok" :compare-reason="cmp.reason || ''" :model="model"
				:resizable="hasRegion" :region="region" :area="area" :has-area="!!(grid && grid.bounds)"
				@preset="onPreset" @resize="onResize" @region="onTypedRegion" @edit-area="editArea" @compare="compare = $event"
			/>
			<point-mode-bar
				v-if="view === 'plan' && editable" show-modes :mode="pe.mode" :count="pe.points.length" :can-undo="canUndoNow" :can-redo="canRedoNow" :can-reset="pe.points.length > 0"
				:can-seed="pointsMode && !pe.points.length" :notice="notice" @mode="setMode" @undo="undo" @redo="redo" @reset="reset" @seed="seed" @add="addTyped"
			/>
			<v-alert v-if="serviceMesh && serviceMesh.tooMany" density="compact" variant="outlined" type="warning" class="mb-2">{{ t('bed.too_many') }}</v-alert>
			<v-alert v-for="m in notes" :key="m" density="compact" text type="info" class="mb-2 text-body-small">{{ t('bed.missing_' + m) }}</v-alert>
			<v-row density="compact">
				<v-col cols="12" md="8">
					<bed-svg :bed="model.bed" :include="model.screws" :reach="model.reach" :label="t('bed.mesh_label')" @pointer="onPointer">
						<template #default="{ frame }">
							<bed-handles v-if="view === 'plan'" layer="body" :frame="frame" :region="region" :accepted="accepted" :editable="resizable" :body="!pointsMode" />
							<bed-snapped v-if="marks.length" :frame="frame" :marks="marks" />
							<bed-points :frame="frame" :points="shown" :selected="selected" :fills="fills" :ringed="ringed" :chosen="chosenIds" :draggable="canEditPoints" :show-values="opts.values" :show-path="view === 'plan'" @select="onSelect" @nudge="nudgeNode" />
							<!-- the handles go ABOVE the points: the nodes sit on the corners and edges of the area, and underneath they took the drag away -->
							<bed-handles v-if="view === 'plan'" layer="handles" :frame="frame" :region="region" :accepted="accepted" :editable="resizable" :body="!pointsMode" @nudge="onNudge" />
							<bed-job v-if="jobArea" :frame="frame" :rect="jobArea" :verdict="fit.verdict" @nudge="jobNudge" />
						</template>
					</bed-svg>
					<bed-legend class="mt-2" :ids="legendIds" :counts="legendCounts" :stops="view === 'result' && scale ? scale.stops : null" :marks="legendMarks" />
					<div v-if="view === 'plan' && editable" class="text-body-small machine-faint mt-1">{{ t(pointsMode ? 'bed.points_help' : 'bed.mesh_help') }}</div>
				</v-col>
				<v-col cols="12" md="4">
					<point-detail :point="point" :title="pointTitle" :rows="rows" @close="selected = ''">
						<div v-if="canEditPoints && point" class="mt-2">
							<v-btn v-if="chosenAtSelected.length" size="small" variant="outlined" color="error" style="min-height:44px" @click="removeSelected()"><v-icon size="small" start>mdi-delete-outline</v-icon>{{ t('bed.remove_point') }}</v-btn>
							<v-btn v-else size="small" variant="outlined" style="min-height:44px" @click="chooseSelected()"><v-icon size="small" start>mdi-map-marker-plus-outline</v-icon>{{ t('bed.choose_point') }}</v-btn>
						</div>
						<template #actions="slotProps"><slot name="actions" v-bind="slotProps" /></template>
					</point-detail>
					<mesh-bed-side
						class="mt-3" :view="view" :counts="counts" :seconds="seconds" :source="plan.source" :stats="scale && scale.stats" :quality="quality" :name="grid ? grid.name : ''" :opts="opts"
						:points-mode="pointsMode && editable" :derived="derived" :editable="canEditPoints" @use-node="useNode" @remove="removeChosen"
					/>
					<point-sets
						v-if="view === 'plan' && sets" class="mt-3" :view="sets" :editable="editable" :can-save="savable.length > 0"
						@load="loadSet" @save="emit('save-set', { name: $event, points: savable })" @remove="emit('delete-set', $event)"
					/>
				</v-col>
			</v-row>
			<job-fit-card class="mt-3" :job="job" :result="fit" @place="jobPlace" @clear="jobClear" />
		</template>
	</div>
</template>

<script setup>
// The mesh on the bed at true size (design: docs-internal/MACHINE-V2-DESIGN.md "Bed view"). Two views under two wide tabs: PLAN (what the
// next run will measure) and RESULT (what the last run measured). In the plan the region is edited in one of two modes: REGION (drag the
// rectangle, as before) or POINTS (choose points: the firmware measures only a regular grid, so the page derives the grid that holds them,
// lib/point-grid.js). Below the bed, "Check a job area". The local geometry draws instantly; the points the service sends win
// (lib/bed-mesh-plan.js mergeService). The logic is in three composables next to this file: use-mesh-bed-model.js (what is derived),
// use-mesh-bed-points.js (editing the chosen points), use-mesh-bed-pointer.js (taps and drags).
//
// The slot `actions` of the point detail is the EXTENSION POINT for anything that acts on a point. Nothing is wired: acting on the machine
// from the bed view needs the owner's explicit OK.

import { computed, reactive, ref, watch } from 'vue'
import BedSvg from './BedSvg.vue'
import BedHandles from './BedHandles.vue'
import BedPoints from './BedPoints.vue'
import BedSnapped from './BedSnapped.vue'
import BedJob from './BedJob.vue'
import BedLegend from './BedLegend.vue'
import PointDetail from './PointDetail.vue'
import PlanTabs from './PlanTabs.vue'
import PointModeBar from './PointModeBar.vue'
import PointSets from './PointSets.vue'
import JobFitCard from './JobFitCard.vue'
import MeshBedTools from './MeshBedTools.vue'
import MeshBedSide from './MeshBedSide.vue'
import { t } from '../text.js'
import { useMeshBedModel } from './use-mesh-bed-model.js'
import { useMeshBedPoints } from './use-mesh-bed-points.js'
import { useMeshBedPointer } from './use-mesh-bed-pointer.js'
import { canUndo, canRedo } from '../state/point-edit-state.js'
import { createDrag } from '../state/region-drag.js'

const props = defineProps({
	model: { type: Object, required: true }, // state/bed-state.js modelOf(...)
	inputs: { type: Object, required: true }, // the draft of the run form {mode, nx, ny, region: {xmin..ymax}} (written when the person drags)
	form: { type: Object, required: true }, // mesh-grid probeParams(...) of the EFFECTIVE inputs (the derived grid when points are chosen)
	grid: { type: Object, default: null }, // the mesh to show (normalizeGrid)
	previous: { type: Object, default: null }, // the mesh shown before it
	serviceMesh: { type: Object, default: null }, // layout.mesh of the answer to THIS draft: {points, clippedRegion, tooMany, seconds, margin}
	thresholds: { type: Object, required: true },
	editable: { type: Boolean, default: false }, // technician and no run in progress
	canRun: { type: Boolean, default: null }, // the person may run (null: same as editable); decides which tab opens
	resultSignal: { type: Number, default: 0 }, // grows when a run finishes or a mesh is picked from the library: the view goes to the result
	pe: { type: Object, required: true }, // state/point-edit-state.js createPointEdit(): the chosen points, mode, undo / redo
	derived: { type: Object, default: null }, // lib/point-grid.js gridFromPoints(pe.points) (ok or not) while the Points mode has points, else null
	sets: { type: Object, default: null } // the point sets card {available, reason, sets, canWrite, busy, notice, error}; null = not offered
})
const emit = defineEmits(['save-set', 'delete-set'])

const view = ref('plan')
const compare = ref(false)
const selected = ref('')
const notice = ref('')
const drag = reactive(createDrag())
const jobDrag = reactive(createDrag())
const opts = reactive({ zero: false, symmetric: false, values: true, tolerance: 0.1 })
const job = reactive({ x: '', y: '', w: '', h: '' })

const m = useMeshBedModel(props, { view, compare, selected, opts, job })
const p = useMeshBedPoints(props, m, { view, selected, notice })
const g = useMeshBedPointer(props, m, p, { view, selected, drag, jobDrag, job })
const { pointsMode, hasRegion, resizable, region, plan, accepted, counts, legendCounts, seconds, cmp, shown, scale, fills, ringed, quality, legendIds, notes, legendMarks, chosenIds, marks, chosenAtSelected, point, pointTitle, rows, jobArea, fit } = m
const { canEditPoints, area, savable, setMode, addTyped, chooseSelected, removeSelected, removeChosen, nudgeNode, useNode, seed, undo, redo, reset, loadSet, onKey } = p
const { onSelect, onResize, onPreset, onNudge, onTypedRegion, editArea, onPointer, jobNudge, jobPlace, jobClear } = g

const canUndoNow = computed(() => canUndo(props.pe))
const canRedoNow = computed(() => canRedo(props.pe))

watch(() => props.resultSignal, () => {
	if (props.grid) { view.value = 'result'; compare.value = false; selected.value = '' }
})
watch(() => props.grid, g2 => {
	if (!g2) view.value = 'plan'
	else compare.value = false
})
watch(view, () => {
	selected.value = ''
	notice.value = ''
})

// a person who cannot run anything has only the result to look at; a person who can starts from the plan
const runs = props.canRun === null ? props.editable : props.canRun
if (props.grid && !runs) view.value = 'result'
</script>
