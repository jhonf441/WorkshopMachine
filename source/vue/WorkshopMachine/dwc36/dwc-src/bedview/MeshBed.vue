<template>
	<div class="mesh-bed" @keydown="onKey">
		<v-alert v-if="!model.bed" dense outlined type="info" class="mb-0">
			<div>{{ t('bed.no_bed') }}</div>
			<div v-for="m in model.missing" :key="m" class="text-caption">{{ t('bed.missing_' + m) }}</div>
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
			<v-alert v-if="serviceMesh && serviceMesh.tooMany" dense outlined type="warning" class="mb-2">{{ t('bed.too_many') }}</v-alert>
			<v-alert v-for="m in notes" :key="m" dense outlined type="info" class="mb-2 text-caption">{{ t('bed.missing_' + m) }}</v-alert>
			<v-row dense>
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
					<div v-if="view === 'plan' && editable" class="text-caption machine-faint mt-1">{{ t(pointsMode ? 'bed.points_help' : 'bed.mesh_help') }}</div>
				</v-col>
				<v-col cols="12" md="4">
					<point-detail :point="point" :title="pointTitle" :rows="rows" @close="selected = ''">
						<div v-if="canEditPoints && point" class="mt-2">
							<v-btn v-if="chosenAtSelected.length" small outlined color="error" style="min-height:44px" @click="removeSelected()"><v-icon small left>mdi-delete-outline</v-icon>{{ t('bed.remove_point') }}</v-btn>
							<v-btn v-else small outlined style="min-height:44px" @click="chooseSelected()"><v-icon small left>mdi-map-marker-plus-outline</v-icon>{{ t('bed.choose_point') }}</v-btn>
						</div>
						<template #actions="slotProps"><slot name="actions" v-bind="slotProps" /></template>
					</point-detail>
					<mesh-bed-side
						class="mt-3" :view="view" :counts="counts" :seconds="seconds" :source="plan.source" :stats="scale && scale.stats" :quality="quality" :name="grid ? grid.name : ''" :opts="opts"
						:points-mode="pointsMode && editable" :derived="derived" :editable="canEditPoints" @use-node="useNode" @remove="removeChosen"
					/>
					<point-sets
						v-if="view === 'plan' && sets" class="mt-3" :view="sets" :editable="editable" :can-save="savable.length > 0"
						@load="loadSet" @save="$emit('save-set', { name: $event, points: savable })" @remove="$emit('delete-set', $event)"
					/>
				</v-col>
			</v-row>
			<job-fit-card class="mt-3" :job="job" :result="fit" @place="jobPlace" @clear="jobClear" />
		</template>
	</div>
</template>

<script>
'use strict'

// The mesh on the bed at true size (design: docs-internal/MACHINE-V2-DESIGN.md "Bed view"). Two views under two wide tabs: PLAN (what the
// next run will measure) and RESULT (what the last run measured). In the plan the region is edited in one of two modes: REGION (drag the
// rectangle, as before) or POINTS (choose points: the firmware measures only a regular grid, so the page derives the grid that holds them,
// lib/point-grid.js). Below the bed, "Check a job area". The local geometry draws instantly; the points the service sends win
// (lib/bed-mesh-plan.js mergeService). The logic is in three mixins next to this file: mesh-bed-model.js (what is derived), mesh-bed-points.js
// (editing the chosen points), mesh-bed-pointer.js (taps and drags).
//
// The slot `actions` of the point detail is the EXTENSION POINT for anything that acts on a point. Nothing is wired: acting on the machine
// from the bed view needs the owner's explicit OK.

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
import { textMixin } from '../modules/text-mixin.js'
import { meshBedModel } from './mesh-bed-model.js'
import { meshBedPoints } from './mesh-bed-points.js'
import { meshBedPointer } from './mesh-bed-pointer.js'
import { canUndo, canRedo } from '../state/point-edit-state.js'
import { createDrag } from '../state/region-drag.js'

export default {
	components: { BedSvg, BedHandles, BedPoints, BedSnapped, BedJob, BedLegend, PointDetail, PlanTabs, PointModeBar, PointSets, JobFitCard, MeshBedTools, MeshBedSide },
	mixins: [textMixin, meshBedModel, meshBedPoints, meshBedPointer],
	props: {
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
	},
	data() {
		return {
			view: 'plan', compare: false, selected: '', notice: '', drag: createDrag(), jobDrag: createDrag(), resizeBase: null,
			opts: { zero: false, symmetric: false, values: true, tolerance: 0.1 }, job: { x: '', y: '', w: '', h: '' }
		}
	},
	computed: {
		canUndoNow() {
			return canUndo(this.pe)
		},
		canRedoNow() {
			return canRedo(this.pe)
		}
	},
	watch: {
		resultSignal() {
			if (this.grid) { this.view = 'result'; this.compare = false; this.selected = '' }
		},
		grid(g) {
			if (!g) this.view = 'plan'
			else this.compare = false
		},
		view() {
			this.selected = ''
			this.notice = ''
		}
	},
	created() {
		// a person who cannot run anything has only the result to look at; a person who can starts from the plan
		const runs = this.canRun === null ? this.editable : this.canRun
		if (this.grid && !runs) this.view = 'result'
	}
}
</script>
