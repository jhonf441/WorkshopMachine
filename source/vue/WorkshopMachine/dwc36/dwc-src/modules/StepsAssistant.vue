<template>
	<div class="steps-assistant">
		<p class="text-body-2 machine-faint">{{ t('calibration.steps_intro') }}</p>
		<v-alert v-if="!canEdit" dense outlined type="info" class="mb-3">{{ t('calibration.steps_admin') }}</v-alert>
		<div v-if="!rows.length" class="text-body-2 machine-faint">{{ t('calibration.no_axes') }}</div>
		<template v-else>
			<div class="d-flex flex-wrap align-center" style="gap:12px">
				<v-select v-model="axis" :items="axisItems" :label="t('calibration.axis')" dense outlined hide-details style="max-width:120px" />
				<v-text-field v-model="commanded" :label="t('calibration.commanded')" dense outlined hide-details style="max-width:160px" suffix="mm" />
				<v-text-field v-model="measured" :label="t('calibration.measured')" dense outlined hide-details style="max-width:160px" suffix="mm" />
			</div>
			<div class="text-body-2 mt-2">{{ t('calibration.steps_current', { axis, value: old === null ? '-' : old }) }}</div>
			<gcode-block class="mt-2" :title="t('calibration.steps_test')" :text="gcode" />
			<v-alert v-if="result.errorKey" dense outlined type="warning" class="mt-3">{{ t(result.errorKey) }}</v-alert>
			<v-card v-if="result.formula" outlined class="mt-3">
				<v-card-text>
					<div class="text-body-2">{{ t('calibration.steps_formula', result.formula) }}</div>
					<div class="text-subtitle-1 mt-1">{{ t('calibration.steps_new', { axis, next: result.next, change: signed(result.change) }) }}</div>
					<v-alert v-if="result.bigChange && result.ok" dense outlined type="warning" class="mt-2 mb-0">{{ t('calibration.steps_big') }}</v-alert>
				</v-card-text>
			</v-card>
			<div class="d-flex align-center flex-wrap mt-3" style="gap:8px">
				<v-btn small color="primary" :disabled="!result.ok || flowBusy" @click="review()">{{ t('calibration.review') }}</v-btn>
				<span class="text-caption machine-faint">{{ t('calibration.steps_hint') }}</span>
			</div>
		</template>
		<calc-warnings :rows="calcWarnings" />
		<plan-review v-if="ps.status !== 'idle'" class="mt-3" :state="ps" :title="t('calibration.steps_plan')" :role-ok="canEdit" @apply="applied()" @reset="flow.reset()" />
	</div>
</template>

<script>
'use strict'

// Steps per mm assistant (design 2.6): commanded vs measured -> the new value with its formula (preview), then machine.calc and the plan
// (admin class: M92). Pure logic in lib/steps-calc.js; the review and the apply are the shared plan flow.

import PlanReview from './PlanReview.vue'
import GcodeBlock from './GcodeBlock.vue'
import CalcWarnings from './CalcWarnings.vue'
import { planModule } from './plan-module.js'
import { stepsResult, stepsInput, testMoveGcode, CALC_STEPS } from '../lib/steps-calc.js'

export default {
	components: { PlanReview, GcodeBlock, CalcWarnings },
	mixins: [planModule()],
	props: {
		api: { type: Object, required: true }, // createMachineApi(...)
		rows: { type: Array, default: () => [] }, // lib/motion-table.js tableRows (axes and extruders)
		canEdit: { type: Boolean, default: false } // workshopCan machine.config.apply for config.m92 (admin)
	},
	data() {
		return { axis: '', commanded: '100', measured: '', feed: '600' }
	},
	computed: {
		axisItems() {
			return this.rows.map(r => r.letter)
		},
		old() {
			const r = this.rows.find(x => x.letter === this.axis)
			return r && typeof r.stepsPerMm === 'number' ? r.stepsPerMm : null
		},
		result() {
			return stepsResult(this.old, this.commanded, this.measured)
		},
		gcode() {
			return testMoveGcode(this.axis, this.commanded, this.feed)
		}
	},
	watch: {
		rows: {
			immediate: true,
			handler(rows) {
				if (!rows.some(r => r.letter === this.axis) && rows.length) this.axis = rows[0].letter
			}
		}
	},
	methods: {
		async applied() {
			await this.applyPlan(this.canEdit)
			if (this.ps.status === 'done') this.$emit('changed')
		},
		signed(v) {
			return (v > 0 ? '+' : '') + v
		},
		review() {
			return this.proposeCalc(CALC_STEPS, stepsInput(this.axis, this.old, this.result))
		}
	}
}
</script>
