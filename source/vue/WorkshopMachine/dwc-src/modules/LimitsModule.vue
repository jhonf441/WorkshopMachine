<template>
	<div class="limits-module">
		<div class="text-title-large mb-1">{{ t('limits.title') }}</div>
		<p class="text-body-medium machine-faint">{{ t('limits.intro') }}</p>
		<error-notice :error="loadError" retry @retry="load()" />
		<v-alert v-if="!canEdit" density="compact" variant="outlined" type="info" class="mb-3">{{ t('limits.read_only') }}</v-alert>
		<v-alert v-for="w in warnings" :key="w.code + w.axis" density="compact" variant="outlined" type="warning" class="mb-2">{{ t(w.textKey) }}<span v-if="w.axis"> ({{ w.axis }})</span></v-alert>
		<v-alert v-if="limits && !limits.configRead" density="compact" variant="outlined" type="info" class="mb-2">{{ t('limits.config_unread') }}</v-alert>
		<div v-if="!rows.length" class="text-body-medium machine-faint">{{ t('limits.no_axes') }}</div>
		<v-table v-else density="compact">
			<thead>
				<tr>
					<th class="text-left">{{ t('limits.col_axis') }}</th>
					<th class="text-right">{{ t('limits.col_min') }}</th>
					<th class="text-right">{{ t('limits.col_max') }}</th>
					<th class="text-right">{{ t('limits.col_travel') }}</th>
					<th class="text-left">{{ t('limits.col_homed') }}</th>
				</tr>
			</thead>
			<tbody>
				<tr v-for="r in rows" :key="r.letter">
					<td>{{ r.letter }}</td>
					<td class="text-right">
						<v-text-field v-if="canEdit" v-model="draft[r.letter].min" density="compact" variant="outlined" hide-details class="limits-field" :error="bad(r.letter)" :aria-label="r.letter + ' ' + t('limits.col_min')" />
						<span v-else>{{ r.min }}</span>
					</td>
					<td class="text-right">
						<v-text-field v-if="canEdit" v-model="draft[r.letter].max" density="compact" variant="outlined" hide-details class="limits-field" :error="bad(r.letter)" :aria-label="r.letter + ' ' + t('limits.col_max')" />
						<span v-else>{{ r.max }}</span>
					</td>
					<td class="text-right">{{ travelOf(r) }}</td>
					<td>{{ r.homed === null ? '-' : r.homed ? t('common.yes') : t('common.no') }}</td>
				</tr>
			</tbody>
		</v-table>
		<div v-for="c in problems" :key="c.letter" class="text-body-small text-error mt-1">{{ c.letter }}: {{ t(c.errorKey) }}</div>
		<div v-if="canEdit && rows.length" class="d-flex align-center flex-wrap mt-3" style="gap:8px">
			<v-btn size="small" color="primary" :disabled="!valid || flowBusy" @click="propose()">{{ t('limits.review') }}</v-btn>
			<span class="text-body-small machine-faint">{{ t('limits.admin_hint') }}</span>
		</div>
		<plan-review v-if="ps.status !== 'idle'" class="mt-3" :state="ps" :title="t('limits.plan_title')" :role-ok="canEdit" @apply="applyPlan()" @reset="flow.reset()" />

		<div class="text-title-medium mt-6 mb-1">{{ t('limits.verify_title') }}</div>
		<p class="text-body-medium machine-faint">{{ t('limits.verify_intro') }}</p>
		<run-start v-if="canRun" :allowed="canRun" :busy="!startAllowed" :starting="rs.status === 'starting'" :label="t('limits.verify_start')" @start="start(kind, {})" />
		<div v-else class="text-body-small machine-faint">{{ t('run.needs_technician') }}</div>
		<run-progress class="mt-3" :run="rs.run" :error-text="runErrorText" :foreign-text="foreignText" :now="now" @stop="stop()" />
		<endstop-result v-if="verify" class="mt-3" :result="verify" />
		<div v-else-if="!busy" class="text-body-medium machine-faint mt-2">{{ t('limits.verify_none') }}</div>
	</div>
</template>

<script setup>
// Limits module (design 2.5): the M208 table of the machine (view for everybody who sees the module), the edit through a plan (admin
// only: `canEdit` is workshopCan('machine.config.apply') for config.m208, the server enforces it), and the endstop verification run
// (homes the axes: technician, with the pre-check list) with its result table.

import { computed, reactive, ref } from 'vue'
import ErrorNotice from '../ErrorNotice.vue' // vue/_shared
import { useRunModule } from './use-run-module.js'
import RunStart from './RunStart.vue'
import RunProgress from './RunProgress.vue'
import PlanReview from './PlanReview.vue'
import EndstopResult from './EndstopResult.vue'
import { t } from '../text.js'
import { RUN_KINDS2, normalizeVerify } from '../api/machine-api-p2.js'
import { createPlanFlow } from '../state/plan-flow.js'
import { createPlanState, isWorking } from '../state/plan-state.js'
import { limitRows, draftOf, changedLimits, limitsValid, planValues, travel, warningRows, KIND_LIMITS } from '../lib/limits.js'

const props = defineProps({
	api: { type: Object, required: true }, // createMachineApi(...)
	published: { type: Object, default: null }, // normalizeRuns of the plugin data `machine`
	canEdit: { type: Boolean, default: false }, // admin (workshopCan)
	canRun: { type: Boolean, default: false }, // technician
	now: { type: Number, default: 0 }
})
const emit = defineEmits(['changed'])

const { rs, busy, startAllowed, runErrorText, foreignKind, start, stop } = useRunModule(props, [RUN_KINDS2.homingVerify], {})

const limits = ref(null)
const loadError = ref(null)
const draft = ref({})
const ps = reactive(createPlanState())
const flow = createPlanFlow({ state: ps, apply: plan => props.api.config.apply(plan.id, plan.kind) })

const kind = RUN_KINDS2.homingVerify
const travelOf = travel
const rows = computed(() => limitRows(limits.value ? limits.value.axes : []))
const warnings = computed(() => warningRows(limits.value ? limits.value.warnings : []))
const changes = computed(() => changedLimits(rows.value, draft.value))
const valid = computed(() => limitsValid(changes.value))
const problems = computed(() => changes.value.filter(c => c.errorKey))
const flowBusy = computed(() => isWorking(ps))
const verify = computed(() => (rs.result ? normalizeVerify(rs.result) : null))
const foreignText = computed(() => (rs.foreign ? t('run.another_running', { kind: foreignKind.value }) : ''))

async function load() {
	try {
		limits.value = await props.api.limits.get()
		draft.value = draftOf(limitRows(limits.value.axes))
		loadError.value = null
	} catch (e) {
		loadError.value = e
	}
}
function bad(letter) {
	return problems.value.some(c => c.letter === letter)
}
function propose() {
	const values = planValues(changes.value)
	return flow.propose(async () => ({ plan: await props.api.config.plan(KIND_LIMITS, values), conflict: null }))
}
async function applyPlan() {
	await flow.apply(props.canEdit)
	if (ps.status === 'done') {
		await load()
		emit('changed')
	}
}

load()
</script>

<style>
.limits-field { max-width: 120px; margin-left: auto; }
</style>
