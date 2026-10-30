<template>
	<v-card variant="outlined" class="record-detail">
		<v-card-title class="text-title-medium pb-1">
			{{ kindText }}
			<v-spacer />
			<v-btn size="x-small" variant="text" @click="$emit('close')">{{ t('plan.close') }}</v-btn>
		</v-card-title>
		<v-card-text>
			<div class="record-meta">
				<span>{{ t('history.col_date') }}: {{ dateText }}</span>
				<span>{{ t('history.col_user') }}: {{ record.user || '-' }} <span v-if="record.role" class="machine-faint">({{ record.role }})</span></span>
				<span>{{ t('history.col_state') }}: {{ t(state.textKey) }}</span>
				<span v-if="record.machine.firmware">{{ t('history.firmware') }}: {{ record.machine.firmware }}</span>
			</div>
			<div v-if="record.notes" class="text-body-medium mt-2">{{ record.notes }}</div>
			<div v-if="restore.files.length" class="mt-2">
				<div class="text-body-medium font-weight-medium">{{ t('history.applied_files') }}</div>
				<div v-for="f in restore.files" :key="f.path" class="text-body-medium">
					{{ f.path }}
					<v-chip size="x-small" variant="outlined" class="ml-1" :color="f.state === 'clean' ? 'success' : 'warning'">{{ t('history.file_' + fileState(f)) }}</v-chip>
				</div>
			</div>
			<div class="text-body-medium font-weight-medium mt-3">{{ t('history.values') }}</div>
			<v-table density="compact">
				<tbody>
					<tr v-for="v in values" :key="v.path"><td class="record-path">{{ v.path }}</td><td>{{ v.text }}</td></tr>
				</tbody>
			</v-table>
			<div class="d-flex align-center flex-wrap mt-3" style="gap:8px">
				<v-btn size="small" variant="outlined" @click="$emit('report', record.id)"><v-icon size="small" start>mdi-file-document-outline</v-icon>{{ t('history.report') }}</v-btn>
				<template v-if="restore.restorable">
					<v-btn v-if="has('before')" size="small" variant="outlined" :disabled="!allowed" @click="$emit('restore', 'before')"><v-icon size="small" start>mdi-undo-variant</v-icon>{{ t('history.restore_before') }}</v-btn>
					<v-btn v-if="has('after')" size="small" variant="outlined" :disabled="!allowed" @click="$emit('restore', 'after')"><v-icon size="small" start>mdi-redo-variant</v-icon>{{ t('history.restore_after') }}</v-btn>
					<span v-if="!allowed" class="text-body-small text-warning">{{ t('history.restore_needs_role', { role: restore.roleNeeded }) }}</span>
				</template>
				<span v-else-if="restore.reason" class="text-body-small machine-faint">{{ t(reasonKey) }}</span>
			</div>
		</v-card-text>
	</v-card>
</template>

<script setup>
// One record: who, when, what was measured or applied, and the actions: report, restore the values before or after (both only build a
// plan: nothing is written until the person reviews it and confirms). What can be restored comes from the service (history.get).

import { computed } from 'vue'
import { t } from '../text.js'
import { kindKey, stateView, restoreReasonKey } from '../lib/history.js'
import { formatDate, formatValue } from '../lib/format.js'
import { flatten } from '../lib/record-compare.js'

function prefixed(name, part) {
	const flat = flatten(part, '', {})
	const out = {}
	Object.keys(flat).forEach(k => { out[name + '.' + k] = flat[k] })
	return out
}

const props = defineProps({
	record: { type: Object, required: true },
	restore: { type: Object, required: true }, // normalizeRestoreInfo(...)
	allowed: { type: Boolean, default: false } // workshopCan for the kind of this record
})
defineEmits(['close', 'report', 'restore'])

const kindText = computed(() => (kindKey(props.record.kind) ? t(kindKey(props.record.kind)) : props.record.kind))
const dateText = computed(() => formatDate(props.record.ts))
const state = computed(() => stateView(props.record.state))
const reasonKey = computed(() => restoreReasonKey(props.restore.reason))
const values = computed(() => {
	const all = Object.assign({}, prefixed('inputs', props.record.inputs), prefixed('results', props.record.results))
	return Object.keys(all).sort().map(path => ({ path, text: formatValue(all[path]) }))
})

function has(which) {
	return props.restore.which.indexOf(which) >= 0
}
function fileState(f) {
	return ['clean', 'changed', 'missing'].indexOf(f.state) >= 0 ? f.state : 'changed'
}
</script>

<style>
.record-meta { display: flex; flex-wrap: wrap; gap: 4px 20px; font-size: 14px; }
.record-path { font-family: monospace; font-size: 12px; }
</style>
