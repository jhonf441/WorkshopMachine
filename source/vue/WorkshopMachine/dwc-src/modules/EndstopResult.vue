<template>
	<div class="endstop-result">
		<div class="d-flex flex-wrap mb-2" style="gap:8px">
			<v-chip v-if="outcome" size="small" variant="flat" :color="outcomeColor"><v-icon size="x-small" start>{{ outcomeIcon }}</v-icon>{{ t(outcome) }}</v-chip>
			<v-chip size="small" variant="outlined" color="success"><v-icon size="x-small" start>mdi-check-circle</v-icon>{{ t('limits.verdict_ok') }}: {{ summary.ok }}</v-chip>
			<v-chip size="small" variant="outlined" color="error"><v-icon size="x-small" start>mdi-close-octagon</v-icon>{{ t('limits.verdict_bad') }}: {{ summary.bad }}</v-chip>
			<v-chip v-if="summary.unknown" size="small" variant="outlined" color="grey"><v-icon size="x-small" start>mdi-help-circle-outline</v-icon>{{ t('limits.verdict_unknown') }}: {{ summary.unknown }}</v-chip>
		</div>
		<v-table density="compact">
			<thead>
				<tr>
					<th class="text-left">{{ t('limits.col_axis') }}</th>
					<th class="text-left">{{ t('limits.col_type') }}</th>
					<th class="text-left">{{ t('limits.col_home_at') }}</th>
					<th class="text-right">{{ t('limits.col_declared') }}</th>
					<th class="text-right">{{ t('limits.col_position') }}</th>
					<th class="text-right">{{ t('limits.col_delta') }}</th>
					<th class="text-left">{{ t('limits.col_checks') }}</th>
					<th class="text-left">{{ t('limits.col_verdict') }}</th>
				</tr>
			</thead>
			<tbody>
				<tr v-for="r in list" :key="r.axis">
					<td>{{ r.axis }}</td>
					<td>{{ r.type || '-' }}</td>
					<td>{{ r.homeAt || '-' }}</td>
					<td class="text-right">{{ fmt(r.declared) }}</td>
					<td class="text-right">{{ fmt(r.position) }}</td>
					<td class="text-right">{{ fmt(r.delta) }}</td>
					<td>
						<span v-for="c in r.checks" :key="c.id" class="endstop-check" :title="t(c.textKey)">
							<v-icon size="x-small" :color="c.color">{{ c.icon }}</v-icon>{{ t(c.textKey) }}
						</span>
					</td>
					<td><v-chip size="x-small" variant="outlined" :color="r.color"><v-icon size="x-small" start>{{ r.icon }}</v-icon>{{ t(r.textKey) }}</v-chip></td>
				</tr>
			</tbody>
		</v-table>
		<div v-if="result.tolerance !== null" class="text-body-small machine-faint mt-1">{{ t('limits.verify_tolerance', { mm: result.tolerance }) }}</div>
	</div>
</template>

<script setup>
// Result table of the endstop verification run: per axis the endstop, where it homes, where the axis ended against what is declared, the
// four checks (each with icon and word) and the verdict (icon and word as well as colour).

import { computed } from 'vue'
import { t } from '../text.js'
import { verifyRows, verifySummary, outcomeKey } from '../lib/limits.js'
import { formatNumber } from '../lib/format.js'

const OUTCOME = { ok: ['success', 'mdi-check-circle'], warn: ['warning', 'mdi-alert'], failed: ['error', 'mdi-close-octagon'] }

const props = defineProps({ result: { type: Object, required: true } }) // normalizeVerify(...)

const list = computed(() => verifyRows(props.result))
const summary = computed(() => verifySummary(props.result))
const outcome = computed(() => outcomeKey(props.result))
const outcomeColor = computed(() => (OUTCOME[props.result.outcome] || ['grey'])[0])
const outcomeIcon = computed(() => (OUTCOME[props.result.outcome] || [null, 'mdi-help-circle-outline'])[1])

function fmt(v) {
	return formatNumber(v, 3)
}
</script>


<style>
.endstop-check { display: inline-flex; align-items: center; margin-right: 8px; font-size: 12px; white-space: nowrap; }
</style>
