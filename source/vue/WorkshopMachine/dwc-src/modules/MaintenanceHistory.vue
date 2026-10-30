<template>
	<div class="maintenance-history">
		<div v-if="!rows.length" class="text-body-medium machine-faint">{{ t('maintenance.no_history') }}</div>
		<v-table v-else density="compact">
			<thead>
				<tr>
					<th class="text-left">{{ t('maintenance.col_when') }}</th>
					<th class="text-left">{{ t('maintenance.col_item') }}</th>
					<th class="text-left">{{ t('maintenance.col_who') }}</th>
				</tr>
			</thead>
			<tbody>
				<tr v-for="r in rows" :key="r.id">
					<td class="text-no-wrap">{{ when(r.ts) }}</td>
					<td>{{ r.labelKey ? t(r.labelKey) : r.label || r.id }}</td>
					<td>{{ r.user || '-' }}<span v-if="r.role" class="text-body-small machine-faint"> ({{ r.role }})</span></td>
				</tr>
			</tbody>
		</v-table>
	</div>
</template>

<script setup>
// The last-done history: when, which item and who marked it (one row per item: the service keeps the latest mark; older ones are in its audit).

import { t } from '../text.js'
import { formatDate } from '../lib/format.js'

defineProps({
	rows: { type: Array, required: true } // historyRows(...)
})

function when(ts) {
	return formatDate(ts)
}
</script>
