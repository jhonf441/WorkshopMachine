<template>
	<div class="maintenance-history">
		<div v-if="!rows.length" class="text-body-2 machine-faint">{{ t('maintenance.no_history') }}</div>
		<v-simple-table v-else dense>
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
					<td>{{ r.user || '-' }}<span v-if="r.role" class="text-caption machine-faint"> ({{ r.role }})</span></td>
				</tr>
			</tbody>
		</v-simple-table>
	</div>
</template>

<script>
'use strict'

// The last-done history: when, which item and who marked it (one row per item: the service keeps the latest mark; older ones are in its audit).

import { textMixin } from './text-mixin.js'
import { formatDate } from '../lib/format.js'

export default {
	mixins: [textMixin],
	props: {
		rows: { type: Array, required: true } // historyRows(...)
	},
	methods: {
		when(ts) {
			return formatDate(ts)
		}
	}
}
</script>
