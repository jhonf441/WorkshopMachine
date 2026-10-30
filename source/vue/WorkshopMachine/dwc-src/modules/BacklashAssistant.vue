<template>
	<div class="backlash-assistant">
		<p class="text-body-medium machine-faint">{{ t('calibration.backlash_intro') }}</p>
		<v-alert density="compact" variant="outlined" type="warning" class="mb-3">{{ t('calibration.backlash_fixed') }}</v-alert>
		<div class="d-flex flex-wrap align-center" style="gap:12px">
			<v-select v-model="axis" :items="axisItems" :label="t('calibration.axis')" density="compact" variant="outlined" hide-details style="max-width:120px" />
			<v-text-field v-model="multiplier" :label="t('calibration.backlash_multiplier')" density="compact" variant="outlined" hide-details style="max-width:200px" :hint="t('calibration.backlash_multiplier_hint')" />
		</div>
		<v-table density="compact" class="mt-3">
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
					<td><v-text-field v-model="e.plus" density="compact" variant="outlined" hide-details class="backlash-field" suffix="mm" :aria-label="t('calibration.backlash_plus')" /></td>
					<td><v-text-field v-model="e.minus" density="compact" variant="outlined" hide-details class="backlash-field" suffix="mm" :aria-label="t('calibration.backlash_minus')" /></td>
					<td><v-btn size="x-small" icon :disabled="entries.length < 2" :title="t('calibration.backlash_remove')" @click="entries.splice(i, 1)"><v-icon size="x-small">mdi-close</v-icon></v-btn></td>
				</tr>
			</tbody>
		</v-table>
		<v-btn size="small" variant="text" class="mt-1" :disabled="entries.length >= max" @click="entries.push(blank())"><v-icon size="small" start>mdi-plus</v-icon>{{ t('calibration.backlash_add') }}</v-btn>
		<v-alert v-if="result.errorKey" density="compact" variant="outlined" type="warning" class="mt-3">{{ t(result.errorKey) }}</v-alert>
		<v-card v-if="result.n" variant="outlined" class="mt-3">
			<v-card-text>
				<div class="text-body-medium">{{ t('calibration.backlash_stats', { n: result.n, mean: result.mean, stdev: result.stdev, min: result.min, max: result.max }) }}</div>
				<div class="text-title-medium mt-1">{{ t('calibration.backlash_new', { line: result.line }) }}</div>
				<v-alert v-if="result.inconsistent && !calc" density="compact" variant="outlined" type="warning" class="mt-2 mb-0">{{ t('calibration.warn_inconsistent') }}</v-alert>
				<v-alert v-if="result.big && !calc" density="compact" variant="outlined" type="warning" class="mt-2 mb-0">{{ t('calibration.warn_big_backlash') }}</v-alert>
			</v-card-text>
		</v-card>
		<div class="d-flex align-center flex-wrap mt-3" style="gap:8px">
			<v-btn size="small" color="primary" :disabled="!result.ok || flowBusy" @click="review()">{{ t('calibration.review') }}</v-btn>
		</div>
		<calc-warnings :rows="calcWarnings" />
		<plan-review v-if="ps.status !== 'idle'" class="mt-3" :state="ps" :title="t('calibration.backlash_plan')" :role-ok="canEdit" @apply="applied()" @reset="flow.reset()" />
	</div>
</template>

<script setup>
// Backlash assistant (design 2.6): samples of lost motion from both directions -> mean (preview) -> machine.calc -> M425 through the shared
// plan flow (technician). Always shows the fixed-backlash warning. Pure logic in lib/backlash-calc.js.

import { computed, ref, watch } from 'vue'
import PlanReview from './PlanReview.vue'
import CalcWarnings from './CalcWarnings.vue'
import { t } from '../text.js'
import { usePlanModule } from './use-plan-module.js'
import { backlashResult, backlashInput, emptyEntry, CALC_BACKLASH, SAMPLES_MAX } from '../lib/backlash-calc.js'

const props = defineProps({
	api: { type: Object, required: true },
	axes: { type: Array, default: () => [] }, // letters of the axes the board reports
	canEdit: { type: Boolean, default: false } // workshopCan machine.config.apply for config.m425 (technician)
})
const emit = defineEmits(['changed'])

const { ps, flow, calc, flowBusy, calcWarnings, proposeCalc, applyPlan } = usePlanModule(props)

const axis = ref('')
const multiplier = ref('')
const max = SAMPLES_MAX
const entries = ref([emptyEntry(), emptyEntry(), emptyEntry()])
const blank = emptyEntry

const axisItems = computed(() => (props.axes.length ? props.axes : ['X', 'Y', 'Z']))
const result = computed(() => backlashResult(axis.value, entries.value, multiplier.value))

watch(axisItems, items => {
	if (items.indexOf(axis.value) < 0) axis.value = items[0]
}, { immediate: true })

async function applied() {
	await applyPlan(props.canEdit)
	if (ps.status === 'done') emit('changed')
}
function review() {
	return proposeCalc(CALC_BACKLASH, backlashInput(axis.value, result.value, multiplier.value))
}
</script>

<style>
.backlash-field { max-width: 150px; }
</style>
