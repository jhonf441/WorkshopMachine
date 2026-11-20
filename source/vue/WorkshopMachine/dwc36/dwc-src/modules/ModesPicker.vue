<template>
	<div class="modes-picker" role="group" :aria-label="t('config_include.modes_row')">
		<div class="modes-picker-boxes">
			<v-checkbox v-for="m in ids" :key="m" :input-value="has(m)" :label="t('modes.' + m.toLowerCase())" dense hide-details :disabled="disabled" class="mt-0 mr-4" @change="toggle(m, $event)" />
		</div>
		<div class="text-caption machine-faint">{{ summary }}</div>
	</div>
</template>

<script>
'use strict'

// "In which modes does it exist?": the three machine modes as checkboxes. v-model is the list of modes (['FFF', 'Laser']) or null while the person has not chosen:
// the first time it shows it takes the mode the machine is in now (`active`, like 'fff' or 'FFF'), else every mode. The service keeps the choice in machine.g (a
// block for some modes only is wrapped in a check of global.selectedMode); all three modes = no check.

import { textMixin } from './text-mixin.js'
import { MODE_IDS, modeOf } from '../lib/config-modes.js'

export default {
	mixins: [textMixin],
	props: { value: { type: Array, default: null }, active: { type: String, default: '' }, disabled: { type: Boolean, default: false } },
	data() {
		return { ids: MODE_IDS }
	},
	computed: {
		summary() {
			const v = this.value || []
			return v.length === MODE_IDS.length ? this.t('config_include.modes_all') : this.t('config_include.modes_some', { list: v.map(m => this.t('modes.' + m.toLowerCase())).join(', ') })
		}
	},
	watch: {
		active: { immediate: true, handler() { this.seed() } }
	},
	methods: {
		seed() {
			if (this.value !== null) return
			const m = modeOf(this.active)
			this.$emit('input', m ? [m] : MODE_IDS.slice())
		},
		has(m) {
			return (this.value || []).indexOf(m) >= 0
		},
		toggle(m, on) {
			const now = (this.value || []).filter(x => x !== m)
			if (on) now.push(m)
			this.$emit('input', MODE_IDS.filter(x => now.indexOf(x) >= 0))
		}
	}
}
</script>
