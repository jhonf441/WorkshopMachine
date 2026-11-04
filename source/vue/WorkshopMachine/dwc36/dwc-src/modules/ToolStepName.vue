<template>
	<div class="tool-step-name">
		<div class="text-h6 mb-1">{{ t('toolwiz.name_title') }}</div>
		<p class="text-body-2 machine-faint">{{ t('toolwiz.name_intro') }}</p>
		<tool-row :label="t('toolwiz.number_row')" topic="number" field="number" :issues="issues" :show="show">
			<v-text-field v-model="w.draft.number" type="number" min="0" max="49" dense outlined hide-details style="max-width: 160px" @keydown="blockKey" />
			<div class="text-caption machine-faint mt-2 mb-1">{{ t('toolwiz.number_free') }}</div>
			<div class="toolwiz-cards toolwiz-cards--compact">
				<tool-choice-card v-for="n in freeNumbers" :key="n" clickable :selected="String(w.draft.number) === String(n)" @pick="w.draft.number = String(n)"><span class="text-subtitle-1 font-weight-medium">{{ n }}</span></tool-choice-card>
			</div>
			<div class="text-caption machine-faint mt-1">{{ t('toolwiz.number_used', { list: usedText }) }}</div>
		</tool-row>
		<tool-row :label="t('toolwiz.name_row')" topic="name" field="name" :issues="issues" :show="show">
			<v-text-field v-model="w.draft.name" maxlength="32" dense outlined hide-details counter :placeholder="t('toolwiz.name_example')" />
		</tool-row>
	</div>
</template>

<script>
'use strict'

import ToolRow from './ToolRow.vue'
import ToolChoiceCard from './ToolChoiceCard.vue'
import { textMixin } from './text-mixin.js'
import { blockKey } from '../lib/number-field.js'

export default {
	mixins: [textMixin],
	components: { ToolRow, ToolChoiceCard },
	props: { w: { type: Object, required: true }, ctx: { type: Object, required: true }, issues: { type: Array, default: () => [] }, show: { type: Boolean, default: false } },
	computed: {
		freeNumbers() {
			const out = []
			for (let n = 0; n <= 49 && out.length < 6; n++) if (this.ctx.usedNumbers.indexOf(n) < 0) out.push(n)
			return out
		},
		usedText() {
			return this.ctx.usedNumbers.length ? this.ctx.usedNumbers.join(', ') : '-'
		}
	},
	methods: { blockKey }
}
</script>
