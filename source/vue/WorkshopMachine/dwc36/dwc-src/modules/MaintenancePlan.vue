<template>
	<div class="maintenance-plan">
		<div v-if="!rows.length" class="text-body-2 machine-faint">{{ t('maintenance.no_plan') }}</div>
		<v-simple-table v-else dense>
			<thead>
				<tr>
					<th class="text-left">{{ t('maintenance.col_state') }}</th>
					<th class="text-left">{{ t('maintenance.col_item') }}</th>
					<th class="text-left">{{ t('maintenance.col_interval') }}</th>
					<th class="text-left">{{ t('maintenance.col_progress') }}</th>
					<th class="text-left">{{ t('maintenance.col_last') }}</th>
					<th></th>
				</tr>
			</thead>
			<tbody>
				<tr v-for="r in rows" :key="r.id">
					<td class="text-no-wrap"><v-chip x-small outlined :color="r.view.color"><v-icon x-small left>{{ r.view.icon }}</v-icon>{{ t(r.view.textKey) }}</v-chip></td>
					<td>
						<div>{{ r.labelKey ? t(r.labelKey) : r.label || r.id }}</div>
						<div v-if="r.axis" class="text-caption machine-faint">{{ t('maintenance.axis_of', { axis: r.axis }) }}</div>
					</td>
					<td class="text-no-wrap">{{ intervalText(r) }}</td>
					<td class="text-no-wrap">{{ progressText(r) }}</td>
					<td>
						<span v-if="!r.lastDone" class="machine-faint">{{ t('maintenance.never_done') }}</span>
						<span v-else>{{ t('maintenance.done_by', { when: when(r.lastDone.ts), user: r.lastDone.user || '-' }) }}</span>
					</td>
					<td class="text-right">
						<v-btn x-small color="primary" :disabled="!canMark || !!marking" :loading="marking === r.id" @click="$emit('done', r.id)">
							<v-icon x-small left>mdi-check</v-icon>{{ t('maintenance.mark_done') }}
						</v-btn>
					</td>
				</tr>
			</tbody>
		</v-simple-table>
	</div>
</template>

<script>
'use strict'

// The plan with its due markers and the "done" button (who and when are recorded by the service and shown in the last column).

import { textMixin } from './text-mixin.js'
import { formatDate, formatNumber } from '../lib/format.js'

export default {
	mixins: [textMixin],
	props: {
		rows: { type: Array, required: true }, // planRows(...)
		canMark: { type: Boolean, default: false },
		marking: { type: String, default: '' }
	},
	methods: {
		when(ts) {
			return formatDate(ts)
		},
		intervalText(r) {
			const basis = r.interval.unit === 'hours' && r.interval.basis ? ' (' + this.t('maintenance.basis_' + r.interval.basis) + ')' : ''
			return this.t('maintenance.every_' + r.interval.unit, { n: formatNumber(r.interval.value, 2) }) + basis
		},
		progressText(r) {
			if (r.used === null) return this.t('maintenance.progress_unknown')
			return this.t('maintenance.progress', { used: formatNumber(r.used, 1), percent: Math.round((r.ratio || 0) * 100) })
		}
	}
}
</script>
