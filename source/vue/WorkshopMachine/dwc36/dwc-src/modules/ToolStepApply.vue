<template>
	<div class="tool-step-apply">
		<div class="text-h6 mb-1">{{ t('toolwiz.apply_title') }}</div>
		<p class="text-body-2 machine-faint">{{ t('toolwiz.apply_intro') }}</p>

		<tool-row :label="t('toolwiz.checks_row')" topic="checks">
			<ul class="text-body-2" style="list-style: none; padding-left: 0">
				<li v-for="c in checks" :key="c.id" class="mb-1">
					<v-icon small :color="c.ok ? 'success' : 'error'" class="mr-1">{{ c.ok ? 'mdi-check-circle-outline' : 'mdi-close-circle-outline' }}</v-icon>
					<span :class="c.ok ? '' : 'error--text'">{{ c.ok ? t('toolwiz.check_' + c.id) : t('toolwiz.block_' + c.id) }}</span>
				</li>
			</ul>
		</tool-row>

		<tool-row v-if="d.heaters.length" :label="t('toolwiz.autotune_row')" topic="autotune">
			<v-checkbox v-model="d.ackAutotune" dense hide-details class="mt-0" :disabled="!!w.applied" :label="t('toolwiz.ack_autotune')" />
		</tool-row>
		<tool-row v-if="hasOutput" :label="t('toolwiz.off_row')" topic="off">
			<v-checkbox v-model="d.ackOff" dense hide-details class="mt-0" :disabled="!!w.applied" :label="t('toolwiz.ack_off')" />
		</tool-row>

		<tool-row :label="t('toolwiz.plan_row')" topic="apply">
			<div class="d-flex align-center flex-wrap" style="gap: 8px">
				<v-btn color="primary" :disabled="blocked || working || !!w.applied || ps.status === 'review'" :loading="ps.status === 'planning'" @click="$emit('plan')">
					<v-icon left>mdi-clipboard-check-outline</v-icon>{{ t('toolwiz.plan_btn') }}
				</v-btn>
				<span v-if="blocked" class="text-caption warning--text">{{ t('toolwiz.plan_blocked') }}</span>
			</div>
			<div class="text-caption machine-faint mt-1">{{ t('toolwiz.plan_note') }}</div>
		</tool-row>

		<plan-review v-if="ps.status !== 'idle'" class="mt-2" :state="ps" :title="t('toolwiz.plan_title')" :role-ok="ctx.canWrite" @apply="$emit('apply')" @reset="$emit('reset')" />
	</div>
</template>

<script>
'use strict'

import ToolRow from './ToolRow.vue'
import PlanReview from './PlanReview.vue'
import { textMixin } from './text-mixin.js'
import { typeInfo } from '../lib/toolwiz-spec.js'
import { isWorking } from '../state/plan-state.js'
import { BLOCK_CODES } from '../lib/toolwiz-safety.js'

export default {
	mixins: [textMixin],
	components: { ToolRow, PlanReview },
	props: { w: { type: Object, required: true }, ctx: { type: Object, required: true }, issues: { type: Array, default: () => [] }, ps: { type: Object, required: true } },
	computed: {
		d() {
			return this.w.draft
		},
		hasOutput() {
			const i = typeInfo(this.d.type)
			return !!i && i.output
		},
		checks() {
			const codes = this.issues.map(i => i.code)
			const hasHeaters = this.d.heaters.length > 0
			return BLOCK_CODES.filter(id => {
				if (id.startsWith('heater_') || id === 'no_autotune') return hasHeaters
				if (id === 'no_ack_off') return this.hasOutput
				if (id === 'preview_errors') return codes.indexOf(id) >= 0
				return true
			}).map(id => ({ id, ok: codes.indexOf(id) < 0 }))
		},
		blocked() {
			return this.issues.length > 0
		},
		working() {
			return isWorking(this.ps)
		}
	}
}
</script>
