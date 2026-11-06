<template>
	<div class="offsets-table">
		<div v-if="!sets.length" class="text-body-2 machine-faint">{{ emptyText }}</div>
		<v-simple-table v-else dense>
			<thead>
				<tr>
					<th class="text-left">{{ firstColumn }}</th>
					<th v-for="a in axes" :key="a" class="text-right offsets-axis">{{ a }} (mm)</th>
					<th v-if="perRow" class="offsets-action" />
				</tr>
			</thead>
			<tbody>
				<tr v-for="s in sets" :key="keyOf(s)" :class="{ 'offsets-current': keyOf(s) === current }">
					<td class="text-no-wrap">
						{{ label(s) }}<v-chip v-if="keyOf(s) === current" x-small outlined class="ml-1">{{ t('offsets.current') }}</v-chip>
						<!-- MA-2 / A8: what state this row is in -- being reviewed, edited and not saved, or just saved -->
						<v-chip v-if="rowState(s)" x-small outlined class="ml-1" :color="rowState(s) === 'saved' ? 'success' : rowState(s) === 'reviewing' ? 'info' : 'warning'">{{ t(ROW_TEXT[rowState(s)]) }}</v-chip>
					</td>
					<td v-for="a in axes" :key="a" class="text-right offsets-axis">
						<v-text-field
							v-if="editable && s.offsets[a] !== undefined && s.offsets[a] !== null" v-model="draft[keyOf(s)][a]" dense outlined hide-details
							class="offsets-field" :error="bad(s, a)" :aria-label="label(s) + ' ' + a"
						/>
						<span v-else>{{ format(s.offsets[a]) }}</span>
					</td>
					<td v-if="perRow" class="text-right">
						<v-btn x-small outlined :disabled="!rowReady(s)" :title="t('offsets.review_tip')" @click="$emit('review', keyOf(s))">{{ t('offsets.review') }}</v-btn>
					</td>
				</tr>
			</tbody>
		</v-simple-table>
		<div v-if="editable && hasErrors" class="text-caption error--text mt-1">{{ t('offsets.err_value') }}</div>
	</div>
</template>

<script>
'use strict'

// A table of offsets (tools or work coordinate systems): read-only, or one text field per axis when the person may write. The draft is
// edited in place (state.drafts); the pure checks are in lib/offsets.js.

import { textMixin } from './text-mixin.js'
import { keyOf, setLabel, parseOffset, changedSets, toolChange } from '../lib/offsets.js'
import { formatNumber } from '../lib/format.js'

// the text of each state of a row
const ROW_TEXT = { unsaved: 'offsets.row_unsaved', reviewing: 'offsets.row_reviewing', saved: 'offsets.row_saved' }

export default {
	mixins: [textMixin],
	props: {
		sets: { type: Array, default: () => [] },
		axes: { type: Array, default: () => [] },
		draft: { type: Object, required: true },
		editable: { type: Boolean, default: false },
		current: { type: String, default: '' },
		firstColumn: { type: String, default: '' },
		emptyText: { type: String, default: '' },
		perRow: { type: Boolean, default: false }, // a review button on every row (the tools: one plan per tool)
		reviewing: { type: String, default: '' }, // the key of the row whose plan is open
		saved: { type: String, default: '' } // the key of the row that was just applied
	},
	data() {
		return { ROW_TEXT }
	},
	computed: {
		hasErrors() {
			return this.sets.some(s => this.axes.some(a => this.bad(s, a)))
		}
	},
	methods: {
		keyOf,
		label: setLabel,
		format(v) {
			return formatNumber(v, 3)
		},
		// the row has a valid change to review
		rowReady(set) {
			return !!toolChange(changedSets([set], this.draft, this.axes), keyOf(set))
		},
		// 'reviewing' (its plan is open) | 'unsaved' (edited, valid, not applied) | 'saved' (just applied) | '' -- only on the rows that have a button
		rowState(set) {
			if (!this.perRow) return ''
			const key = keyOf(set)
			if (key === this.reviewing) return 'reviewing'
			if (this.rowReady(set)) return 'unsaved'
			return key === this.saved ? 'saved' : ''
		},
		bad(set, axis) {
			if (set.offsets[axis] === undefined || set.offsets[axis] === null) return false
			const row = this.draft[keyOf(set)]
			return !row || parseOffset(row[axis]) === null
		}
	}
}
</script>

<style>
.offsets-current { background: rgba(33, 150, 243, 0.1); }
.offsets-field { max-width: 110px; margin-left: auto; }
/* MA-1: the number sits at the right of its column, under the right-aligned header (a text field starts its text at the left), and every axis column
   has the same width whatever it holds */
.offsets-field input { text-align: right; }
.offsets-table .v-data-table__wrapper table { table-layout: fixed; min-width: 640px; }
.offsets-table .offsets-axis { width: 130px; }
.offsets-table .offsets-action { width: 150px; }
</style>
