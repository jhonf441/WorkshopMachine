<template>
	<div class="history-module">
		<div class="text-title-large mb-1">{{ t('history.title') }}</div>
		<p class="text-body-medium machine-faint">{{ t('history.intro') }}</p>
		<error-notice :error="loadError" retry @retry="load()" />
		<history-list :filters="hs.filters" :records="hs.records" :selected="hs.selected" :total="hs.total" :loading="hs.status === 'loading'" @apply="load()" @toggle="toggle" @open="open" />
		<div class="d-flex align-center flex-wrap mt-3" style="gap:8px">
			<v-btn size="small" variant="outlined" :disabled="!pair" @click="comparing = true"><v-icon size="small" start>mdi-compare</v-icon>{{ t('history.compare') }}</v-btn>
			<span v-if="hs.selected.length === 2 && !pair" class="text-body-small text-warning">{{ t('history.err_kind_mismatch') }}</span>
			<span v-else-if="hs.selected.length < 2" class="text-body-small machine-faint">{{ t('history.compare_hint') }}</span>
		</div>
		<record-compare v-if="comparing && pair" class="mt-3" :a="pair[0]" :b="pair[1]" :api="api" :axes="axes" :quality="quality" @close="comparing = false" />
		<record-detail v-if="hs.detail" class="mt-3" :record="hs.detail.record" :restore="hs.detail.restore" :allowed="allowedFor(hs.detail.record.kind)" @close="closeRecord()" @report="emit('report', $event)" @restore="restore" />
		<!-- restore: only builds a plan; the diff is reviewed here and the service asks its own confirmation when it is applied -->
		<plan-review v-if="ps.status !== 'idle'" class="mt-3" :state="ps" :title="t('history.restore_title')" :role-ok="restoreAllowed" @set-accept="flow.accept($event)" @replan="flow.proposeAccepted()" @apply="applyPlan()" @reset="flow.reset()" />
	</div>
</template>

<script setup>
// History module (design 2.11): list with filters, one record, comparison of two records of the same kind (value table and height-map
// difference) and restore. The restore flow is state/plan-flow.js: it asks the service for a plan (machine.history.restore never writes),
// shows the diff, handles "the file changed on the SD" with the comparison and an explicit acceptance, and applies only through
// machine.config.apply, which the service confirms.

import { computed, reactive, ref } from 'vue'
import ErrorNotice from '../ErrorNotice.vue' // vue/_shared
import HistoryList from './HistoryList.vue'
import RecordDetail from './RecordDetail.vue'
import RecordCompare from './RecordCompare.vue'
import PlanReview from './PlanReview.vue'
import { t } from '../text.js'
import { createHistoryState, loadBegin, loaded, loadFailed, toggleSelected, comparePair, openDetail, closeDetail } from '../state/history-state.js'
import { createPlanFlow } from '../state/plan-flow.js'
import { createPlanState } from '../state/plan-state.js'
import { listArgs } from '../lib/history.js'
import { planErrorKey } from '../lib/plan-diff.js'
import { refusalOf } from '../api/machine-api.js'

const props = defineProps({
	api: { type: Object, required: true }, // createMachineApi(...)
	configure: { type: Function, required: true }, // kind -> may this person apply a plan of that kind (workshopCan)
	axes: { type: Array, default: () => [] }, // move.axes of the DWC model
	quality: { type: Object, default: null } // profile mesh.quality
})
const emit = defineEmits(['report'])

const hs = reactive(createHistoryState())
const ps = reactive(createPlanState())
const flow = createPlanFlow({ state: ps, apply: plan => props.api.config.apply(plan.id, plan.kind) })
const loadError = ref(null)
const comparing = ref(false)
const restoreKind = ref('')

const pair = computed(() => comparePair(hs))
const restoreAllowed = computed(() => (restoreKind.value ? props.configure(restoreKind.value) : false))

function allowedFor(kind) {
	return props.configure(kind)
}
async function load() {
	loadBegin(hs)
	try {
		loaded(hs, await props.api.history.list(listArgs(hs.filters)))
		loadError.value = null
	} catch (e) {
		loadFailed(hs, planErrorKey(refusalOf(e)), e && e.message)
		loadError.value = e
	}
}
function toggle(id) {
	toggleSelected(hs, id)
	comparing.value = false
}
async function open(id) {
	try {
		openDetail(hs, await props.api.history.get(id))
	} catch (e) {
		loadError.value = e
	}
}
function closeRecord() {
	closeDetail(hs)
	flow.reset()
}
function restore(which) {
	const record = hs.detail.record
	restoreKind.value = record.kind
	return flow.propose(accept => props.api.history.restore(record.id, which, record.kind, accept))
}
async function applyPlan() {
	await flow.apply(restoreAllowed.value)
	if (ps.status === 'done') load()
}

load()
</script>
