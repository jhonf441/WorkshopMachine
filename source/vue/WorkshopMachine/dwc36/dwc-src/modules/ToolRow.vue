<template>
	<div class="tool-row mb-3">
		<div class="d-flex align-center" style="gap: 4px">
			<span class="text-subtitle-2">{{ label }}</span>
			<help-tip :title="label" :what="t('toolwiz.h_' + topic + '_what')" :why="t('toolwiz.h_' + topic + '_why')" :if-missing="t('toolwiz.h_' + topic + '_missing')" :how="t('toolwiz.h_' + topic + '_how')" />
		</div>
		<slot />
		<div v-for="m in messages" :key="m.key" class="text-caption error--text"><v-icon x-small color="error" class="mr-1">mdi-alert-circle-outline</v-icon>{{ m.text }}</div>
	</div>
</template>

<script>
'use strict'

// One row of the assistant: its label, a help-tip (what it is / what for / if it is missing / how to fill it: toolwiz.h_<topic>_<part>), the input in the
// slot and the messages of the checks that belong to `field` (shown only after the person tried to continue, `show`). Every row of the assistant uses it.

import { textMixin } from './text-mixin.js'
import HelpTip from '../HelpTip.vue' // vue/_shared36

export default {
	components: { HelpTip },
	mixins: [textMixin],
	props: {
		label: { type: String, required: true },
		topic: { type: String, required: true },
		field: { type: String, default: '' }, // the field of the checks this row shows (exact match, or a prefix when it ends with '*')
		issues: { type: Array, default: () => [] },
		show: { type: Boolean, default: false }
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
