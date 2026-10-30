<template>
	<div class="maintenance-counters">
		<v-simple-table dense>
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
		</v-simple-table>
		<div v-if="!data.running" class="text-caption warning--text mt-1">{{ t('maintenance.not_counting') }}</div>
		<div v-else-if="data.since" class="text-caption machine-faint mt-1">{{ t('maintenance.counting_since', { when: when(data.since) }) }}</div>
		<div v-if="data.gaps || data.jumps" class="text-caption machine-faint">{{ t('maintenance.gaps', { gaps: data.gaps, jumps: data.jumps }) }}</div>
		<div v-if="cross" class="text-caption machine-faint">{{ t(cross.textKey, { ratio: num(cross.ratio, 2) }) }}</div>
	</div>
</template>

<script>
'use strict'

// The counters table: power-on hours, moving hours and ESTIMATED distance (m) for the whole machine and for each axis, with how the service
// counted (since when, gaps it skipped, the cross-check against the planned path of the last job).

import { textMixin } from './text-mixin.js'
import { formatNumber, formatDate } from '../lib/format.js'
import { crosscheckView } from '../lib/maintenance.js'

export default {
	mixins: [textMixin],
	props: {
		rows: { type: Array, required: true }, // counterRows(...)
		data: { type: Object, required: true } // normalizeMaintenance(...).counters
	},
	computed: {
		cross() {
			return crosscheckView(this.data.crosscheck)
		}
	},
	methods: {
		num(v, decimals) {
			return typeof v === 'number' ? formatNumber(v, decimals) : '-'
		},
		when(ts) {
			return formatDate(ts)
		}
	}
}
</script>
