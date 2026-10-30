<template>
	<div class="squareness-assistant">
		<p class="text-body-2 machine-faint">{{ t('calibration.skew_intro') }}</p>
		<div class="d-flex flex-wrap align-center" style="gap:12px">
			<v-select v-model="pair" :items="pairItems" :label="t('calibration.pair')" dense outlined hide-details style="max-width:140px" />
			<v-text-field v-model="side" :label="t('calibration.skew_side')" dense outlined hide-details style="max-width:150px" suffix="mm" />
			<v-text-field v-model="diagSum" :label="t('calibration.skew_d1')" dense outlined hide-details style="max-width:210px" suffix="mm" />
			<v-text-field v-model="diagDiff" :label="t('calibration.skew_d2')" dense outlined hide-details style="max-width:170px" suffix="mm" />
		</div>
		<gcode-block class="mt-3" :title="t('calibration.skew_test')" :text="gcode" />
		<v-alert v-if="result.errorKey" dense outlined type="warning" class="mt-3">{{ t(result.errorKey) }}</v-alert>
		<v-card v-if="result.formula" outlined class="mt-3">
			<v-card-text>
				<div class="text-body-2">{{ t('calibration.skew_formula', result.formula) }}</div>
				<div class="text-body-2 mt-1">{{ t('calibration.skew_angle', { deg: result.deg }) }}</div>
				<div class="text-subtitle-1 mt-1">{{ t('calibration.skew_new', { line: result.line }) }}</div>
				<v-alert v-if="result.bigSkew && result.ok" dense outlined type="warning" class="mt-2 mb-0">{{ t('calibration.skew_big') }}</v-alert>
				<div class="text-caption machine-faint mt-1">{{ t('calibration.skew_sign') }}</div>
			</v-card-text>
		</v-card>
		<div class="d-flex align-center flex-wrap mt-3" style="gap:8px">
			<v-btn small color="primary" :disabled="!result.ok || flowBusy" @click="review()">{{ t('calibration.review') }}</v-btn>
			<span class="text-caption machine-faint">{{ t('calibration.skew_hint') }}</span>
		</div>
		<calc-warnings :rows="calcWarnings" />
		<plan-review v-if="ps.status !== 'idle'" class="mt-3" :state="ps" :title="t('calibration.skew_plan')" :role-ok="canEdit" @apply="applied()" @reset="flow.reset()" />
	</div>
</template>

<script>
'use strict'

// Squareness assistant (design 2.6): the diagonals of a test square -> the skew (preview) -> machine.calc -> M556 through the shared plan
// flow (technician). Pure logic in lib/skew-calc.js.

import PlanReview from './PlanReview.vue'
import GcodeBlock from './GcodeBlock.vue'
import CalcWarnings from './CalcWarnings.vue'
import { planModule } from './plan-module.js'
import { PAIRS, skewResult, skewInput, testSquareGcode, CALC_SKEW } from '../lib/skew-calc.js'

export default {
	components: { PlanReview, GcodeBlock, CalcWarnings },
	mixins: [planModule()],
	props: {
		api: { type: Object, required: true },
		canEdit: { type: Boolean, default: false } // workshopCan machine.config.apply for config.m556 (technician)
	},
	data() {
		return { pair: 'XY', side: '100', diagSum: '', diagDiff: '' }
	},
	computed: {
		pairItems() {
			return PAIRS.map(p => ({ value: p.id, text: p.id }))
		},
		result() {
			return skewResult(this.pair, this.side, this.diagSum, this.diagDiff)
		},
		gcode() {
			return testSquareGcode(this.pair, this.side, 1500)
		}
	},
	methods: {
		async applied() {
			await this.applyPlan(this.canEdit)
			if (this.ps.status === 'done') this.$emit('changed')
		},
		review() {
			return this.proposeCalc(CALC_SKEW, skewInput(this.pair, this.side, this.result))
		}
	}
}
</script>
