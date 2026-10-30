<template>
	<div class="offsets-module">
		<div class="text-title-large mb-1">{{ t('offsets.title') }}</div>
		<p class="text-body-medium machine-faint">{{ t('offsets.intro') }}</p>
		<error-notice :error="loadError" retry @retry="load()" />
		<v-alert v-if="!canWrite" density="compact" variant="outlined" type="info" class="mb-3">{{ t('offsets.read_only') }}</v-alert>
		<template v-if="os.data">
			<v-card variant="outlined" class="mb-4">
				<v-card-title class="text-title-medium pb-0">{{ t('offsets.tools_title') }}</v-card-title>
				<v-card-text>
					<offsets-table
						:sets="os.data.tools" :axes="toolAxes" :draft="os.drafts.tools" :editable="canWrite" :per-row="canWrite" :first-column="t('offsets.col_tool')"
						:empty-text="t('offsets.no_tools')" @review="proposeTool"
					/>
					<div v-if="canWrite" class="text-body-small machine-faint mt-1">{{ t('offsets.one_tool') }}</div>
				</v-card-text>
			</v-card>
			<v-card variant="outlined" class="mb-4">
				<v-card-title class="text-title-medium pb-0">{{ t('offsets.work_title') }}</v-card-title>
				<v-card-text>
					<offsets-table
						:sets="os.data.workplaces" :axes="workAxes" :draft="os.drafts.work" :editable="canWrite" :current="os.data.current" :first-column="t('offsets.col_system')"
						:empty-text="t('offsets.no_work')"
					/>
					<div class="text-body-small machine-faint mt-2">{{ t('offsets.persist_hint') }}</div>
					<div v-if="canWrite" class="d-flex align-center flex-wrap mt-2" style="gap:8px">
						<v-select v-model="os.target" :items="targetItems" item-title="text" :label="t('offsets.target')" density="compact" variant="outlined" hide-details style="max-width:320px" />
						<v-btn size="small" color="primary" :disabled="!workReady || flowBusy" @click="proposeWork()">{{ t('offsets.review') }}</v-btn>
					</div>
				</v-card-text>
			</v-card>
			<plan-review v-if="ps.status !== 'idle'" class="mb-4" :state="ps" :title="t('offsets.plan_title')" :role-ok="canWrite" @apply="applyPlan()" @reset="flow.reset()" />
			<v-card v-if="canWrite" variant="outlined" class="mb-4">
				<v-card-title class="text-title-medium pb-0">{{ t('offsets.snapshots_title') }}</v-card-title>
				<v-card-text>
					<offsets-snapshots :api="api" :snapshots="os.snapshots" :pick="os.pick" :last="os.data.lastSnapshot" :taken="taken" :can-write="canWrite" :busy="working" @snapshot="snapshot()" />
				</v-card-text>
			</v-card>
			<v-card variant="outlined" class="mb-4">
				<v-card-title class="text-title-medium pb-0">{{ t('verify.title') }}</v-card-title>
				<v-card-text><verify-camera :api="api" :published="published" :can-run="canRun" :measure="measure" :now="now" /></v-card-text>
			</v-card>
			<!-- shown only when the machine declares a laser tool AND a pointer tool and the board reports a laser -->
			<v-card v-if="pair.available" variant="outlined" class="mb-4">
				<v-card-title class="text-title-medium pb-0">{{ t('offsets.pointer_title') }}</v-card-title>
				<v-card-text>
					<laser-pointer :pointer="os.pointer" :pair="pair" :can-run="canRun" :busy="working" @mark="mark" @capture="capture" @clear="clearMark" />
				</v-card-text>
			</v-card>
		</template>
		<div v-if="notice" class="text-body-medium text-success">{{ notice }}</div>
		<div v-if="opError" class="text-body-medium text-error">{{ opError }}</div>
	</div>
</template>

<script setup>
// Offsets module (design 2.7): the tool offsets, the work coordinate systems G54..G59.3, snapshots to compare, the persistence helper
// (every change goes through the plan: diff preview, then the service's confirmation) and the laser <-> pointer assistant. An operator
// reads the tables; a technician edits. Nothing here moves the machine except the cross mark of the assistant (a service procedure).

import { computed, reactive, ref } from 'vue'
import ErrorNotice from '../ErrorNotice.vue' // vue/_shared
import OffsetsTable from './OffsetsTable.vue'
import OffsetsSnapshots from './OffsetsSnapshots.vue'
import LaserPointer from './LaserPointer.vue'
import PlanReview from './PlanReview.vue'
import VerifyCamera from './VerifyCamera.vue'
import { t } from '../text.js'
import { createOffsetsState, loadBegin, loaded, loadFailed, axesFor, changesFor, pointerMarked, pointerCaptured, pointerReset } from '../state/offsets-state.js'
import { createPlanFlow } from '../state/plan-flow.js'
import { createPlanState, isWorking } from '../state/plan-state.js'
import { draftErrors, workValues, toolValues, toolChange, KIND_TOOLS, KIND_WORK, TARGETS } from '../lib/offsets.js'
import { pairOf, crossReasonKey } from '../lib/laser-pointer.js'
import { planErrorKey } from '../lib/plan-diff.js'
import { refusalOf } from '../api/machine-api.js'

const props = defineProps({
	api: { type: Object, required: true }, // createMachineApi(...)
	canWrite: { type: Boolean, default: false }, // workshopCan('machine.config.apply', config.g10): the technician
	canRun: { type: Boolean, default: false }, // technician: the cross mark
	toolPair: { type: Object, default: null }, // the pair the profile declares (normalizeState toolPair)
	published: { type: Object, default: null }, // normalizeRuns of the plugin data `machine` (the camera verification is a run)
	measure: { type: Boolean, default: null }, // machine.state vision.measure: Vision can measure a mark (null = not known)
	now: { type: Number, default: 0 }
})

const os = reactive(createOffsetsState())
const ps = reactive(createPlanState())
const flow = createPlanFlow({ state: ps, apply: plan => props.api.config.apply(plan.id, plan.kind) })
const loadError = ref(null)
const working = ref(false)
const notice = ref('')
const opError = ref('')
const taken = ref(null)
const laser = ref(null)

const toolAxes = computed(() => axesFor(os, 'tools'))
const workAxes = computed(() => axesFor(os, 'work'))
const targetItems = computed(() => TARGETS.map(x => ({ value: x, text: t('offsets.target_' + x) })))
const pair = computed(() => pairOf(props.toolPair, laser.value))
const workReady = computed(() => {
	const changes = changesFor(os, 'work')
	return changes.length > 0 && draftErrors(changes).length === 0
})
const flowBusy = computed(() => isWorking(ps))

async function load() {
	loadBegin(os)
	try {
		loaded(os, await props.api.offsets.get())
		loadError.value = null
		await loadSnapshots()
	} catch (e) {
		loadFailed(os, planErrorKey(refusalOf(e)), e && e.message)
		loadError.value = e
	}
}
async function loadSnapshots() {
	if (!props.canWrite) return
	try {
		os.snapshots = (await props.api.history.list({ kind: 'offsets.snapshot', limit: 20 })).records
	} catch (e) {
		os.snapshots = []
	}
}
// the tools go one by one (config.g10 edits one tool per plan); the work systems go together
function proposeTool(key) {
	const change = toolChange(changesFor(os, 'tools'), key)
	if (!change) return null
	const values = toolValues(change)
	return flow.propose(async () => ({ plan: await props.api.config.plan(KIND_TOOLS, values), conflict: null }))
}
function proposeWork() {
	const values = workValues(changesFor(os, 'work'), os.target)
	return flow.propose(async () => ({ plan: await props.api.config.plan(KIND_WORK, values), conflict: null }))
}
async function applyPlan() {
	await flow.apply(props.canWrite)
	if (ps.status === 'done') await load()
}
function reasonKey(e) {
	const reason = refusalOf(e)
	const cross = crossReasonKey(reason)
	return cross === 'offsets.cross_other' ? planErrorKey(reason) : cross
}
// one service call with its busy flag, notice and error text
async function act(call, doneKey) {
	working.value = true
	notice.value = ''
	opError.value = ''
	try {
		const out = await call()
		notice.value = doneKey ? t(doneKey) : ''
		return out
	} catch (e) {
		if (!e || e.code !== 'cancelled') opError.value = t(reasonKey(e)) + (e && e.message ? ' (' + e.message + ')' : '')
		return null
	} finally {
		working.value = false
	}
}
async function snapshot() {
	taken.value = await act(() => props.api.offsets.snapshot(), 'offsets.done_snapshot')
	await loadSnapshots()
}
async function mark(power) {
	const out = await act(() => props.api.pointer.mark(power), 'offsets.done_mark')
	if (out) pointerMarked(os, out)
}
async function capture(save) {
	const out = await act(() => props.api.pointer.capture(save), null)
	if (out) pointerCaptured(os, out)
}
async function clearMark() {
	if (await act(() => props.api.pointer.clear(), null)) pointerReset(os)
}

load()
props.api.capabilities().then(c => { laser.value = c.laser }, () => { laser.value = null }) // no answer: the profile alone decides
</script>
