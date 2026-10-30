<template>
	<div class="level-passes">
		<v-table density="compact">
			<thead>
				<tr>
					<th class="text-left">{{ t('level.col_pass') }}</th>
					<th class="text-right">{{ t('level.col_before') }}</th>
					<th class="text-right">{{ t('level.col_after') }}</th>
					<th class="text-right">{{ t('level.col_mean') }}</th>
					<th class="text-left">{{ t('level.col_corrected') }}</th>
					<th class="text-left">{{ t('level.col_ok') }}</th>
				</tr>
			</thead>
			<tbody>
				<tr v-for="r in rows" :key="r.n">
					<td>{{ r.n }}</td>
					<td class="text-right">{{ mm(r.before) }}</td>
					<td class="text-right">{{ mm(r.after) }}</td>
					<td class="text-right">{{ mm(r.mean) }}</td>
					<td>{{ r.corrected ? t('common.yes') : t('common.no') }}</td>
					<td>
						<v-icon v-if="r.withinTolerance !== null" size="small" :color="r.withinTolerance ? 'success' : 'warning'">{{ r.withinTolerance ? 'mdi-check-circle' : 'mdi-alert-circle-outline' }}</v-icon>
						<span v-if="r.withinTolerance !== null" class="ml-1">{{ r.withinTolerance ? t('common.yes') : t('common.no') }}</span>
					</td>
				</tr>
			</tbody>
		</v-table>
		<v-alert v-if="summary" density="compact" variant="outlined" class="mt-3" :type="alertType">
			<div>{{ t('level.trend_' + summary.trend) }}</div>
			<div v-if="summary.final !== null && summary.tolerance !== null" class="text-body-small">{{ t('level.final', { value: mm(summary.final), tol: summary.tolerance }) }}</div>
		</v-alert>
	</div>
</template>

<script setup>
// Per-pass table of a levelling run (deviation before and after each pass) and the conclusion under it. Leaf component: `result` is
// the result of the run, the maths are in lib/level.js.

import { computed } from 'vue'
import { t } from '../text.js'
import { passRows, summaryOf } from '../lib/level.js'

const ALERTS = { converged: 'success', diverging: 'error', stalled: 'warning', unknown: 'info' }

const props = defineProps({
	result: { type: Object, required: true }
})

const rows = computed(() => passRows(props.result))
const summary = computed(() => summaryOf(props.result, rows.value))
const alertType = computed(() => ALERTS[summary.value && summary.value.trend] || 'info')

function mm(v) {
	return typeof v === 'number' ? v.toFixed(3) : '-'
}
</script>

