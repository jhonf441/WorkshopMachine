<template>
	<div class="endstop-result">
		<div class="d-flex flex-wrap mb-2" style="gap:8px">
			<v-chip v-if="outcome" small dark :color="outcomeColor"><v-icon x-small left>{{ outcomeIcon }}</v-icon>{{ t(outcome) }}</v-chip>
			<v-chip small outlined color="success"><v-icon x-small left>mdi-check-circle</v-icon>{{ t('limits.verdict_ok') }}: {{ summary.ok }}</v-chip>
			<v-chip small outlined color="error"><v-icon x-small left>mdi-close-octagon</v-icon>{{ t('limits.verdict_bad') }}: {{ summary.bad }}</v-chip>
			<v-chip v-if="summary.unknown" small outlined color="grey"><v-icon x-small left>mdi-help-circle-outline</v-icon>{{ t('limits.verdict_unknown') }}: {{ summary.unknown }}</v-chip>
		</div>
		<v-simple-table dense>
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
							<v-icon x-small :color="c.color">{{ c.icon }}</v-icon>{{ t(c.textKey) }}
						</span>
					</td>
					<td><v-chip x-small outlined :color="r.color"><v-icon x-small left>{{ r.icon }}</v-icon>{{ t(r.textKey) }}</v-chip></td>
				</tr>
			</tbody>
		</v-simple-table>
		<div v-if="result.tolerance !== null" class="text-caption machine-faint mt-1">{{ t('limits.verify_tolerance', { mm: result.tolerance }) }}</div>
	</div>
</template>

<script>
'use strict'

// Result table of the endstop verification run: per axis the endstop, where it homes, where the axis ended against what is declared, the
// four checks (each with icon and word) and the verdict (icon and word as well as colour).

import { textMixin } from './text-mixin.js'
import { verifyRows, verifySummary, outcomeKey } from '../lib/limits.js'
import { formatNumber } from '../lib/format.js'

const OUTCOME = { ok: ['success', 'mdi-check-circle'], warn: ['warning', 'mdi-alert'], failed: ['error', 'mdi-close-octagon'] }

export default {
	mixins: [textMixin],
	props: { result: { type: Object, required: true } }, // normalizeVerify(...)
	computed: {
		list() {
			return verifyRows(this.result)
		},
		summary() {
			return verifySummary(this.result)
		},
		outcome() {
			return outcomeKey(this.result)
		},
		outcomeColor() {
			return (OUTCOME[this.result.outcome] || ['grey'])[0]
		},
		outcomeIcon() {
			return (OUTCOME[this.result.outcome] || [null, 'mdi-help-circle-outline'])[1]
		}
	},
	methods: {
		fmt(v) {
			return formatNumber(v, 3)
		}
	}
}
</script>

<style>
.endstop-check { display: inline-flex; align-items: center; margin-right: 8px; font-size: 12px; white-space: nowrap; }
</style>
