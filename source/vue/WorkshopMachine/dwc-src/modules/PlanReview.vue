<template>
	<v-card variant="outlined" class="plan-review">
		<v-card-title class="text-title-medium pb-1">{{ title }}</v-card-title>
		<v-card-text>
			<div v-if="state.status === 'planning'" class="text-body-medium machine-faint">{{ t('plan.planning') }}</div>
			<v-alert v-if="state.status === 'error' && state.error" density="compact" variant="outlined" type="error">
				{{ t(state.error.key) }}<span v-if="state.error.detail"> ({{ state.error.detail }})</span>
			</v-alert>
			<!-- the file on the SD is not the one the record expects: compare and accept explicitly (design 5.3) -->
			<template v-if="state.status === 'conflict'">
				<v-alert density="compact" variant="outlined" type="warning">{{ t('plan.conflict_intro') }}</v-alert>
				<div v-for="f in state.conflict.files" :key="f.path" class="text-body-medium mb-1">
					{{ f.path }}
					<v-chip size="x-small" variant="outlined" class="ml-1" :color="f.state === 'clean' ? 'success' : 'warning'">{{ t('history.file_' + fileState(f)) }}</v-chip>
					<span class="text-body-small machine-faint ml-1">{{ t('plan.conflict_sha', { before: short(f.shaBefore), after: short(f.shaAfter), now: short(f.shaNow) }) }}</span>
				</div>
				<div v-if="state.conflict.threeWay.length" class="text-body-medium font-weight-medium mt-2">{{ t('plan.three_way') }}</div>
				<v-table v-if="state.conflict.threeWay.length" density="compact">
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
				</v-table>
				<v-checkbox :model-value="state.acceptCurrent" density="compact" hide-details :label="t('plan.conflict_accept')" @update:model-value="$emit('set-accept', $event)" />
				<v-btn size="small" color="primary" class="mt-2" :disabled="!acceptable" @click="$emit('replan')">{{ t('plan.conflict_continue') }}</v-btn>
			</template>
			<template v-if="state.plan">
				<div class="text-body-medium mb-2">{{ t('plan.summary', { files: stats.changedFiles, added: stats.added, removed: stats.removed }) }}</div>
				<v-alert v-for="(w, i) in state.plan.warnings" :key="'w' + i" density="compact" variant="outlined" type="warning" class="mb-2">{{ warningText(w) }}</v-alert>
				<div v-for="f in state.plan.files" :key="f.path" class="mb-3">
					<div class="text-body-medium font-weight-medium">{{ f.path }}
						<v-chip size="x-small" variant="outlined" class="ml-1">{{ f.changed ? t('plan.file_changes') : t('plan.file_same') }}</v-chip>
					</div>
					<plan-diff-lines v-if="f.diff.length" :lines="f.diff" />
					<div v-if="f.diffCut" class="text-body-small machine-faint">{{ t('plan.diff_cut') }}</div>
				</div>
				<div v-if="state.plan.roleNeeded === 'admin'" class="text-body-small machine-faint mb-2">{{ t('plan.admin_only') }}</div>
				<div class="d-flex align-center flex-wrap" style="gap:8px">
					<v-btn color="primary" :disabled="!applicable" :loading="state.status === 'applying'" @click="$emit('apply')">
						<v-icon start>mdi-content-save-check-outline</v-icon>{{ t('plan.apply') }}
					</v-btn>
					<span v-if="!roleOk" class="text-body-small text-warning">{{ t('plan.needs_role', { role: state.plan.roleNeeded }) }}</span>
					<span v-else-if="!changes" class="text-body-small machine-faint">{{ t('plan.nothing') }}</span>
				</div>
			</template>
			<v-alert v-if="state.status === 'done' && state.result" density="compact" variant="outlined" type="success" class="mt-2">
				<div>{{ t('plan.done') }}</div>
				<div v-if="state.result.snapshot" class="text-body-small">{{ t('plan.done_snapshot', { id: state.result.snapshot }) }}</div>
				<div v-if="state.result.restartNeeded" class="text-body-small">{{ t('plan.done_restart') }}</div>
			</v-alert>
			<v-btn v-if="state.status !== 'planning' && state.status !== 'applying'" size="small" variant="text" class="mt-2" @click="$emit('reset')">{{ t('plan.close') }}</v-btn>
		</v-card-text>
	</v-card>
</template>

<script setup>
// Shows a plan under review (restore, offsets, limits): the diff of every file, the service's warnings, the explicit acceptance when
// a file changed on the SD, and the apply button. The confirmation dialog of level 3 is the service's (confirm_required): this card
// is the review that comes before it. The state is state/plan-state.js; this component keeps none of its own.

import { computed } from 'vue'
import PlanDiffLines from './PlanDiffLines.vue'
import { t } from '../text.js'
import { planStats, hasChanges } from '../lib/plan-diff.js'
import { canApply, canAccept } from '../state/plan-state.js'
import { formatValue } from '../lib/format.js'

const props = defineProps({
	state: { type: Object, required: true }, // createPlanState()
	title: { type: String, default: '' },
	roleOk: { type: Boolean, default: false } // workshopCan for this kind of plan
})
defineEmits(['apply', 'reset', 'set-accept', 'replan'])

const stats = computed(() => planStats(props.state.plan))
const changes = computed(() => hasChanges(props.state.plan))
const applicable = computed(() => canApply(props.state, props.roleOk))
const acceptable = computed(() => canAccept(props.state))
// what the record had before and after and what the file has now, per value
const threeWay = computed(() => props.state.conflict.threeWay.map(r => ({ key: r.key, before: formatValue(r.before), after: formatValue(r.after), now: formatValue(r.now) })))

function short(sha) {
	return sha ? String(sha).slice(0, 8) : '-'
}
function fileState(f) {
	return ['clean', 'changed', 'missing'].indexOf(f.state) >= 0 ? f.state : 'changed'
}
// a warning of the service is a code (plan.warn_<code>, "structure:<reason>" keeps only "structure"), a text of its own or a plain string:
// a code without text in the catalog is shown as it is
function warningText(w) {
	if (w && w.text) return w.text
	const code = typeof w === 'string' ? w : w && w.code
	if (!code) return JSON.stringify(w)
	const key = 'plan.warn_' + String(code).split(':')[0]
	const text = t(key)
	return text === 'plugins.WorkshopMachine.' + key ? String(code) : text
}
</script>
