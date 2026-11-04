<template>
	<div class="area-fields">
		<div class="d-flex align-center flex-wrap mb-2" style="gap:8px">
			<span class="text-subtitle-2">{{ t('workarea.card_title', { mode }) }}</span>
			<v-chip x-small label outlined :color="saved ? 'success' : 'info'">{{ saved ? t('workarea.saved') : t('workarea.not_measured') }}</v-chip>
			<span v-if="size" class="text-caption machine-faint">{{ t('workarea.size', size) }}</span>
		</div>
		<div class="area-grid" role="group" :aria-label="t('workarea.card_title', { mode })">
			<span></span>
			<span class="area-head">{{ t('workarea.col_min') }}</span>
			<span class="area-head">{{ t('workarea.col_max') }}</span>
			<template v-for="row in rows">
				<span :key="row.axis + '-label'" class="area-axis">{{ t(row.label) }}</span>
				<v-text-field
					v-for="k in row.keys" :key="k"
					:value="draft[k]" type="number" step="any" dense outlined hide-details class="area-field" inputmode="decimal" :error="fieldBad(k)"
					:disabled="!canWrite" :aria-label="row.axis + ' ' + k.slice(1).toLowerCase()" suffix="mm" @keydown="blockExponent" @input="v => $emit('field', k, v)"
				/>
			</template>
		</div>
		<div v-for="p in shownProblems" :key="p" class="text-caption error--text mt-1">{{ t(p, { min: minMm, reach: reachText }) }}</div>
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
import { numberOf, blockExponent } from '../lib/number-field.js'

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
	methods: {
		blockExponent,
		// a box is red only when something was typed in it and it is not a number, or the numbers do not fit together; an empty box is just not filled yet
		fieldBad(k) {
			const v = this.draft[k]
			if (v === undefined || v === null || String(v).trim() === '') return false
			return numberOf(v) === null || this.shownProblems.length > 0
		}
	},
	data() {
		return { rows: [{ axis: 'X', label: 'workarea.x', keys: ['xMin', 'xMax'] }, { axis: 'Y', label: 'workarea.y', keys: ['yMin', 'yMax'] }] }
	},
	computed: {
		busy() {
			return !!this.working
		},
		// "write four numbers" is what the empty fields already say: the page does not repeat it. What is shown is what was typed wrong or does not fit
		shownProblems() {
			return this.problems.filter(p => p !== 'workarea.err_numbers')
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
.area-grid { display: grid; grid-template-columns: 40px repeat(2, minmax(0, 190px)); gap: 10px 16px; align-items: center; max-width: 520px; }
.area-head { font-size: 12px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; opacity: 0.75; }
.area-axis { font-weight: 600; }
.area-field { min-width: 0; }
</style>
