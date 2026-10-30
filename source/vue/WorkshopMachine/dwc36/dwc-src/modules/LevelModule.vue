<template>
	<div class="level-module">
		<div class="text-h6 mb-1">{{ t('level.title') }}</div>
		<p class="text-body-2 machine-faint">{{ t('level.intro') }}</p>
		<div class="d-flex align-center flex-wrap mb-3" style="gap:8px">
			<span class="text-body-2">{{ t('level.detected') }}:</span>
			<v-chip small outlined :color="detection.kinds.length ? 'primary' : 'warning'">{{ t(detection.modeKey) }}</v-chip>
			<span v-if="detection.reasonKey" class="text-caption warning--text">{{ t(detection.reasonKey) }}</span>
			<span v-else-if="detection.kinds.length < 3" class="text-caption machine-faint">{{ t('level.reason_' + detection.mode) }}</span>
		</div>
		<v-alert v-if="!canRun" dense outlined type="info" class="mb-3">{{ t('page.read_only') }}</v-alert>
		<v-card outlined class="mb-4 pa-3">
			<level-bed
				:model="bedModel" :lp="lp" :service-level="serviceLevel" :last-level="lastLevel" :result="rs.result" :editable="canRun && !busy && detection.kinds.length > 0"
				:sets="setsView" @save-set="saveSet($event.name, $event.points)" @delete-set="deleteSet"
			/>
		</v-card>
		<template v-if="canRun && detection.kinds.length">
			<v-radio-group v-model="rs.inputs.kind" :label="t('level.kind_label')" dense hide-details class="mt-0 mb-3" :disabled="busy">
				<v-radio v-for="k in detection.kinds" :key="k" :value="k" :label="t('level.kind_' + k.split('.')[1])" />
			</v-radio-group>
			<v-row dense>
				<v-col cols="6" sm="3">
					<v-text-field v-model="rs.inputs.maxPasses" :label="t('level.field_passes')" type="number" dense outlined hide-details="auto" :disabled="busy || measureOnly" :error-messages="errorOf('maxPasses')" />
				</v-col>
				<v-col cols="6" sm="3">
					<v-text-field v-model="rs.inputs.toleranceMm" :label="t('level.field_tolerance')" type="number" step="0.005" dense outlined hide-details="auto" :disabled="busy" :error-messages="errorOf('toleranceMm')" />
				</v-col>
			</v-row>
			<run-start :allowed="canRun" :busy="!startAllowed" :starting="rs.status === 'starting'" :disabled-text="blockedText" @start="begin()" />
		</template>
		<run-progress class="mt-3" :run="rs.run" :error-text="runErrorText" :foreign-text="foreignText" :now="now" @stop="stop()" />
		<div class="text-body-2 font-weight-medium mt-4 mb-2">{{ t('level.result_title') }}</div>
		<level-passes v-if="hasPasses" :result="rs.result" />
		<div v-else class="text-body-2 machine-faint">{{ t('level.no_result') }}</div>
	</div>
</template>

<script>
'use strict'

// Levelling module (design 2.3): the detection mode comes from what the service discovered (machine.overview ready.levelling_mode), the
// run kinds offered follow from it (lib/level.js). Runs happen in the service: G32 through bed.g, G30 points, or measure only; progress
// per point, the table per pass, STOP. Applying changes to bed.g / M671 is a later phase and is not offered here.

import { runModule } from './run-module.js'
import RunStart from './RunStart.vue'
import RunProgress from './RunProgress.vue'
import LevelPasses from './LevelPasses.vue'
import LevelBed from '../bedview/LevelBed.vue'
import { bedLayoutMixin } from './bed-layout-mixin.js'
import { pointSetsMixin } from './pointsets-mixin.js'
import { draftKeyOf } from '../state/bed-state.js'
import { createLevelPoints, pointsOf } from '../state/level-points-state.js'
import { KINDS, detect, runParams, defaultsOf } from '../lib/level.js'

export default {
	components: { RunStart, RunProgress, LevelPasses, LevelBed },
	mixins: [bedLayoutMixin(), pointSetsMixin(), runModule(KINDS, { kind: 'level.measure', maxPasses: 5, toleranceMm: 0.02 })],
	props: {
		api: { type: Object, required: true }, // createMachineApi(...)
		published: { type: Object, default: null }, // normalizeRuns of the plugin data `machine`
		canRun: { type: Boolean, default: false }, // technician
		canWrite: { type: Boolean, default: false }, // technician: save and delete the named point sets
		ready: { type: Object, default: null }, // normalizeOverview(...).ready
		profile: { type: Object, default: null }, // profile levelling block {max_passes, tolerance_mm}
		axes: { type: Array, default: () => [] }, // move.axes of the DWC model (letter, min, max)
		now: { type: Number, default: 0 }
	},
	data() {
		return { lp: createLevelPoints(), layoutMode: 'level' }
	},
	computed: {
		// the draft the service is asked to confirm: only when the person edited the points (otherwise the layout alone has the suggestion)
		draft() {
			const m = this.bedModel
			return this.lp.edited ? { points: pointsOf(this.lp, m.screws, m.reach, null).map(p => ({ x: p.x, y: p.y })) } : null
		},
		// the draft by CONTENT (see MeshModule): a new object on every model update must not ask the service again
		draftKey() {
			return draftKeyOf(this.layoutMode, this.draft || undefined)
		},
		serviceLevel() {
			const lay = this.layoutFor(this.draft || undefined)
			return lay ? lay.level : null
		},
		lastLevel() {
			return this.bedState.layout ? this.bedState.layout.lastLevel : null
		},
		detection() {
			return detect(this.ready)
		},
		measureOnly() {
			return this.rs.inputs.kind === 'level.measure'
		},
		form() {
			return runParams(this.rs.inputs, this.profile)
		},
		hasPasses() {
			return !!this.rs.result && Array.isArray(this.rs.result.passes)
		},
		blockedText() {
			if (this.rs.status === 'starting') return ''
			return this.form.ok ? '' : this.t(Object.values(this.form.errors)[0])
		},
		foreignText() {
			return this.rs.foreign ? this.t('run.another_running', { kind: this.foreignKind }) : ''
		}
	},
	watch: {
		draftKey() {
			this.askDraft(this.draft || undefined)
		},
		'rs.result'(result) {
			if (result) this.refreshLayout()
		}
	},
	created() {
		this.refreshLayout()
		this.loadPointSets()
		const d = defaultsOf(this.profile)
		this.rs.inputs.maxPasses = d.maxPasses
		this.rs.inputs.toleranceMm = d.toleranceMm
		if (this.detection.kinds.length && this.detection.kinds.indexOf(this.rs.inputs.kind) < 0) this.rs.inputs.kind = this.detection.kinds[this.detection.kinds.length - 1]
	},
	methods: {
		errorOf(field) {
			return this.form.errors[field] ? [this.t(this.form.errors[field])] : []
		},
		begin() {
			if (!this.form.ok || this.detection.kinds.indexOf(this.rs.inputs.kind) < 0) return
			// measure only takes one pass: it gets the tolerance and no pass limit
			this.start(this.rs.inputs.kind, this.measureOnly ? { tolerance_mm: this.form.params.tolerance_mm } : this.form.params)
		}
	}
}
</script>
