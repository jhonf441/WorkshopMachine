<template>
	<div class="tool-step-preview">
		<div class="text-h6 mb-1">{{ t('toolwiz.preview_title') }}</div>
		<p class="text-body-2 machine-faint">{{ t('toolwiz.preview_intro') }}</p>
		<tool-row :label="t('toolwiz.preview_row')" topic="preview">
			<div v-if="loading" class="text-body-2 machine-faint"><v-progress-circular indeterminate size="16" width="2" class="mr-2" />{{ t('toolwiz.preview_loading') }}</div>
			<error-notice :error="error" retry @retry="$emit('reload')" />
			<template v-if="data && !loading">
				<div class="mb-2">
					<span class="text-caption machine-faint mr-1">{{ t('toolwiz.preview_goes_to') }}</span>
					<v-chip v-for="f in data.files" :key="f" small label outlined class="mr-1"><v-icon small left>mdi-file-document-outline</v-icon>{{ f }}</v-chip>
				</div>
				<div class="tool-preview-code pa-2" style="font-family: monospace; font-size: 13px; overflow-x: auto; border: 1px solid rgba(128,128,128,.4); border-radius: 4px">
					<div v-for="l in data.lines" :key="l.n" :class="lineClass(l)" style="white-space: pre">{{ l.text || ' ' }}</div>
				</div>
				<div class="mt-1 d-flex flex-wrap" style="gap: 12px">
					<span class="text-caption"><v-icon x-small color="success" class="mr-1">mdi-square</v-icon>{{ t('toolwiz.legend_safety') }}</span>
					<span class="text-caption"><v-icon x-small color="warning" class="mr-1">mdi-square</v-icon>{{ t('toolwiz.legend_heater') }}</span>
				</div>
				<v-alert v-for="(wn, i) in data.warnings" :key="'w' + i" dense outlined type="warning" class="mt-2 mb-0 text-body-2">{{ warningText(wn) }}</v-alert>
				<v-alert v-for="(e, i) in problems" :key="'e' + i" dense outlined type="error" class="mt-2 mb-0 text-body-2">
					<div>{{ t('toolwiz.err_' + e.code) }}</div>
					<v-btn v-if="e.service" x-small outlined class="mt-1" @click="$emit('goto', stepOf(e.code))">{{ t('toolwiz.fix_it') }}</v-btn>
				</v-alert>
				<v-alert v-if="!problems.length" dense outlined type="success" class="mt-2 mb-0 text-body-2">{{ t('toolwiz.preview_ok') }}</v-alert>
			</template>
		</tool-row>
	</div>
</template>

<script>
'use strict'

import ErrorNotice from '../ErrorNotice.vue' // vue/_shared
import ToolRow from './ToolRow.vue'
import { textMixin } from './text-mixin.js'
import { previewIssues, stepOfError } from '../lib/toolwiz-preview.js'

export default {
	mixins: [textMixin],
	components: { ToolRow, ErrorNotice },
	props: { w: { type: Object, required: true }, ctx: { type: Object, required: true }, loading: { type: Boolean, default: false }, error: { type: Object, default: null } },
	computed: {
		data() {
			return this.w.preview ? this.w.preview.data : null
		},
		problems() {
			return this.data ? previewIssues(this.data, this.w.draft.heaters.length) : []
		}
	},
	methods: {
		stepOf: stepOfError,
		lineClass(l) {
			return { 'machine-faint': l.kind === 'comment', 'success--text font-weight-bold': l.kind === 'safety', 'warning--text': l.kind === 'heater' }
		},
		// the service sends a code (its own text may come with it): a text of the page when there is one for the code
		warningText(wn) {
			const key = 'toolwiz.warn_' + wn.code
			return this.$te && this.$te('plugins.WorkshopMachine.' + key) ? this.t(key) : wn.text || wn.code
		}
	}
}
</script>
