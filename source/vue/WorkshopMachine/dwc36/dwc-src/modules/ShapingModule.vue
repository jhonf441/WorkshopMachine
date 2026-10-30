<template>
	<div class="shaping-module">
		<div class="text-h6 mb-1">{{ t('shaping.title') }}</div>
		<p class="text-body-2 machine-faint">{{ t('shaping.intro') }}</p>
		<error-notice :error="loadError" retry @retry="load()" />
		<v-alert v-if="!canEdit" dense outlined type="info" class="mb-3">{{ t('shaping.read_only') }}</v-alert>
		<v-card outlined class="mb-4">
			<v-card-title class="text-subtitle-1 pb-0">{{ t('shaping.current_title') }}</v-card-title>
			<v-card-text>
				<div v-if="!shaping.available" class="text-body-2 machine-faint">{{ t('shaping.not_reported') }}</div>
				<template v-else>
					<v-chip small outlined :color="view.active ? 'success' : 'grey'" class="mb-2">{{ t(view.textKey) }}</v-chip>
					<div class="text-body-2">{{ t('shaping.current_values', { type: show(shaping.current.type), frequency: show(shaping.current.frequency), damping: show(shaping.current.damping), accel: show(shaping.current.minAcceleration) }) }}</div>
					<div v-for="d in shaping.definitions" :key="d.file + d.line" class="text-caption machine-faint shaping-line">{{ d.file }}:{{ d.line }}  {{ d.text }}</div>
				</template>
				<v-alert v-for="w in shaping.warnings" :key="w" dense outlined type="warning" class="mt-2 mb-0">{{ t(warningKey(w)) }}</v-alert>
			</v-card-text>
		</v-card>

		<template v-if="canEdit">
			<div class="text-subtitle-1 mb-1">{{ t('shaping.edit_title') }}</div>
			<div class="d-flex flex-wrap" style="gap:12px">
				<v-select v-model="draft.type" :items="types" :label="t('shaping.type')" dense outlined hide-details style="max-width:150px" />
				<v-text-field v-model="draft.frequency" :label="t('shaping.frequency')" suffix="Hz" dense outlined hide-details style="max-width:140px" :disabled="checked.none" :error="bad('frequency')" />
				<v-text-field v-model="draft.damping" :label="t('shaping.damping')" dense outlined hide-details style="max-width:140px" :disabled="checked.none" :error="bad('damping')" />
			</div>
			<div class="text-caption machine-faint mt-1">{{ t('shaping.min_accel_note') }}</div>
			<div v-for="e in checked.errors" :key="e.field" class="text-caption error--text mt-1">{{ t(e.key, { min: minFrequency }) }}</div>
			<div v-if="!checked.errors.length" class="text-body-2 mt-2"><span class="shaping-line">{{ line }}</span></div>
			<div class="d-flex align-center flex-wrap mt-3" style="gap:8px">
				<v-btn small color="primary" :disabled="!reviewable || flowBusy" @click="review()">{{ t('shaping.review') }}</v-btn>
				<span class="text-caption machine-faint">{{ t('shaping.tech_hint') }}</span>
			</div>
			<plan-review v-if="ps.status !== 'idle'" class="mt-3" :state="ps" :title="t('shaping.plan_title')" :role-ok="canEdit" @apply="applied()" @reset="flow.reset()" />
			<try-panel
				class="mt-4" :state="tf" :now="now" :role-ok="trial('M593')" :has-values="reviewable" :can-persist="canEdit" :line="line" :seconds.sync="trySeconds"
				@start="tryNow('M593', tryValues)" @keep="tryFlow.keep()" @revert="tryFlow.revert()" @reset="tryFlow.reset()" @persist="persistTrial()"
			/>
		</template>
		<try-panel v-else-if="tf.status !== 'idle'" class="mt-4" :state="tf" :now="now" :role-ok="false" :seconds.sync="trySeconds" @reset="tryFlow.reset()" />

		<div class="text-subtitle-1 mt-6 mb-1">{{ t('shaping.tuner_title') }}</div>
		<shaping-tuner :api="api" :published="published" :accelerometer="shaping.accelerometer" :can-run="canRun" :now="now" />

		<div class="text-subtitle-1 mt-6 mb-1">{{ t('shaping.ringing_title') }}</div>
		<ringing-test :api="api" :can-generate="canRun" @use="useFrequency" />
	</div>
</template>

<script>
'use strict'

// Input shaping (design 2.8): the state of M593 as the board reports it, the edit through a plan (type, frequency, damping; technician),
// "try now" with the auto-revert countdown, the accelerometer data collection (only when the board reports an accelerometer) and the
// ringing test G-code (shown, never sent). Pure logic in lib/shaping.js.

import ErrorNotice from '../ErrorNotice.vue' // vue/_shared
import PlanReview from './PlanReview.vue'
import TryPanel from './TryPanel.vue'
import ShapingTuner from './ShapingTuner.vue'
import RingingTest from './RingingTest.vue'
import { planModule } from './plan-module.js'
import { trialModule } from './trial-module.js'
import { TYPES, KIND_SHAPING, FREQ_MIN, draftOf, check, lineOf, planValues, stateView, warningKey } from '../lib/shaping.js'

const NOT_LOADED = {
	available: false, current: { type: null, frequency: null, damping: null, minAcceleration: null }, types: TYPES, minFrequency: FREQ_MIN,
	accelerometer: { present: false, source: null, count: 0 }, definitions: [], warnings: []
}

export default {
	components: { ErrorNotice, PlanReview, TryPanel, ShapingTuner, RingingTest },
	mixins: [planModule(), trialModule()],
	props: {
		api: { type: Object, required: true }, // createMachineApi(...)
		published: { type: Object, default: null },
		configure: { type: Function, required: true }, // capabilitiesOf(...).configure(kind)
		trial: { type: Function, required: true }, // capabilitiesOf(...).trial(gcodeKind)
		canRun: { type: Boolean, default: false }, // technician
		now: { type: Number, default: 0 }
	},
	data() {
		return { loaded: null, loadError: null, draft: draftOf(null) }
	},
	computed: {
		canEdit() {
			return this.configure(KIND_SHAPING)
		},
		shaping() {
			return this.loaded || NOT_LOADED
		},
		types() {
			return this.shaping.types.length ? this.shaping.types.filter(t => TYPES.indexOf(t) >= 0) : TYPES
		},
		minFrequency() {
			return this.shaping.minFrequency === null ? FREQ_MIN : this.shaping.minFrequency
		},
		view() {
			return stateView(this.shaping.current)
		},
		checked() {
			return check(this.draft, this.shaping.current, this.minFrequency)
		},
		reviewable() {
			return !this.checked.errors.length && this.checked.changed
		},
		line() {
			return lineOf(this.checked.values)
		},
		tryValues() {
			return planValues(this.checked.values)
		}
	},
	created() {
		this.load()
	},
	methods: {
		warningKey,
		show(v) {
			return v === null || v === undefined ? '-' : v
		},
		async load() {
			try {
				this.loaded = await this.api.motion.shaping()
				this.loadError = null
				this.draft = draftOf(this.loaded.current)
			} catch (e) {
				this.loadError = e
			}
		},
		bad(field) {
			return this.checked.errors.some(e => e.field === field)
		},
		review() {
			return this.propose(KIND_SHAPING, planValues(this.checked.values))
		},
		async applied() {
			await this.applyPlan(this.canEdit)
			if (this.ps.status === 'done') await this.load()
		},
		// a frequency measured on the ringing test fills the form; nothing is written until the person reviews a plan
		useFrequency(hz) {
			if (hz !== null) this.draft = Object.assign({}, this.draft, { frequency: String(hz), type: this.draft.type === 'none' ? 'zvd' : this.draft.type })
		}
	}
}
</script>

<style>
.shaping-module .shaping-line { font-family: monospace; }
</style>
