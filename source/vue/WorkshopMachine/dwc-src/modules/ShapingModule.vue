<template>
	<div class="shaping-module">
		<div class="text-title-large mb-1">{{ t('shaping.title') }}</div>
		<p class="text-body-medium machine-faint">{{ t('shaping.intro') }}</p>
		<error-notice :error="loadError" retry @retry="load()" />
		<v-alert v-if="!canEdit" density="compact" variant="outlined" type="info" class="mb-3">{{ t('shaping.read_only') }}</v-alert>
		<v-card variant="outlined" class="mb-4">
			<v-card-title class="text-title-medium pb-0">{{ t('shaping.current_title') }}</v-card-title>
			<v-card-text>
				<div v-if="!shaping.available" class="text-body-medium machine-faint">{{ t('shaping.not_reported') }}</div>
				<template v-else>
					<v-chip size="small" variant="outlined" :color="view.active ? 'success' : 'grey'" class="mb-2">{{ t(view.textKey) }}</v-chip>
					<div class="text-body-medium">{{ t('shaping.current_values', { type: show(shaping.current.type), frequency: show(shaping.current.frequency), damping: show(shaping.current.damping), accel: show(shaping.current.minAcceleration) }) }}</div>
					<div v-for="d in shaping.definitions" :key="d.file + d.line" class="text-body-small machine-faint shaping-line">{{ d.file }}:{{ d.line }}  {{ d.text }}</div>
				</template>
				<v-alert v-for="w in shaping.warnings" :key="w" density="compact" variant="outlined" type="warning" class="mt-2 mb-0">{{ t(warningKey(w)) }}</v-alert>
			</v-card-text>
		</v-card>

		<template v-if="canEdit">
			<div class="text-title-medium mb-1">{{ t('shaping.edit_title') }}</div>
			<div class="d-flex flex-wrap" style="gap:12px">
				<v-select v-model="draft.type" :items="types" :label="t('shaping.type')" density="compact" variant="outlined" hide-details style="max-width:150px" />
				<v-text-field v-model="draft.frequency" :label="t('shaping.frequency')" suffix="Hz" density="compact" variant="outlined" hide-details style="max-width:140px" :disabled="checked.none" :error="bad('frequency')" />
				<v-text-field v-model="draft.damping" :label="t('shaping.damping')" density="compact" variant="outlined" hide-details style="max-width:140px" :disabled="checked.none" :error="bad('damping')" />
			</div>
			<div class="text-body-small machine-faint mt-1">{{ t('shaping.min_accel_note') }}</div>
			<div v-for="e in checked.errors" :key="e.field" class="text-body-small text-error mt-1">{{ t(e.key, { min: minFrequency }) }}</div>
			<div v-if="!checked.errors.length" class="text-body-medium mt-2"><span class="shaping-line">{{ line }}</span></div>
			<div class="d-flex align-center flex-wrap mt-3" style="gap:8px">
				<v-btn size="small" color="primary" :disabled="!reviewable || flowBusy" @click="review()">{{ t('shaping.review') }}</v-btn>
				<span class="text-body-small machine-faint">{{ t('shaping.tech_hint') }}</span>
			</div>
			<plan-review v-if="ps.status !== 'idle'" class="mt-3" :state="ps" :title="t('shaping.plan_title')" :role-ok="canEdit" @apply="applied()" @reset="flow.reset()" />
			<try-panel
				class="mt-4" :state="tf" :now="now" :role-ok="trial('M593')" :has-values="reviewable" :can-persist="canEdit" :line="line" v-model:seconds="trySeconds"
				@start="tryNow('M593', tryValues)" @keep="tryFlow.keep()" @revert="tryFlow.revert()" @reset="tryFlow.reset()" @persist="persistTrial()"
			/>
		</template>
		<try-panel v-else-if="tf.status !== 'idle'" class="mt-4" :state="tf" :now="now" :role-ok="false" v-model:seconds="trySeconds" @reset="tryFlow.reset()" />

		<div class="text-title-medium mt-6 mb-1">{{ t('shaping.tuner_title') }}</div>
		<shaping-tuner :api="api" :published="published" :accelerometer="shaping.accelerometer" :can-run="canRun" :now="now" />

		<div class="text-title-medium mt-6 mb-1">{{ t('shaping.ringing_title') }}</div>
		<ringing-test :api="api" :can-generate="canRun" @use="useFrequency" />
	</div>
</template>

<script setup>
// Input shaping (design 2.8): the state of M593 as the board reports it, the edit through a plan (type, frequency, damping; technician),
// "try now" with the auto-revert countdown, the accelerometer data collection (only when the board reports an accelerometer) and the
// ringing test G-code (shown, never sent). Pure logic in lib/shaping.js.

import { computed, ref } from 'vue'
import ErrorNotice from '../ErrorNotice.vue' // vue/_shared
import PlanReview from './PlanReview.vue'
import TryPanel from './TryPanel.vue'
import ShapingTuner from './ShapingTuner.vue'
import RingingTest from './RingingTest.vue'
import { t } from '../text.js'
import { usePlanModule } from './use-plan-module.js'
import { useTrialModule } from './use-trial-module.js'
import { TYPES, KIND_SHAPING, FREQ_MIN, draftOf, check, lineOf, planValues, stateView, warningKey } from '../lib/shaping.js'

const NOT_LOADED = {
	available: false, current: { type: null, frequency: null, damping: null, minAcceleration: null }, types: TYPES, minFrequency: FREQ_MIN,
	accelerometer: { present: false, source: null, count: 0 }, definitions: [], warnings: []
}

const props = defineProps({
	api: { type: Object, required: true }, // createMachineApi(...)
	published: { type: Object, default: null },
	configure: { type: Function, required: true }, // capabilitiesOf(...).configure(kind)
	trial: { type: Function, required: true }, // capabilitiesOf(...).trial(gcodeKind)
	canRun: { type: Boolean, default: false }, // technician
	now: { type: Number, default: 0 }
})

const { ps, flow, flowBusy, propose, applyPlan } = usePlanModule(props)
const { tf, tryFlow, trySeconds, tryNow, persistTrial } = useTrialModule(props, propose)

const loaded = ref(null)
const loadError = ref(null)
const draft = ref(draftOf(null))

const canEdit = computed(() => props.configure(KIND_SHAPING))
const shaping = computed(() => loaded.value || NOT_LOADED)
const types = computed(() => (shaping.value.types.length ? shaping.value.types.filter(x => TYPES.indexOf(x) >= 0) : TYPES))
const minFrequency = computed(() => (shaping.value.minFrequency === null ? FREQ_MIN : shaping.value.minFrequency))
const view = computed(() => stateView(shaping.value.current))
const checked = computed(() => check(draft.value, shaping.value.current, minFrequency.value))
const reviewable = computed(() => !checked.value.errors.length && checked.value.changed)
const line = computed(() => lineOf(checked.value.values))
const tryValues = computed(() => planValues(checked.value.values))

function show(v) {
	return v === null || v === undefined ? '-' : v
}
async function load() {
	try {
		loaded.value = await props.api.motion.shaping()
		loadError.value = null
		draft.value = draftOf(loaded.value.current)
	} catch (e) {
		loadError.value = e
	}
}
function bad(field) {
	return checked.value.errors.some(e => e.field === field)
}
function review() {
	return propose(KIND_SHAPING, planValues(checked.value.values))
}
async function applied() {
	await applyPlan(canEdit.value)
	if (ps.status === 'done') await load()
}
// a frequency measured on the ringing test fills the form; nothing is written until the person reviews a plan
function useFrequency(hz) {
	if (hz !== null) draft.value = Object.assign({}, draft.value, { frequency: String(hz), type: draft.value.type === 'none' ? 'zvd' : draft.value.type })
}
load()
</script>

<style>
.shaping-module .shaping-line { font-family: monospace; }
</style>
