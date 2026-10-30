<template>
	<div class="history-list">
		<div class="d-flex align-center flex-wrap" style="gap:8px">
			<v-select v-model="filters.kind" :items="kindItems" :label="t('history.filter_kind')" dense hide-details style="max-width:240px" clearable />
			<v-select v-model="filters.state" :items="stateItems" :label="t('history.filter_state')" dense hide-details style="max-width:170px" clearable />
			<v-text-field v-model="filters.user" :label="t('history.filter_user')" dense hide-details style="max-width:170px" />
			<v-menu v-model="fromMenu" :close-on-content-click="false" transition="scale-transition" offset-y min-width="auto">
				<template v-slot:activator="{ on, attrs }">
					<v-text-field v-model="filters.fromDay" :label="t('history.filter_from')" readonly dense hide-details color="primary" style="max-width:170px" v-bind="attrs" v-on="on">
						<template v-slot:prepend-inner>
							<v-icon color="primary">mdi-calendar-outline</v-icon>
						</template>
					</v-text-field>
				</template>
				<v-date-picker v-model="filters.fromDay" no-title color="primary" @input="fromMenu = false" />
			</v-menu>
			<v-menu v-model="toMenu" :close-on-content-click="false" transition="scale-transition" offset-y min-width="auto">
				<template v-slot:activator="{ on, attrs }">
					<v-text-field v-model="filters.toDay" :label="t('history.filter_to')" readonly dense hide-details color="primary" style="max-width:170px" v-bind="attrs" v-on="on">
						<template v-slot:prepend-inner>
							<v-icon color="primary">mdi-calendar-outline</v-icon>
						</template>
					</v-text-field>
				</template>
				<v-date-picker v-model="filters.toDay" no-title color="primary" @input="toMenu = false" />
			</v-menu>
			<v-btn small color="primary" :loading="loading" @click="$emit('apply')"><v-icon small left>mdi-filter-outline</v-icon>{{ t('history.filter_apply') }}</v-btn>
		</div>
		<div v-if="!records.length" class="text-body-2 machine-faint mt-3">{{ loading ? t('common.loading') : t('history.empty') }}</div>
		<v-simple-table v-else dense class="mt-3">
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
					<td><v-checkbox :input-value="r.picked" dense hide-details class="mt-0 pt-0" :aria-label="t('history.col_compare')" @change="$emit('toggle', r.id)" /></td>
					<td class="text-no-wrap">{{ r.dateText }}</td>
					<td>{{ r.kindText }}</td>
					<td>{{ r.user || '-' }}</td>
					<td><v-chip x-small outlined :color="r.state.color"><v-icon x-small left>{{ r.state.icon }}</v-icon>{{ t(r.state.textKey) }}</v-chip></td>
					<td class="text-right"><v-btn x-small text @click="$emit('open', r.id)">{{ t('history.open') }}</v-btn></td>
				</tr>
			</tbody>
		</v-simple-table>
		<div v-if="total > records.length" class="text-caption machine-faint mt-1">{{ t('history.more', { shown: records.length, total }) }}</div>
	</div>
</template>

<script>
'use strict'

// Filters (kind, user, dates) and the table of calibration records. Ticking two rows of the same kind enables the comparison (the
// module owns the state: this component only draws and emits).

import { textMixin } from './text-mixin.js'
import { KNOWN_KINDS, STATES, kindKey, stateView } from '../lib/history.js'
import { formatDate } from '../lib/format.js'

export default {
	mixins: [textMixin],
	props: {
		filters: { type: Object, required: true }, // state.filters, edited in place
		records: { type: Array, default: () => [] },
		selected: { type: Array, default: () => [] },
		total: { type: Number, default: 0 },
		loading: { type: Boolean, default: false }
	},
	data() {
		return { fromMenu: false, toMenu: false }
	},
	computed: {
		kindItems() {
			return KNOWN_KINDS.map(k => ({ value: k, text: this.t(kindKey(k)) }))
		},
		stateItems() {
			return STATES.map(st => ({ value: st, text: this.t(stateView(st).textKey) }))
		},
		rows() {
			return this.records.map(r => ({
				id: r.id, dateText: formatDate(r.ts), kindText: kindKey(r.kind) ? this.t(kindKey(r.kind)) : r.kind, user: r.user, state: stateView(r.state),
				picked: this.selected.indexOf(r.id) >= 0
			}))
		}
	}
}
</script>

<style>
.history-picked { background: rgba(33, 150, 243, 0.12); }
</style>
