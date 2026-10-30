<template>
	<v-card outlined class="plan-review">
		<v-card-title class="text-subtitle-1 pb-1">{{ title }}</v-card-title>
		<v-card-text>
			<div v-if="state.status === 'planning'" class="text-body-2 machine-faint">{{ t('plan.planning') }}</div>
			<v-alert v-if="state.status === 'error' && state.error" dense outlined type="error">
				{{ t(state.error.key) }}<span v-if="state.error.detail"> ({{ state.error.detail }})</span>
			</v-alert>
			<!-- the file on the SD is not the one the record expects: compare and accept explicitly (design 5.3) -->
			<template v-if="state.status === 'conflict'">
				<v-alert dense outlined type="warning">{{ t('plan.conflict_intro') }}</v-alert>
				<div v-for="f in state.conflict.files" :key="f.path" class="text-body-2 mb-1">
					{{ f.path }}
					<v-chip x-small outlined class="ml-1" :color="f.state === 'clean' ? 'success' : 'warning'">{{ t('history.file_' + fileState(f)) }}</v-chip>
					<span class="text-caption machine-faint ml-1">{{ t('plan.conflict_sha', { before: short(f.shaBefore), after: short(f.shaAfter), now: short(f.shaNow) }) }}</span>
				</div>
				<div v-if="state.conflict.threeWay.length" class="text-body-2 font-weight-medium mt-2">{{ t('plan.three_way') }}</div>
				<v-simple-table v-if="state.conflict.threeWay.length" dense>
					<thead>
						<tr>
							<th class="text-left">{{ t('history.col_value') }}</th>
							<th class="text-right">{{ t('plan.col_before') }}</th>
							<th class="text-right">{{ t('plan.col_after') }}</th>
							<th class="text-right">{{ t('plan.col_now') }}</th>
						</tr>
					</thead>
					<tbody>
						<tr v-for="r in threeWay" :key="r.key">
							<td class="record-path">{{ r.key }}</td><td class="text-right">{{ r.before }}</td><td class="text-right">{{ r.after }}</td><td class="text-right">{{ r.now }}</td>
						</tr>
					</tbody>
				</v-simple-table>
				<v-checkbox :input-value="state.acceptCurrent" dense hide-details :label="t('plan.conflict_accept')" @change="$emit('set-accept', $event)" />
				<v-btn small color="primary" class="mt-2" :disabled="!acceptable" @click="$emit('replan')">{{ t('plan.conflict_continue') }}</v-btn>
			</template>
			<template v-if="state.plan">
				<div class="text-body-2 mb-2">{{ t('plan.summary', { files: stats.changedFiles, added: stats.added, removed: stats.removed }) }}</div>
				<v-alert v-for="(w, i) in state.plan.warnings" :key="'w' + i" dense outlined type="warning" class="mb-2">{{ warningText(w) }}</v-alert>
				<div v-for="f in state.plan.files" :key="f.path" class="mb-3">
					<div class="text-body-2 font-weight-medium">{{ f.path }}
						<v-chip x-small outlined class="ml-1">{{ f.changed ? t('plan.file_changes') : t('plan.file_same') }}</v-chip>
					</div>
					<plan-diff-lines v-if="f.diff.length" :lines="f.diff" />
					<div v-if="f.diffCut" class="text-caption machine-faint">{{ t('plan.diff_cut') }}</div>
				</div>
				<div v-if="state.plan.roleNeeded === 'admin'" class="text-caption machine-faint mb-2">{{ t('plan.admin_only') }}</div>
				<div class="d-flex align-center flex-wrap" style="gap:8px">
					<v-btn color="primary" :disabled="!applicable" :loading="state.status === 'applying'" @click="$emit('apply')">
						<v-icon left>mdi-content-save-check-outline</v-icon>{{ t('plan.apply') }}
					</v-btn>
					<span v-if="!roleOk" class="text-caption warning--text">{{ t('plan.needs_role', { role: state.plan.roleNeeded }) }}</span>
					<span v-else-if="!changes" class="text-caption machine-faint">{{ t('plan.nothing') }}</span>
				</div>
			</template>
			<v-alert v-if="state.status === 'done' && state.result" dense outlined type="success" class="mt-2">
				<div>{{ t('plan.done') }}</div>
				<div v-if="state.result.snapshot" class="text-caption">{{ t('plan.done_snapshot', { id: state.result.snapshot }) }}</div>
				<div v-if="state.result.restartNeeded" class="text-caption">{{ t('plan.done_restart') }}</div>
			</v-alert>
			<v-btn v-if="state.status !== 'planning' && state.status !== 'applying'" small text class="mt-2" @click="$emit('reset')">{{ t('plan.close') }}</v-btn>
		</v-card-text>
	</v-card>
</template>

<script>
'use strict'

// Shows a plan under review (restore, offsets, limits): the diff of every file, the service's warnings, the explicit acceptance when
// a file changed on the SD, and the apply button. The confirmation dialog of level 3 is the service's (confirm_required): this card
// is the review that comes before it. The state is state/plan-state.js; this component keeps none of its own.

import PlanDiffLines from './PlanDiffLines.vue'
import { textMixin } from './text-mixin.js'
import { planStats, hasChanges } from '../lib/plan-diff.js'
import { canApply, canAccept } from '../state/plan-state.js'
import { formatValue } from '../lib/format.js'

export default {
	components: { PlanDiffLines },
	mixins: [textMixin],
	props: {
		state: { type: Object, required: true }, // createPlanState()
		title: { type: String, default: '' },
		roleOk: { type: Boolean, default: false } // workshopCan for this kind of plan
	},
	computed: {
		stats() {
			return planStats(this.state.plan)
		},
		changes() {
			return hasChanges(this.state.plan)
		},
		applicable() {
			return canApply(this.state, this.roleOk)
		},
		acceptable() {
			return canAccept(this.state)
		},
		// what the record had before and after and what the file has now, per value
		threeWay() {
			return this.state.conflict.threeWay.map(r => ({ key: r.key, before: formatValue(r.before), after: formatValue(r.after), now: formatValue(r.now) }))
		}
	},
	methods: {
		short(sha) {
			return sha ? String(sha).slice(0, 8) : '-'
		},
		fileState(f) {
			return ['clean', 'changed', 'missing'].indexOf(f.state) >= 0 ? f.state : 'changed'
		},
		// a warning of the service is a code (plan.warn_<code>, "structure:<reason>" keeps only "structure"), a text of its own or a plain string:
		// a code without text in the catalog is shown as it is
		warningText(w) {
			if (w && w.text) return w.text
			const code = typeof w === 'string' ? w : w && w.code
			if (!code) return JSON.stringify(w)
			const key = 'plan.warn_' + String(code).split(':')[0]
			const text = this.t(key)
			return text === 'plugins.WorkshopMachine.' + key ? String(code) : text
		}
	}
}
</script>
