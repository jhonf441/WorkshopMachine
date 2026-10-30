<template>
	<div class="history-list">
		<div class="d-flex align-center flex-wrap" style="gap:8px">
			<v-select v-model="filters.kind" :items="kindItems" item-title="text" item-value="value" :label="t('history.filter_kind')" density="compact" hide-details style="max-width:240px" clearable />
			<v-select v-model="filters.state" :items="stateItems" item-title="text" item-value="value" :label="t('history.filter_state')" density="compact" hide-details style="max-width:170px" clearable />
			<v-text-field v-model="filters.user" :label="t('history.filter_user')" density="compact" hide-details style="max-width:170px" />
			<v-menu v-model="fromMenu" :close-on-content-click="false" transition="scale-transition" min-width="auto">
				<template #activator="{ props: act }">
					<v-text-field :model-value="filters.fromDay" :label="t('history.filter_from')" readonly density="compact" hide-details color="primary" style="max-width:170px" v-bind="act">
						<template #prepend-inner>
							<v-icon color="primary">mdi-calendar-outline</v-icon>
						</template>
					</v-text-field>
				</template>
				<v-date-picker :model-value="dayDate(filters.fromDay)" color="primary" @update:model-value="pickDay('fromDay', $event); fromMenu = false" />
			</v-menu>
			<v-menu v-model="toMenu" :close-on-content-click="false" transition="scale-transition" min-width="auto">
				<template #activator="{ props: act }">
					<v-text-field :model-value="filters.toDay" :label="t('history.filter_to')" readonly density="compact" hide-details color="primary" style="max-width:170px" v-bind="act">
						<template #prepend-inner>
							<v-icon color="primary">mdi-calendar-outline</v-icon>
						</template>
					</v-text-field>
				</template>
				<v-date-picker :model-value="dayDate(filters.toDay)" color="primary" @update:model-value="pickDay('toDay', $event); toMenu = false" />
			</v-menu>
			<v-btn size="small" color="primary" :loading="loading" @click="$emit('apply')"><v-icon size="small" start>mdi-filter-outline</v-icon>{{ t('history.filter_apply') }}</v-btn>
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
// module owns the state: this component only draws and emits). The date filters stay 'YYYY-MM-DD' texts; the Vuetify 4 date picker
// works with Date objects, so dayDate / pickDay convert at the edge.

import { computed, ref } from 'vue'
import { t } from '../text.js'
import { KNOWN_KINDS, STATES, kindKey, stateView } from '../lib/history.js'
import { formatDate } from '../lib/format.js'

const props = defineProps({
	filters: { type: Object, required: true }, // state.filters, edited in place
	records: { type: Array, default: () => [] },
	selected: { type: Array, default: () => [] },
	total: { type: Number, default: 0 },
	loading: { type: Boolean, default: false }
})
defineEmits(['apply', 'toggle', 'open'])

const fromMenu = ref(false)
const toMenu = ref(false)

const kindItems = computed(() => KNOWN_KINDS.map(k => ({ value: k, text: t(kindKey(k)) })))
const stateItems = computed(() => STATES.map(st => ({ value: st, text: t(stateView(st).textKey) })))
const rows = computed(() => props.records.map(r => ({
	id: r.id, dateText: formatDate(r.ts), kindText: kindKey(r.kind) ? t(kindKey(r.kind)) : r.kind, user: r.user, state: stateView(r.state),
	picked: props.selected.indexOf(r.id) >= 0
})))

// 'YYYY-MM-DD' -> the local Date the picker shows (null when empty or not a day)
function dayDate(text) {
	const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text || '')
	return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null
}
// the picked Date -> 'YYYY-MM-DD' (local day) in the filter
function pickDay(field, date) {
	const d = Array.isArray(date) ? date[0] : date
	if (!(d instanceof Date) || isNaN(d.getTime())) {
		props.filters[field] = ''
		return
	}
	const two = n => String(n).padStart(2, '0')
	props.filters[field] = d.getFullYear() + '-' + two(d.getMonth() + 1) + '-' + two(d.getDate())
}
</script>

<style>
.history-picked { background: rgba(33, 150, 243, 0.12); }
</style>
