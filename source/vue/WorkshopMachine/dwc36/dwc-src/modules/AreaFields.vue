<template>
	<div class="area-fields">
		<div class="d-flex align-center flex-wrap mb-2" style="gap:8px">
			<span class="text-subtitle-2">{{ t('workarea.card_title', { mode }) }}</span>
			<v-chip x-small label outlined :color="saved ? 'success' : 'info'">{{ saved ? t('workarea.saved') : t('workarea.not_measured') }}</v-chip>
			<span v-if="size" class="text-caption machine-faint">{{ t('workarea.size', size) }}</span>
		</div>
		<v-simple-table dense class="area-table">
			<thead>
				<tr><th></th><th class="text-right">{{ t('workarea.col_min') }}</th><th class="text-right">{{ t('workarea.col_max') }}</th></tr>
			</thead>
			<tbody>
				<tr v-for="row in rows" :key="row.axis">
					<td>{{ t(row.label) }}</td>
					<td v-for="k in row.keys" :key="k" class="text-right">
						<v-text-field
							:value="draft[k]" dense outlined hide-details class="area-field" inputmode="decimal" :error="invalid"
							:disabled="!canWrite" :aria-label="row.axis + ' ' + k.slice(1).toLowerCase()" suffix="mm" @input="v => $emit('field', k, v)"
						/>
					</td>
				</tr>
			</tbody>
		</v-simple-table>
		<div v-for="p in problems" :key="p" class="text-caption error--text mt-1">{{ t(p, { min: minMm, reach: reachText }) }}</div>
		<div v-if="dirty && !problems.length" class="text-caption machine-faint mt-1">{{ t('workarea.unsaved') }}</div>
		<div v-if="canWrite" class="d-flex align-center flex-wrap mt-3" style="gap:8px">
			<v-btn small color="primary" :disabled="!valid || !dirty || busy" :loading="working === 'save'" @click="$emit('save')">{{ t('workarea.save') }}</v-btn>
			<v-btn small text :disabled="!dirty || busy" @click="$emit('undo')">{{ t('workarea.undo') }}</v-btn>
			<v-spacer />
			<v-btn small outlined color="error" :disabled="!saved || busy" :loading="working === 'remove'" @click="$emit('remove')">{{ t('workarea.remove') }}</v-btn>
		</div>
	</div>
</template>

<script>
'use strict'

// The numbers of the area of one mode: four boxes (X and Y, minimum and maximum), what is wrong with them and the buttons that save, undo or remove.

import { textMixin } from './text-mixin.js'
import { sizeOf } from '../lib/workarea.js'

export default {
	mixins: [textMixin],
	props: {
		mode: { type: String, required: true },
		draft: { type: Object, required: true }, // {xMin, xMax, yMin, yMax} as text
		saved: { type: Object, default: null }, // the saved rectangle of the mode or null
		problems: { type: Array, default: () => [] }, // keys of workarea.err_*
		reach: { type: Object, default: null },
		minMm: { type: Number, default: 10 },
		dirty: { type: Boolean, default: false },
		valid: { type: Boolean, default: false },
		working: { type: String, default: '' },
		canWrite: { type: Boolean, default: false }
	},
	data() {
		return { rows: [{ axis: 'X', label: 'workarea.x', keys: ['xMin', 'xMax'] }, { axis: 'Y', label: 'workarea.y', keys: ['yMin', 'yMax'] }] }
	},
	computed: {
		busy() {
			return !!this.working
		},
		invalid() {
			return this.problems.length > 0
		},
		size() {
			return sizeOf(this.saved)
		},
		reachText() {
			return this.reach ? 'X ' + this.reach.xMin + ' / ' + this.reach.xMax + ', Y ' + this.reach.yMin + ' / ' + this.reach.yMax : ''
		}
	}
}
</script>

<style>
.area-field { max-width: 150px; margin-left: auto; }
</style>
