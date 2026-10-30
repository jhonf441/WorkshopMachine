<template>
	<div class="history-list">
		<div class="d-flex align-center flex-wrap" style="gap:8px">
			<v-select v-model="filters.kind" :items="kindItems" item-title="text" item-value="value" :label="t('history.filter_kind')" density="compact" hide-details style="max-width:240px" clearable />
			<v-select v-model="filters.state" :items="stateItems" item-title="text" item-value="value" :label="t('history.filter_state')" density="compact" hide-details style="max-width:170px" clearable />
			<v-text-field v-model="filters.user" :label="t('history.filter_user')" density="compact" hide-details style="max-width:170px" />
			<range-picker :model-value="filters.range" clearable @update:model-value="pickRange" />
			<v-btn size="small" color="primary" :loading="loading" @click="applyNow"><v-icon size="small" start>mdi-filter-outline</v-icon>{{ t('history.filter_apply') }}</v-btn>
		</div>
		<div v-if="!records.length" class="text-body-medium machine-faint mt-3">{{ loading ? t('common.loading') : t('history.empty') }}</div>
		<v-table v-else density="compact" class="mt-3">
			<thead>
				<tr>
					<th>{{ t('history.col_compare') }}</th>
					<th class="text-left">{{ t('history.col_date') }}</th>
					<th class="text-left">{{ t('history.col_kind') }}</th>
					<th class="text-left">{{ t('history.col_user') }}</th>
					<th class="text-left">{{ t('history.col_state') }}</th>
					<th />
				</tr>
			</thead>
			<tbody>
				<tr v-for="r in rows" :key="r.id" :class="{ 'history-picked': r.picked }">
					<td><v-checkbox :model-value="r.picked" density="compact" hide-details class="mt-0 pt-0" :aria-label="t('history.col_compare')" @update:model-value="$emit('toggle', r.id)" /></td>
					<td class="text-no-wrap">{{ r.dateText }}</td>
					<td>{{ r.kindText }}</td>
					<td>{{ r.user || '-' }}</td>
					<td><v-chip size="x-small" variant="outlined" :color="r.state.color"><v-icon size="x-small" start>{{ r.state.icon }}</v-icon>{{ t(r.state.textKey) }}</v-chip></td>
					<td class="text-right"><v-btn size="x-small" variant="text" @click="$emit('open', r.id)">{{ t('history.open') }}</v-btn></td>
				</tr>
			</tbody>
		</v-table>
		<div v-if="total > records.length" class="text-body-small machine-faint mt-1">{{ t('history.more', { shown: records.length, total }) }}</div>
	</div>
</template>

<script setup>
// Filters (kind, user, dates) and the table of calibration records. Ticking two rows of the same kind enables the comparison (the
// module owns the state: this component only draws and emits). The time range is the one of range-picker.js; applying it fixes the two
// moments (epoch seconds) in the filters, so "the last 3 hours" counts back from the moment of the search.

import { computed } from 'vue'
import { t } from '../text.js'
import { KNOWN_KINDS, STATES, kindKey, stateView } from '../lib/history.js'
import { formatDate } from '../lib/format.js'
import RangePicker from '../RangePicker.vue' // vue/_shared
import { resolve, asEpoch } from '../range-picker.js' // vue/_shared

const props = defineProps({
	filters: { type: Object, required: true }, // state.filters, edited in place
	records: { type: Array, default: () => [] },
	selected: { type: Array, default: () => [] },
	total: { type: Number, default: 0 },
	loading: { type: Boolean, default: false }
})
const emit = defineEmits(['apply', 'toggle', 'open'])

const kindItems = computed(() => KNOWN_KINDS.map(k => ({ value: k, text: t(kindKey(k)) })))
const stateItems = computed(() => STATES.map(st => ({ value: st, text: t(stateView(st).textKey) })))
const rows = computed(() => props.records.map(r => ({
	id: r.id, dateText: formatDate(r.ts), kindText: kindKey(r.kind) ? t(kindKey(r.kind)) : r.kind, user: r.user, state: stateView(r.state),
	picked: props.selected.indexOf(r.id) >= 0
})))

// the range now -> its two moments in the filters, and the list is asked again
function applyNow() {
	const r = props.filters.range ? asEpoch(resolve(props.filters.range, new Date())) : null
	props.filters.sinceEpoch = r ? r.from : null
	props.filters.untilEpoch = r ? r.to : null
	emit('apply')
}
function pickRange(v) {
	props.filters.range = v
	applyNow()
}
</script>

<style>
.history-picked { background: rgba(33, 150, 243, 0.12); }
</style>
