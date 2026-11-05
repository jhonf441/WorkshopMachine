<template>
	<div class="tool-step-type">
		<div class="text-h6 mb-1">{{ t('toolwiz.type_title') }}</div>
		<p class="text-body-2 machine-faint">{{ t('toolwiz.type_intro') }}</p>
		<tool-row :label="t('toolwiz.type_row')" topic="type" field="type" :issues="issues" :show="show">
			<div class="toolwiz-cards toolwiz-cards--types">
				<tool-choice-card v-for="id in types" :key="id" clickable :selected="w.draft.type === id" @pick="pick(id)">
					<div class="d-flex align-center" style="gap: 8px">
						<v-icon large>{{ info(id).icon }}</v-icon>
						<div class="flex-grow-1" style="min-width: 0">
							<div class="text-subtitle-1 font-weight-medium toolwiz-clamp-2">{{ t('toolwiz.type_' + id) }}</div>
							<div class="text-caption toolwiz-clamp-2">{{ t('toolwiz.type_' + id + '_about') }}</div>
							<v-chip v-if="hint && info(id).mode.toLowerCase() === hint" x-small color="info" text-color="white" class="mt-1">{{ t('toolwiz.type_suggested') }}</v-chip>
						</div>
					</div>
				</tool-choice-card>
			</div>
		</tool-row>
		<tool-row :label="t('toolwiz.file_row')" topic="file">
			<div class="text-body-2"><v-icon small class="mr-1">mdi-file-document-outline</v-icon><code>sys/config.g</code> <span class="machine-faint">{{ t('toolwiz.file_note') }}</span></div>
		</tool-row>
	</div>
</template>

<script>
'use strict'

import ToolRow from './ToolRow.vue'
import ToolChoiceCard from './ToolChoiceCard.vue'
import { textMixin } from './text-mixin.js'
import { TYPE_IDS, typeInfo } from '../lib/toolwiz-spec.js'
import { setType } from '../state/toolwiz-state.js'

export default {
	mixins: [textMixin],
	components: { ToolRow, ToolChoiceCard },
	props: { w: { type: Object, required: true }, ctx: { type: Object, required: true }, issues: { type: Array, default: () => [] }, show: { type: Boolean, default: false } },
	data() {
		return { types: TYPE_IDS }
	},
	computed: {
		hint() {
			return String(this.ctx.familyHint || '').toLowerCase()
		}
	},
	methods: {
		info(id) {
			return typeInfo(id)
		},
		pick(id) {
			setType(this.w, id)
		}
	}
}
</script>
