<template>
	<div class="tool-row mb-3">
		<div class="text-subtitle-2">{{ label }}</div>
		<slot />
		<div v-for="m in messages" :key="m.key" class="text-caption error--text"><v-icon x-small color="error" class="mr-1">mdi-alert-circle-outline</v-icon>{{ m.text }}</div>
	</div>
</template>

<script>
'use strict'

// One row of the assistant: its label, the input in the slot and the messages of the checks that belong to `field` (shown only after the person tried to continue,
// `show`). Every row of the assistant uses it. Its help (what it is / what for / if it is missing / how to fill it: toolwiz.h_<topic>_<part>) is NOT drawn here: the row
// tells the step it sits in (inject toolHelp, given by ToolWizardModule) and the step shows ONE fold with the help of all its rows, in the order they are on screen.

import { textMixin } from './text-mixin.js'

export default {
	mixins: [textMixin],
	inject: { toolHelp: { default: null } },
	props: {
		label: { type: String, required: true },
		topic: { type: String, required: true },
		field: { type: String, default: '' }, // the field of the checks this row shows (exact match, or a prefix when it ends with '*')
		issues: { type: Array, default: () => [] },
		show: { type: Boolean, default: false }
	},
	mounted() {
		if (this.toolHelp) this.toolHelp.add(this)
	},
	beforeDestroy() {
		if (this.toolHelp) this.toolHelp.remove(this)
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
