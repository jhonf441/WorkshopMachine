<template>
	<div class="tool-step-type">
		<div class="text-h6 mb-1">{{ t('toolwiz.type_title') }}</div>
		<p class="text-body-2 machine-faint">{{ t('toolwiz.type_intro') }}</p>
		<tool-row :label="t('toolwiz.type_row')" topic="type" field="type" :issues="issues" :show="show">
			<v-row dense>
				<v-col v-for="id in types" :key="id" cols="12" sm="6" md="4">
					<v-card outlined hover class="pa-3" :color="w.draft.type === id ? 'primary' : undefined" :dark="w.draft.type === id" style="min-height: 76px; cursor: pointer" @click="pick(id)">
						<div class="d-flex align-center" style="gap: 8px">
							<v-icon large>{{ info(id).icon }}</v-icon>
							<div class="flex-grow-1">
								<div class="text-subtitle-1 font-weight-medium">{{ t('toolwiz.type_' + id) }}</div>
								<div class="text-caption">{{ t('toolwiz.type_' + id + '_about') }}</div>
							</div>
							<v-chip v-if="hint && info(id).mode.toLowerCase() === hint" x-small color="info" text-color="white">{{ t('toolwiz.type_suggested') }}</v-chip>
						</div>
					</v-card>
				</v-col>
			</v-row>
		</tool-row>
		<tool-row :label="t('toolwiz.file_row')" topic="file">
			<div class="text-body-2"><v-icon small class="mr-1">mdi-file-document-outline</v-icon><code>sys/config.g</code> <span class="machine-faint">{{ t('toolwiz.file_note') }}</span></div>
		</tool-row>
	</div>
</template>

<script>
'use strict'

import ToolRow from './ToolRow.vue'
import { textMixin } from './text-mixin.js'
import { TYPE_IDS, typeInfo } from '../lib/toolwiz-spec.js'
import { setType } from '../state/toolwiz-state.js'

export default {
	mixins: [textMixin],
	components: { ToolRow },
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
