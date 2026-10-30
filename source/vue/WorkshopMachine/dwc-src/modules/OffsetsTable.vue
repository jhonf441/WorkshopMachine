<template>
	<div class="offsets-table">
		<div v-if="!sets.length" class="text-body-medium machine-faint">{{ emptyText }}</div>
		<v-table v-else density="compact">
			<thead>
				<tr>
					<th class="text-left">{{ firstColumn }}</th>
					<th v-for="a in axes" :key="a" class="text-right">{{ a }} (mm)</th>
					<th v-if="perRow" />
				</tr>
			</thead>
			<tbody>
				<tr v-for="s in sets" :key="keyOf(s)" :class="{ 'offsets-current': keyOf(s) === current }">
					<td class="text-no-wrap">{{ label(s) }}<v-chip v-if="keyOf(s) === current" size="x-small" variant="outlined" class="ml-1">{{ t('offsets.current') }}</v-chip></td>
					<td v-for="a in axes" :key="a" class="text-right">
						<v-text-field
							v-if="editable && s.offsets[a] !== undefined && s.offsets[a] !== null" v-model="draft[keyOf(s)][a]" density="compact" variant="outlined" hide-details
							class="offsets-field" :error="bad(s, a)" :aria-label="label(s) + ' ' + a"
						/>
						<span v-else>{{ format(s.offsets[a]) }}</span>
					</td>
					<td v-if="perRow" class="text-right">
						<v-btn size="x-small" variant="outlined" :disabled="!rowReady(s)" @click="$emit('review', keyOf(s))">{{ t('offsets.review') }}</v-btn>
					</td>
				</tr>
			</tbody>
		</v-table>
		<div v-if="editable && hasErrors" class="text-body-small text-error mt-1">{{ t('offsets.err_value') }}</div>
	</div>
</template>

<script setup>
// A table of offsets (tools or work coordinate systems): read-only, or one text field per axis when the person may write. The draft is
// edited in place (state.drafts); the pure checks are in lib/offsets.js.

import { computed } from 'vue'
import { t } from '../text.js'
import { keyOf, setLabel, parseOffset, changedSets, toolChange } from '../lib/offsets.js'
import { formatNumber } from '../lib/format.js'

const props = defineProps({
	sets: { type: Array, default: () => [] },
	axes: { type: Array, default: () => [] },
	draft: { type: Object, required: true },
	editable: { type: Boolean, default: false },
	current: { type: String, default: '' },
	firstColumn: { type: String, default: '' },
	emptyText: { type: String, default: '' },
	perRow: { type: Boolean, default: false } // a review button on every row (the tools: one plan per tool)
})
defineEmits(['review'])

const label = setLabel

function format(v) {
	return formatNumber(v, 3)
}
// the row has a valid change to review
function rowReady(set) {
	return !!toolChange(changedSets([set], props.draft, props.axes), keyOf(set))
}
function bad(set, axis) {
	if (set.offsets[axis] === undefined || set.offsets[axis] === null) return false
	const row = props.draft[keyOf(set)]
	return !row || parseOffset(row[axis]) === null
}
const hasErrors = computed(() => props.sets.some(s => props.axes.some(a => bad(s, a))))
</script>

<style>
.offsets-current { background: rgba(33, 150, 243, 0.1); }
.offsets-field { max-width: 110px; margin-left: auto; }
</style>
