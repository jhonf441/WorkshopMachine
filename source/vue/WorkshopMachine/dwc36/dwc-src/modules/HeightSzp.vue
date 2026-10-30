<template>
	<div class="height-szp">
		<div class="text-body-2 mb-2">
			SZP:
			<span class="machine-faint">{{ summary }}</span>
		</div>
		<div class="d-flex flex-wrap mb-1" style="gap:8px">
			<v-btn small color="primary" :disabled="off" :title="block" @click="$emit('run', 1)">{{ t('height.szp_drive') }}</v-btn>
			<v-btn small outlined :disabled="off" :title="block" @click="$emit('run', 2)">{{ t('height.szp_height') }}</v-btn>
		</div>
		<div class="text-caption machine-faint mb-2">{{ block || t('height.szp_tip') }}</div>
		<pre v-if="out" class="height-out">{{ out }}</pre>
		<div class="d-flex align-center flex-wrap" style="gap:8px">
			<span class="text-body-2">{{ t('height.szp_save') }}</span>
			<v-text-field v-model="s" type="number" dense outlined hide-details class="height-field" label="S" :disabled="!canWrite" />
			<v-text-field v-model="r" type="number" dense outlined hide-details class="height-field" label="R" :disabled="!canWrite" />
			<v-btn small :disabled="!canWrite || busy" @click="$emit('save', { s, r })">{{ t('height.save') }}</v-btn>
		</div>
	</div>
</template>

<script>
'use strict'

// The SZP (scanning Z probe, probe K1) of FFF: the two calibrations of the Duet guide (drive level, height against reading) and the S / R to save.

import { textMixin } from './text-mixin.js'

export default {
	mixins: [textMixin],
	props: {
		view: { type: Object, required: true }, // lib/height.js modeView of FFF
		canWrite: { type: Boolean, default: false },
		busy: { type: Boolean, default: false },
		block: { type: String, default: '' }, // why the assistants cannot run now ('' = they can)
		out: { type: String, default: '' }, // the last reply of the macro
		sr: { type: Object, default: null } // {s, r} read from that reply
	},
	data() {
		const cur = this.sr || this.view.data.szp
		return { s: cur ? String(cur.s) : '', r: cur ? String(cur.r) : '' }
	},
	computed: {
		off() {
			return !this.canWrite || this.busy || !!this.block
		},
		summary() {
			const p = this.view.szpProbe
			const saved = this.view.data.szp
			const trig = p && p.triggerHeight !== null ? this.t('height.szp_trigger', { h: p.triggerHeight, x: p.offsetX, y: p.offsetY }) : ''
			return trig + (saved ? ' · S' + saved.s + ' R' + saved.r + ' (' + saved.date + ')' : ' ' + this.t('height.szp_not_calibrated'))
		}
	},
	watch: {
		sr(v) {
			if (v) {
				this.s = String(v.s)
				this.r = String(v.r)
			}
		}
	}
}
</script>

<style>
.height-out { white-space: pre-wrap; font-size: 12px; padding: 6px 8px; background: rgba(0, 0, 0, 0.25); border-radius: 4px; margin-bottom: 8px; }
</style>
