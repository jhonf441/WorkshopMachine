<template>
	<div class="steps-assistant">
		<p class="text-body-medium machine-faint">{{ t('calibration.steps_intro') }}</p>
		<v-alert v-if="!canEdit" density="compact" variant="outlined" type="info" class="mb-3">{{ t('calibration.steps_admin') }}</v-alert>
		<div v-if="!rows.length" class="text-body-medium machine-faint">{{ t('calibration.no_axes') }}</div>
		<template v-else>
			<div class="d-flex flex-wrap align-center" style="gap:12px">
				<v-select v-model="axis" :items="axisItems" :label="t('calibration.axis')" density="compact" variant="outlined" hide-details style="max-width:120px" />
				<v-text-field v-model="commanded" :label="t('calibration.commanded')" density="compact" variant="outlined" hide-details style="max-width:160px" suffix="mm" />
				<v-text-field v-model="measured" :label="t('calibration.measured')" density="compact" variant="outlined" hide-details style="max-width:160px" suffix="mm" />
			</div>
			<div class="text-body-medium mt-2">{{ t('calibration.steps_current', { axis, value: old === null ? '-' : old }) }}</div>
			<gcode-block class="mt-2" :title="t('calibration.steps_test')" :text="gcode" />
			<v-alert v-if="result.errorKey" density="compact" variant="outlined" type="warning" class="mt-3">{{ t(result.errorKey) }}</v-alert>
			<v-card v-if="result.formula" variant="outlined" class="mt-3">
				<v-card-text>
					<div class="text-body-medium">{{ t('calibration.steps_formula', result.formula) }}</div>
					<div class="text-title-medium mt-1">{{ t('calibration.steps_new', { axis, next: result.next, change: signed(result.change) }) }}</div>
					<v-alert v-if="result.bigChange && result.ok" density="compact" variant="outlined" type="warning" class="mt-2 mb-0">{{ t('calibration.steps_big') }}</v-alert>
				</v-card-text>
			</v-card>
			<div class="d-flex align-center flex-wrap mt-3" style="gap:8px">
				<v-btn size="small" color="primary" :disabled="!result.ok || flowBusy" @click="review()">{{ t('calibration.review') }}</v-btn>
				<span class="text-body-small machine-faint">{{ t('calibration.steps_hint') }}</span>
			</div>
		</template>
		<calc-warnings :rows="calcWarnings" />
		<plan-review v-if="ps.status !== 'idle'" class="mt-3" :state="ps" :title="t('calibration.steps_plan')" :role-ok="canEdit" @apply="applied()" @reset="flow.reset()" />
	</div>
</template>

<script setup>
// Steps per mm assistant (design 2.6): commanded vs measured -> the new value with its formula (preview), then machine.calc and the plan
// (admin class: M92). Pure logic in lib/steps-calc.js; the review and the apply are the shared plan flow.

import { computed, ref, watch } from 'vue'
import PlanReview from './PlanReview.vue'
import GcodeBlock from './GcodeBlock.vue'
import CalcWarnings from './CalcWarnings.vue'
import { t } from '../text.js'
import { usePlanModule } from './use-plan-module.js'
import { stepsResult, stepsInput, testMoveGcode, CALC_STEPS } from '../lib/steps-calc.js'

const props = defineProps({
	api: { type: Object, required: true }, // createMachineApi(...)
	rows: { type: Array, default: () => [] }, // lib/motion-table.js tableRows (axes and extruders)
	canEdit: { type: Boolean, default: false } // workshopCan machine.config.apply for config.m92 (admin)
})
const emit = defineEmits(['changed'])

const { ps, flow, flowBusy, calcWarnings, proposeCalc, applyPlan } = usePlanModule(props)

const axis = ref('')
const commanded = ref('100')
const measured = ref('')
const feed = ref('600')

const axisItems = computed(() => props.rows.map(r => r.letter))
const old = computed(() => {
	const r = props.rows.find(x => x.letter === axis.value)
	return r && typeof r.stepsPerMm === 'number' ? r.stepsPerMm : null
})
const result = computed(() => stepsResult(old.value, commanded.value, measured.value))
const gcode = computed(() => testMoveGcode(axis.value, commanded.value, feed.value))

watch(() => props.rows, rows => {
	if (!rows.some(r => r.letter === axis.value) && rows.length) axis.value = rows[0].letter
}, { immediate: true })

async function applied() {
	await applyPlan(props.canEdit)
	if (ps.status === 'done') emit('changed')
}
function signed(v) {
	return (v > 0 ? '+' : '') + v
}
function review() {
	return proposeCalc(CALC_STEPS, stepsInput(axis.value, old.value, result.value))
}
</script>
