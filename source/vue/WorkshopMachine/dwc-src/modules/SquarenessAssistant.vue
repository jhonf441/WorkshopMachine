<template>
	<div class="squareness-assistant">
		<p class="text-body-medium machine-faint">{{ t('calibration.skew_intro') }}</p>
		<div class="d-flex flex-wrap align-center" style="gap:12px">
			<v-select v-model="pair" :items="pairItems" item-title="text" :label="t('calibration.pair')" density="compact" variant="outlined" hide-details style="max-width:140px" />
			<v-text-field v-model="side" :label="t('calibration.skew_side')" density="compact" variant="outlined" hide-details style="max-width:150px" suffix="mm" />
			<v-text-field v-model="diagSum" :label="t('calibration.skew_d1')" density="compact" variant="outlined" hide-details style="max-width:210px" suffix="mm" />
			<v-text-field v-model="diagDiff" :label="t('calibration.skew_d2')" density="compact" variant="outlined" hide-details style="max-width:170px" suffix="mm" />
		</div>
		<gcode-block class="mt-3" :title="t('calibration.skew_test')" :text="gcode" />
		<v-alert v-if="result.errorKey" density="compact" variant="outlined" type="warning" class="mt-3">{{ t(result.errorKey) }}</v-alert>
		<v-card v-if="result.formula" variant="outlined" class="mt-3">
			<v-card-text>
				<div class="text-body-medium">{{ t('calibration.skew_formula', result.formula) }}</div>
				<div class="text-body-medium mt-1">{{ t('calibration.skew_angle', { deg: result.deg }) }}</div>
				<div class="text-title-medium mt-1">{{ t('calibration.skew_new', { line: result.line }) }}</div>
				<v-alert v-if="result.bigSkew && result.ok" density="compact" variant="outlined" type="warning" class="mt-2 mb-0">{{ t('calibration.skew_big') }}</v-alert>
				<div class="text-body-small machine-faint mt-1">{{ t('calibration.skew_sign') }}</div>
			</v-card-text>
		</v-card>
		<div class="d-flex align-center flex-wrap mt-3" style="gap:8px">
			<v-btn size="small" color="primary" :disabled="!result.ok || flowBusy" @click="review()">{{ t('calibration.review') }}</v-btn>
			<span class="text-body-small machine-faint">{{ t('calibration.skew_hint') }}</span>
		</div>
		<calc-warnings :rows="calcWarnings" />
		<plan-review v-if="ps.status !== 'idle'" class="mt-3" :state="ps" :title="t('calibration.skew_plan')" :role-ok="canEdit" @apply="applied()" @reset="flow.reset()" />
	</div>
</template>

<script setup>
// Squareness assistant (design 2.6): the diagonals of a test square -> the skew (preview) -> machine.calc -> M556 through the shared plan
// flow (technician). Pure logic in lib/skew-calc.js.

import { computed, ref } from 'vue'
import PlanReview from './PlanReview.vue'
import GcodeBlock from './GcodeBlock.vue'
import CalcWarnings from './CalcWarnings.vue'
import { t } from '../text.js'
import { usePlanModule } from './use-plan-module.js'
import { PAIRS, skewResult, skewInput, testSquareGcode, CALC_SKEW } from '../lib/skew-calc.js'

const props = defineProps({
	api: { type: Object, required: true },
	canEdit: { type: Boolean, default: false } // workshopCan machine.config.apply for config.m556 (technician)
})
const emit = defineEmits(['changed'])

const { ps, flow, flowBusy, calcWarnings, proposeCalc, applyPlan } = usePlanModule(props)

const pair = ref('XY')
const side = ref('100')
const diagSum = ref('')
const diagDiff = ref('')

const pairItems = computed(() => PAIRS.map(p => ({ value: p.id, text: p.id })))
const result = computed(() => skewResult(pair.value, side.value, diagSum.value, diagDiff.value))
const gcode = computed(() => testSquareGcode(pair.value, side.value, 1500))

async function applied() {
	await applyPlan(props.canEdit)
	if (ps.status === 'done') emit('changed')
}
function review() {
	return proposeCalc(CALC_SKEW, skewInput(pair.value, side.value, result.value))
}
</script>
