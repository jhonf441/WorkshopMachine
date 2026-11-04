<template>
	<div class="tool-row mb-3">
		<div class="d-flex align-center" style="gap: 4px">
			<span class="text-subtitle-2">{{ label }}</span>
			<v-btn x-small icon :title="t('toolwiz.help_button')" :color="open ? 'info' : undefined" @click="open = !open"><v-icon small>mdi-help-circle-outline</v-icon></v-btn>
		</div>
		<v-alert v-if="open" dense outlined type="info" class="mt-1 mb-2 text-body-2">
			<div v-for="k in parts" :key="k"><b>{{ t('toolwiz.help_' + k) }}:</b> {{ t('toolwiz.h_' + topic + '_' + k) }}</div>
		</v-alert>
		<slot />
		<div v-for="m in messages" :key="m.key" class="text-caption error--text"><v-icon x-small color="error" class="mr-1">mdi-alert-circle-outline</v-icon>{{ m.text }}</div>
	</div>
</template>

<script>
'use strict'

// One row of the assistant: its label, a help button (what it is / what for / if it is missing / how to fill it: toolwiz.h_<topic>_<part>), the input in the
// slot and the messages of the checks that belong to `field` (shown only after the person tried to continue, `show`). Every row of the assistant uses it.

import { textMixin } from './text-mixin.js'
import { HELP_PARTS } from '../lib/toolwiz-spec.js'

export default {
	mixins: [textMixin],
	props: {
		label: { type: String, required: true },
		topic: { type: String, required: true },
		field: { type: String, default: '' }, // the field of the checks this row shows (exact match, or a prefix when it ends with '*')
		issues: { type: Array, default: () => [] },
		show: { type: Boolean, default: false }
	},
	data() {
		return { open: false, parts: HELP_PARTS }
	},
	computed: {
		messages() {
			if (!this.show || !this.field) return []
			const f = this.field
			return this.issues.filter(i => (f.endsWith('*') ? i.field.startsWith(f.slice(0, -1)) : i.field === f)).map((i, n) => ({ key: i.field + i.code + n, text: this.t('toolwiz.err_' + i.code, i.params || {}) }))
		}
	}
}
</script>
