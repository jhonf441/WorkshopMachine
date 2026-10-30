<template>
	<div class="diff-table">
		<v-switch v-model="onlyChanged" density="compact" hide-details class="mt-1" :label="t('history.only_changed')" />
		<div class="text-body-medium my-1">{{ t('history.changed_count', { n: changed }) }}</div>
		<v-table density="compact">
			<thead>
				<tr>
					<th class="text-left">{{ t('history.col_value') }}</th>
					<th class="text-right">{{ aLabel }}</th>
					<th class="text-right">{{ bLabel }}</th>
					<th class="text-right">{{ bLabel }} - {{ aLabel }}</th>
				</tr>
			</thead>
			<tbody>
				<tr v-for="r in shown" :key="r.path" :class="{ 'compare-changed': r.changed }">
					<td class="record-path">{{ r.path }}<v-icon v-if="r.changed" size="x-small" class="ml-1">mdi-delta</v-icon></td>
					<td class="text-right">{{ r.aText }}</td>
					<td class="text-right">{{ r.bText }}</td>
					<td class="text-right">{{ r.delta === null ? '-' : fmt(r.delta) }}</td>
				</tr>
			</tbody>
		</v-table>
		<div v-if="cut" class="text-body-small machine-faint">{{ t('history.diff_cut') }}</div>
	</div>
</template>

<script setup>
// A table of values side by side with their difference (rows from lib/record-compare.js): the rows that changed are marked with an icon
// and a tint, and the switch hides the equal ones. Used by the comparison of two records and of two offsets snapshots.

import { computed, ref } from 'vue'
import { t } from '../text.js'
import { visibleRows } from '../lib/record-compare.js'
import { formatNumber } from '../lib/format.js'

const props = defineProps({
	rows: { type: Array, required: true },
	changed: { type: Number, default: 0 },
	cut: { type: Boolean, default: false },
	aLabel: { type: String, default: 'A' },
	bLabel: { type: String, default: 'B' }
})

const onlyChanged = ref(true)
const shown = computed(() => visibleRows({ rows: props.rows }, onlyChanged.value))

function fmt(v) {
	return formatNumber(v, 4)
}
</script>

<style>
.compare-changed { background: rgba(255, 193, 7, 0.14); }
</style>
