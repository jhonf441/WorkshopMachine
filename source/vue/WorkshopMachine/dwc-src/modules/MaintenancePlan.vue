<template>
	<div class="maintenance-plan">
		<div v-if="!rows.length" class="text-body-medium machine-faint">{{ t('maintenance.no_plan') }}</div>
		<v-table v-else density="compact">
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
					<td class="text-no-wrap"><v-chip size="x-small" variant="outlined" :color="r.view.color"><v-icon size="x-small" start>{{ r.view.icon }}</v-icon>{{ t(r.view.textKey) }}</v-chip></td>
					<td>
						<div>{{ r.labelKey ? t(r.labelKey) : r.label || r.id }}</div>
						<div v-if="r.axis" class="text-body-small machine-faint">{{ t('maintenance.axis_of', { axis: r.axis }) }}</div>
					</td>
					<td class="text-no-wrap">{{ intervalText(r) }}</td>
					<td class="text-no-wrap">{{ progressText(r) }}</td>
					<td>
						<span v-if="!r.lastDone" class="machine-faint">{{ t('maintenance.never_done') }}</span>
						<span v-else>{{ t('maintenance.done_by', { when: when(r.lastDone.ts), user: r.lastDone.user || '-' }) }}</span>
					</td>
					<td class="text-right">
						<v-btn size="x-small" color="primary" :disabled="!canMark || !!marking" :loading="marking === r.id" @click="$emit('done', r.id)">
							<v-icon size="x-small" start>mdi-check</v-icon>{{ t('maintenance.mark_done') }}
						</v-btn>
					</td>
				</tr>
			</tbody>
		</v-table>
	</div>
</template>

<script setup>
// The plan with its due markers and the "done" button (who and when are recorded by the service and shown in the last column).

import { t } from '../text.js'
import { formatDate, formatNumber } from '../lib/format.js'

defineProps({
	rows: { type: Array, required: true }, // planRows(...)
	canMark: { type: Boolean, default: false },
	marking: { type: String, default: '' }
})
defineEmits(['done'])

function when(ts) {
	return formatDate(ts)
}
function intervalText(r) {
	const basis = r.interval.unit === 'hours' && r.interval.basis ? ' (' + t('maintenance.basis_' + r.interval.basis) + ')' : ''
	return t('maintenance.every_' + r.interval.unit, { n: formatNumber(r.interval.value, 2) }) + basis
}
function progressText(r) {
	if (r.used === null) return t('maintenance.progress_unknown')
	return t('maintenance.progress', { used: formatNumber(r.used, 1), percent: Math.round((r.ratio || 0) * 100) })
}
</script>
