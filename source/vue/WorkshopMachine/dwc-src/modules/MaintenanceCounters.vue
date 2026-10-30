<template>
	<div class="maintenance-counters">
		<v-table density="compact">
			<thead>
				<tr>
					<th class="text-left">{{ t('maintenance.col_axis') }}</th>
					<th class="text-right">{{ t('maintenance.col_power_on') }}</th>
					<th class="text-right">{{ t('maintenance.col_moving') }}</th>
					<th class="text-right">{{ t('maintenance.col_distance') }}</th>
				</tr>
			</thead>
			<tbody>
				<tr v-for="r in rows" :key="r.axis || 'machine'">
					<td>{{ r.whole ? t('maintenance.whole_machine') : r.axis }}</td>
					<td class="text-right">{{ num(r.powerOnH, 1) }}</td>
					<td class="text-right">{{ num(r.movingH, 1) }}</td>
					<td class="text-right">{{ num(r.distanceM, 1) }}</td>
				</tr>
			</tbody>
		</v-table>
		<div v-if="!data.running" class="text-body-small text-warning mt-1">{{ t('maintenance.not_counting') }}</div>
		<div v-else-if="data.since" class="text-body-small machine-faint mt-1">{{ t('maintenance.counting_since', { when: when(data.since) }) }}</div>
		<div v-if="data.gaps || data.jumps" class="text-body-small machine-faint">{{ t('maintenance.gaps', { gaps: data.gaps, jumps: data.jumps }) }}</div>
		<div v-if="cross" class="text-body-small machine-faint">{{ t(cross.textKey, { ratio: num(cross.ratio, 2) }) }}</div>
	</div>
</template>

<script setup>
// The counters table: power-on hours, moving hours and ESTIMATED distance (m) for the whole machine and for each axis, with how the service
// counted (since when, gaps it skipped, the cross-check against the planned path of the last job).

import { computed } from 'vue'
import { t } from '../text.js'
import { formatNumber, formatDate } from '../lib/format.js'
import { crosscheckView } from '../lib/maintenance.js'

const props = defineProps({
	rows: { type: Array, required: true }, // counterRows(...)
	data: { type: Object, required: true } // normalizeMaintenance(...).counters
})

const cross = computed(() => crosscheckView(props.data.crosscheck))

function num(v, decimals) {
	return typeof v === 'number' ? formatNumber(v, decimals) : '-'
}
function when(ts) {
	return formatDate(ts)
}
</script>
