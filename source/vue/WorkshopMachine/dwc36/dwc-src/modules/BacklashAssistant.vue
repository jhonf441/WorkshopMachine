<template>
	<div class="backlash-assistant">
		<p class="text-body-2 machine-faint">{{ t('calibration.backlash_intro') }}</p>
		<v-alert dense outlined type="warning" class="mb-3">{{ t('calibration.backlash_fixed') }}</v-alert>
		<div class="d-flex flex-wrap align-center" style="gap:12px">
			<v-select v-model="axis" :items="axisItems" :label="t('calibration.axis')" dense outlined hide-details style="max-width:120px" />
			<v-text-field v-model="multiplier" :label="t('calibration.backlash_multiplier')" dense outlined hide-details style="max-width:200px" :hint="t('calibration.backlash_multiplier_hint')" />
		</div>
		<v-simple-table dense class="mt-3">
			<thead>
				<tr>
					<th class="text-left">#</th>
					<th class="text-left">{{ t('calibration.backlash_plus') }}</th>
					<th class="text-left">{{ t('calibration.backlash_minus') }}</th>
					<th />
				</tr>
			</thead>
			<tbody>
				<tr v-for="(e, i) in entries" :key="i">
					<td>{{ i + 1 }}</td>
					<td><v-text-field v-model="e.plus" dense outlined hide-details class="backlash-field" suffix="mm" :aria-label="t('calibration.backlash_plus')" /></td>
					<td><v-text-field v-model="e.minus" dense outlined hide-details class="backlash-field" suffix="mm" :aria-label="t('calibration.backlash_minus')" /></td>
					<td><v-btn x-small icon :disabled="entries.length < 2" :title="t('calibration.backlash_remove')" @click="entries.splice(i, 1)"><v-icon x-small>mdi-close</v-icon></v-btn></td>
				</tr>
			</tbody>
		</v-simple-table>
		<v-btn small text class="mt-1" :disabled="entries.length >= max" @click="entries.push(blank())"><v-icon small left>mdi-plus</v-icon>{{ t('calibration.backlash_add') }}</v-btn>
		<v-alert v-if="result.errorKey" dense outlined type="warning" class="mt-3">{{ t(result.errorKey) }}</v-alert>
		<v-card v-if="result.n" outlined class="mt-3">
			<v-card-text>
				<div class="text-body-2">{{ t('calibration.backlash_stats', { n: result.n, mean: result.mean, stdev: result.stdev, min: result.min, max: result.max }) }}</div>
				<div class="text-subtitle-1 mt-1">{{ t('calibration.backlash_new', { line: result.line }) }}</div>
				<v-alert v-if="result.inconsistent && !calc" dense outlined type="warning" class="mt-2 mb-0">{{ t('calibration.warn_inconsistent') }}</v-alert>
				<v-alert v-if="result.big && !calc" dense outlined type="warning" class="mt-2 mb-0">{{ t('calibration.warn_big_backlash') }}</v-alert>
			</v-card-text>
		</v-card>
		<div class="d-flex align-center flex-wrap mt-3" style="gap:8px">
			<v-btn small color="primary" :disabled="!result.ok || flowBusy" @click="review()">{{ t('calibration.review') }}</v-btn>
		</div>
		<calc-warnings :rows="calcWarnings" />
		<plan-review v-if="ps.status !== 'idle'" class="mt-3" :state="ps" :title="t('calibration.backlash_plan')" :role-ok="canEdit" @apply="applied()" @reset="flow.reset()" />
	</div>
</template>

<script>
'use strict'

// Backlash assistant (design 2.6): samples of lost motion from both directions -> mean (preview) -> machine.calc -> M425 through the shared
// plan flow (technician). Always shows the fixed-backlash warning. Pure logic in lib/backlash-calc.js.

import PlanReview from './PlanReview.vue'
import CalcWarnings from './CalcWarnings.vue'
import { planModule } from './plan-module.js'
import { backlashResult, backlashInput, emptyEntry, CALC_BACKLASH, SAMPLES_MAX } from '../lib/backlash-calc.js'

export default {
	components: { PlanReview, CalcWarnings },
	mixins: [planModule()],
	props: {
		api: { type: Object, required: true },
		axes: { type: Array, default: () => [] }, // letters of the axes the board reports
		canEdit: { type: Boolean, default: false } // workshopCan machine.config.apply for config.m425 (technician)
	},
	data() {
		return { axis: '', multiplier: '', max: SAMPLES_MAX, entries: [emptyEntry(), emptyEntry(), emptyEntry()] }
	},
	computed: {
		axisItems() {
			return this.axes.length ? this.axes : ['X', 'Y', 'Z']
		},
		result() {
			return backlashResult(this.axis, this.entries, this.multiplier)
		}
	},
	watch: {
		axisItems: {
			immediate: true,
			handler(items) {
				if (items.indexOf(this.axis) < 0) this.axis = items[0]
			}
		}
	},
	methods: {
		async applied() {
			await this.applyPlan(this.canEdit)
			if (this.ps.status === 'done') this.$emit('changed')
		},
		blank: emptyEntry,
		review() {
			return this.proposeCalc(CALC_BACKLASH, backlashInput(this.axis, this.result, this.multiplier))
		}
	}
}
</script>

<style>
.backlash-field { max-width: 150px; }
</style>
