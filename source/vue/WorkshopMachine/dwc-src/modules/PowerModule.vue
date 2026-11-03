<template>
	<div class="power-module">
		<div class="text-title-large mb-1">{{ t('power.title') }}</div>
		<p class="text-body-medium machine-faint">{{ t('power.intro') }}</p>
		<error-notice :error="loadError" retry @retry="load()" />
		<v-alert v-if="view" density="compact" variant="outlined" :type="{ ok: 'success', warn: 'warning', info: 'info' }[state.level]" class="mb-3">{{ t(state.textKey) }}</v-alert>
		<template v-if="view && view.m911">
			<div class="text-title-medium mb-1">{{ t('power.line_title') }}</div>
			<div class="d-flex flex-wrap align-center mb-1" style="gap:12px">
				<v-text-field v-if="canEdit" v-model="draft.s" density="compact" variant="outlined" hide-details class="power-field" :label="t('power.cut_label')" suffix="V" :error="!!change.errorKey" />
				<div v-else><b>{{ t('power.cut_label') }}:</b> {{ view.m911.s }} V</div>
				<v-text-field v-if="canEdit" v-model="draft.r" density="compact" variant="outlined" hide-details class="power-field" :label="t('power.restore_label')" suffix="V" :error="!!change.errorKey" />
				<div v-else><b>{{ t('power.restore_label') }}:</b> {{ view.m911.r }} V</div>
				<div v-if="view.voltsNow !== null"><b>{{ t('power.now_label') }}:</b> {{ view.voltsNow }} V</div>
			</div>
			<div v-if="change.errorKey" class="text-body-small text-error">{{ t(change.errorKey, { sMin: range.sMin, sMax: range.sMax, rMin: range.rMin, rMax: range.rMax }) }}</div>
			<div class="text-body-small machine-faint mb-2">{{ t('power.line_help') }}</div>
			<div v-if="view.m911.commands" class="text-body-small mb-2"><b>{{ t('power.commands_label') }}:</b> <code>{{ view.m911.commands }}</code></div>
			<div v-if="canEdit" class="d-flex align-center flex-wrap" style="gap:8px">
				<v-btn size="small" color="primary" :disabled="!hasChange || flowBusy" @click="propose()">{{ t('power.review') }}</v-btn>
				<span class="text-body-small machine-faint">{{ t('power.admin_hint') }}</span>
			</div>
			<v-alert v-else density="compact" variant="outlined" type="info" class="mt-2">{{ t('power.read_only') }}</v-alert>
		</template>
		<template v-if="view">
			<div class="text-title-medium mt-5 mb-1">{{ t('power.files_title') }}</div>
			<div class="text-body-small machine-faint mb-3">{{ t('power.files_help') }}</div>

			<div class="power-file mb-4">
				<div class="text-title-small">{{ t('power.resurrect_title') }}</div>
				<div class="text-body-small machine-faint mb-1">{{ t('power.resurrect_what') }}</div>
				<div class="text-body-medium"><code>resurrect.g</code>: {{ view.resurrect.exists ? t('power.resurrect_yes', { job: view.resurrect.job || '-' }) : t('power.resurrect_no') }}</div>
				<template v-if="view.resurrect.exists">
					<ul class="text-body-medium power-facts">
						<li v-if="view.resurrect.job"><b>{{ t('power.job_label') }}:</b> <code>{{ view.resurrect.job }}</code></li>
						<li v-if="view.resurrect.positionBytes !== null"><b>{{ t('power.position_label') }}:</b> {{ view.resurrect.positionBytes }}</li>
						<li v-if="axes"><b>{{ t('power.axes_label') }}:</b> {{ axes }}</li>
						<li v-for="(h, i) in view.resurrect.header" :key="i" class="machine-faint">{{ h }}</li>
					</ul>
					<v-btn size="small" variant="text" prepend-icon="mdi-file-eye-outline" @click="show.resurrect = !show.resurrect">{{ t(show.resurrect ? 'power.hide_content' : 'power.view_content') }}</v-btn>
					<div v-if="show.resurrect" class="power-code mt-1"><div v-for="l in resurrectLines" :key="l.n" :class="'power-line power-' + l.kind"><span class="power-n">{{ l.n }}</span><span class="power-txt">{{ l.text }}</span></div></div>
					<div v-if="show.resurrect && view.resurrect.truncated" class="text-body-small machine-faint">{{ t('power.truncated', { n: view.resurrect.text.length }) }}</div>
					<div class="power-resume mt-3">
						<div class="text-title-small">{{ t('power.resume_title') }}</div>
						<div class="text-body-small machine-faint mb-1">{{ t('power.resume_hint') }}</div>
						<ul class="text-body-medium power-facts power-facts-icons">
							<li v-for="c in resumeList" :key="c.id"><v-icon size="small" :color="c.color" class="mr-1">{{ c.icon }}</v-icon>{{ t('power.chk_' + c.id) }}</li>
						</ul>
						<div v-if="view.resume.needsAck" class="d-flex flex-column mb-1">
							<v-checkbox v-for="k in ackKeys" :key="k" v-model="ack[k]" density="compact" hide-details :label="t('power.ack_' + k)" :disabled="!canResume" />
						</div>
						<div v-if="canResume" class="d-flex align-center flex-wrap" style="gap:8px">
							<v-btn size="small" :color="armed ? 'error' : 'primary'" :disabled="!!resumeWhy || resuming" prepend-icon="mdi-play-circle-outline" @click="resumeTap()">{{ t(armed ? 'power.resume_confirm' : 'power.resume_btn') }}</v-btn>
							<span v-if="resumeWhy" class="text-body-small machine-faint">{{ t(resumeWhy) }}</span>
						</div>
						<v-alert v-else density="compact" variant="outlined" type="info" class="mt-1 mb-0">{{ t('power.resume_role') }}</v-alert>
						<error-notice :error="resumeError" />
						<v-alert v-if="resumeSent" density="compact" variant="outlined" type="success" class="mt-2 mb-0">{{ t('power.resume_sent') }}</v-alert>
					</div>
				</template>
				<div v-else class="text-body-small machine-faint">{{ t('power.resurrect_none_help') }}</div>
			</div>

			<div class="power-file">
				<div class="text-title-small">{{ t('power.prologue_title') }}</div>
				<div class="text-body-small machine-faint mb-1">{{ t('power.prologue_what') }}</div>
				<div class="text-body-medium"><code>resurrect-prologue.g</code>: {{ view.prologue.exists ? t('power.prologue_yes') : t('power.prologue_no') }}</div>
				<template v-if="view.prologue.exists">
					<div class="text-body-small mb-1">{{ t(view.prologue.isStandard ? 'power.standard_yes' : 'power.standard_no') }}</div>
					<ul class="text-body-medium power-facts power-facts-icons">
						<li v-for="f in facts" :key="f.key"><v-icon size="small" :color="f.color" class="mr-1">{{ f.icon }}</v-icon>{{ t('power.fact_' + f.key) }}</li>
					</ul>
					<v-btn size="small" variant="text" prepend-icon="mdi-file-eye-outline" @click="show.prologue = !show.prologue">{{ t(show.prologue ? 'power.hide_content' : 'power.view_content') }}</v-btn>
					<div v-if="show.prologue" class="power-code mt-1"><div v-for="l in prologueLines" :key="l.n" :class="'power-line power-' + l.kind"><span class="power-n">{{ l.n }}</span><span class="power-txt">{{ l.text }}</span></div></div>
					<div v-if="show.prologue && view.prologue.truncated" class="text-body-small machine-faint">{{ t('power.truncated', { n: view.prologue.text.length }) }}</div>
				</template>
				<template v-else>
					<v-alert density="compact" variant="outlined" type="warning" class="mt-1 mb-2"><b>{{ t('power.missing_title') }}.</b> {{ t('power.missing_text') }}</v-alert>
					<div class="d-flex align-center flex-wrap" style="gap:8px">
						<v-btn v-if="canCreate" size="small" color="primary" prepend-icon="mdi-file-plus-outline" :disabled="flowBusy" @click="proposePrologue()">{{ t('power.create') }}</v-btn>
						<span class="text-body-small machine-faint">{{ t('power.create_admin_only') }}</span>
					</div>
				</template>
			</div>
			<plan-review v-if="ps.status !== 'idle'" class="mt-3" :state="ps" :title="t(planFor === 'prologue' ? 'power.prologue_plan_title' : 'power.plan_title')" :role-ok="planFor === 'prologue' ? canCreate : canEdit" @apply="applyPlan()" @reset="flow.reset()" />
		</template>
	</div>
</template>

<script setup>
// Power-loss module: the M911 line of the configuration (cut voltage S, restore voltage R, commands P) and the two files RepRapFirmware uses when a job is
// interrupted: resurrect.g (what it left) and resurrect-prologue.g (what runs before resuming). Everybody who sees the module reads both, with a technical
// summary and the content; the two voltages are edited through a plan (admin only: `canEdit`) and a missing prologue is created through a plan (`canCreate`,
// admin). The server enforces both.

import { computed, reactive, ref, watch } from 'vue'
import ErrorNotice from '../ErrorNotice.vue' // vue/_shared
import PlanReview from './PlanReview.vue'
import { t } from '../text.js'
import { createPlanFlow } from '../state/plan-flow.js'
import { createPlanState, isWorking } from '../state/plan-state.js'
import { KIND_POWER, KIND_PROLOGUE, POWER_RANGE, ACK_KEYS, powerDraft, powerChange, powerState, fileLines, prologueFacts, resumeRows, resumeBlock } from '../lib/power.js'

const props = defineProps({
	api: { type: Object, required: true },
	canEdit: { type: Boolean, default: false }, // admin (workshopCan): the two voltages
	canCreate: { type: Boolean, default: false }, // admin: creates the standard prologue when there is none
	canResume: { type: Boolean, default: false } // technician: resumes the interrupted job (the service checks again)
})
const emit = defineEmits(['changed'])

const view = ref(null)
const loadError = ref(null)
const draft = ref({ s: '', r: '' })
const show = reactive({ resurrect: false, prologue: false })
const planFor = ref('m911')
const ackKeys = ACK_KEYS
const ack = reactive({ piece: false, tool: false, area: false })
const armed = ref(false)
const resuming = ref(false)
const resumeError = ref(null)
const resumeSent = ref(false)
let armTimer = null
const ps = reactive(createPlanState())
const flow = createPlanFlow({ state: ps, apply: plan => props.api.config.apply(plan.id, plan.kind) })

const range = POWER_RANGE
const state = computed(() => powerState(view.value))
const change = computed(() => powerChange(view.value && view.value.m911, draft.value))
const hasChange = computed(() => !change.value.errorKey && Object.keys(change.value.values).length > 0)
const flowBusy = computed(() => isWorking(ps))
const axes = computed(() => {
	const g = (view.value && view.value.resurrect.g92) || {}
	return Object.keys(g).map(k => k + g[k]).join('  ')
})
const resurrectLines = computed(() => (show.resurrect ? fileLines(view.value.resurrect.text) : []))
const prologueLines = computed(() => (show.prologue ? fileLines(view.value.prologue.text) : []))
const facts = computed(() => prologueFacts(view.value && view.value.prologue.summary))
const resumeList = computed(() => resumeRows(view.value && view.value.resume))
const resumeWhy = computed(() => resumeBlock(view.value && view.value.resume, ack))

async function load() {
	try {
		view.value = await props.api.power.get()
		draft.value = powerDraft(view.value.m911)
		loadError.value = null
	} catch (e) {
		loadError.value = e
	}
}
function propose() {
	const values = change.value.values
	planFor.value = 'm911'
	return flow.propose(async () => ({ plan: await props.api.config.plan(KIND_POWER, values), conflict: null }))
}
function proposePrologue() {
	planFor.value = 'prologue'
	return flow.propose(async () => ({ plan: await props.api.config.plan(KIND_PROLOGUE, {}), conflict: null }))
}
async function applyPlan() {
	await flow.apply(planFor.value === 'prologue' ? props.canCreate : props.canEdit)
	if (ps.status === 'done') {
		await load()
		emit('changed')
	}
}

// the first tap arms the button for five seconds; the second one sends. Whatever changes in the list or the acknowledgements disarms it.
function disarm() {
	armed.value = false
	if (armTimer) clearTimeout(armTimer)
	armTimer = null
}
async function resumeTap() {
	if (resumeWhy.value || resuming.value) return
	if (!armed.value) {
		armed.value = true
		armTimer = setTimeout(disarm, 5000)
		return
	}
	disarm()
	resuming.value = true
	resumeError.value = null
	resumeSent.value = false
	try {
		await props.api.power.resume(Object.assign({}, ack))
		resumeSent.value = true
		ACK_KEYS.forEach(k => { ack[k] = false })
		await load()
	} catch (e) {
		resumeError.value = e
	} finally {
		resuming.value = false
	}
}
watch([ack, () => resumeWhy.value], disarm, { deep: true })

load()
</script>

<style>
.power-field { max-width: 150px; }
.power-facts { padding-left: 18px; }
.power-facts-icons { list-style: none; padding-left: 0; }
.power-code { font-family: monospace; font-size: 12px; max-height: 320px; overflow: auto; border-radius: 4px; padding: 6px 0; background: rgba(128, 128, 128, 0.12); }
.power-line { display: flex; }
.power-n { min-width: 40px; padding-right: 10px; text-align: right; opacity: 0.45; user-select: none; }
.power-txt { white-space: pre-wrap; word-break: break-word; }
.power-comment { opacity: 0.6; }
.power-blank .power-txt { min-height: 1em; }
</style>
