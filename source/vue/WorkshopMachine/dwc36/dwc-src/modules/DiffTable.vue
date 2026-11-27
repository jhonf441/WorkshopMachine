<template>
	<div class="diff-table">
		<v-switch v-model="onlyChanged" dense hide-details class="mt-1" :label="t('history.only_changed')" />
		<div class="text-body-2 my-1">{{ t('history.changed_count', { n: changed }) }}</div>
		<v-simple-table dense>
			<thead>
				<tr>
					<th class="text-left">{{ t('history.col_value') }}</th>
					<!-- note 5 (2026-11-23): each column says WHICH record it is (its letter and, under it, its date or name), never a bare A / B -->
					<th class="text-right"><span class="diff-col-name">{{ aLabel }}</span><span v-if="aSub" class="diff-col-sub">{{ aSub }}</span></th>
					<th class="text-right"><span class="diff-col-name">{{ bLabel }}</span><span v-if="bSub" class="diff-col-sub">{{ bSub }}</span></th>
					<th class="text-right">{{ bLabel }} - {{ aLabel }}</th>
				</tr>
			</thead>
			<tbody>
				<tr v-for="r in shown" :key="r.path" :class="{ 'compare-changed': r.changed }">
					<td class="record-path">{{ r.path }}<v-icon v-if="r.changed" x-small class="ml-1">mdi-delta</v-icon></td>
					<td class="text-right">{{ r.aText }}</td>
					<td class="text-right">{{ r.bText }}</td>
					<td class="text-right">{{ r.delta === null ? '-' : fmt(r.delta) }}</td>
				</tr>
			</tbody>
		</v-simple-table>
		<div v-if="cut" class="text-caption machine-faint">{{ t('history.diff_cut') }}</div>
	</div>
</template>

<script>
'use strict'

// A table of values side by side with their difference (rows from lib/record-compare.js): the rows that changed are marked with an icon
// and a tint, and the switch hides the equal ones. Used by the comparison of two records and of two offsets snapshots.

import { textMixin } from './text-mixin.js'
import { visibleRows } from '../lib/record-compare.js'
import { formatNumber } from '../lib/format.js'

export default {
	mixins: [textMixin],
	props: {
		rows: { type: Array, required: true },
		changed: { type: Number, default: 0 },
		cut: { type: Boolean, default: false },
		aLabel: { type: String, default: 'A' },
		bLabel: { type: String, default: 'B' },
		aSub: { type: String, default: '' }, // what the column is: the date and person of a record, the name of a copy
		bSub: { type: String, default: '' }
	},
	data() {
		return { onlyChanged: true }
	},
	computed: {
		shown() {
			return visibleRows({ rows: this.rows }, this.onlyChanged)
		}
	},
	methods: {
		fmt(v) {
			return formatNumber(v, 4)
		}
	}
}
</script>

<style>
.compare-changed { background: rgba(255, 193, 7, 0.14); }
.diff-table .diff-col-name { display: block; }
.diff-table .diff-col-sub { display: block; font-size: 12px; font-weight: 400; text-transform: none; letter-spacing: 0; opacity: 0.8; white-space: nowrap; }
</style>
