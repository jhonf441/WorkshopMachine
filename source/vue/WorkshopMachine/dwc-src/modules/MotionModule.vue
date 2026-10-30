<template>
	<div class="motion-module">
		<div class="text-title-large mb-1">{{ t('motion.title') }}</div>
		<p class="text-body-medium machine-faint">{{ t('motion.intro') }}</p>
		<error-notice :error="loadError" retry @retry="load()" />
		<v-alert v-if="!canEdit" density="compact" variant="outlined" type="info" class="mb-3">{{ t('motion.read_only') }}</v-alert>
		<v-alert v-if="motion && !motion.configRead" density="compact" variant="outlined" type="info" class="mb-3">{{ t('motion.config_unread') }}</v-alert>
		<div v-if="!rows.length" class="text-body-medium machine-faint">{{ t('motion.no_axes') }}</div>
		<div v-else style="overflow-x:auto"><motion-table :rows="rows" :highlight="param" /></div>
		<div v-if="motion" class="text-body-medium mt-2">{{ t('motion.idle_now', { percent: show(motion.idle.percent), timeout: show(motion.idle.timeoutS) }) }}</div>
		<details class="wf-more">
			<summary>{{ t('common.how_it_works') }}</summary>
		<div class="text-body-small machine-faint mt-1">{{ t('motion.units') }}</div>
		</details>
		<div class="mt-2">
			<span class="text-body-medium">{{ t('motion.motors_question') }}</span>
			<v-btn size="x-small" variant="outlined" class="ml-2" to="/Plugins/Motors"><v-icon size="x-small" start>mdi-engine</v-icon>{{ t('motion.open_motors') }}</v-btn>
		</div>

		<template v-if="canEdit && rows.length">
			<div class="text-title-medium mt-6 mb-1">{{ t('motion.edit_title') }}</div>
			<p class="text-body-medium machine-faint">{{ t('motion.edit_intro') }}</p>
			<v-select v-model="param" :items="paramItems" item-title="text" :label="t('motion.parameter')" density="compact" variant="outlined" hide-details style="max-width:300px" />
			<div class="d-flex flex-wrap mt-3" style="gap:12px">
				<template v-for="r in edit" :key="r.key">
					<v-select v-if="p.choices" v-model="draft[r.key]" :items="modeItems" item-title="text" :label="r.label" density="compact" variant="outlined" hide-details style="max-width:220px" />
					<v-text-field v-else v-model="draft[r.key]" :label="labelOf(r)" :suffix="unitText" density="compact" variant="outlined" hide-details style="max-width:170px" :error="bad(r.key)" />
				</template>
			</div>
			<div v-for="c in problems" :key="c.key" class="text-body-small text-error mt-1">{{ c.key }}: {{ t(c.errorKey, c.range || {}) }}</div>
			<div v-if="p.id === 'current'" class="text-body-small text-warning mt-2">{{ t('motion.current_warn', { max: range ? range.max : '-' }) }}</div>
			<div v-if="p.id === 'mode'" class="text-body-small machine-faint mt-2">{{ t('motion.mode_hint') }}</div>
			<div class="d-flex align-center flex-wrap mt-3" style="gap:8px">
				<v-btn size="small" color="primary" :disabled="!ok || flowBusy" @click="review()">{{ t('motion.review') }}</v-btn>
				<span class="text-body-small machine-faint">{{ t('motion.admin_hint') }}</span>
			</div>
			<plan-review v-if="ps.status !== 'idle'" class="mt-3" :state="ps" :title="t('motion.plan_title')" :role-ok="canEdit" @apply="applied()" @reset="flow.reset()" />
			<try-panel
				v-if="p.gcode" class="mt-4" :state="tf" :now="now" :role-ok="trial(p.gcode)" :has-values="ok" :can-persist="canEdit" :line="line" v-model:seconds="trySeconds"
				@start="tryNow(p.gcode, values)" @keep="tryFlow.keep()" @revert="tryFlow.revert()" @reset="tryFlow.reset()" @persist="persistTrial()"
			/>
			<div v-else class="text-body-small machine-faint mt-3">{{ t('motion.no_trial') }}</div>
		</template>
		<!-- a trial left running by another page or before a reload is shown here, whatever the parameter selected -->
		<try-panel v-else-if="tf.status !== 'idle'" class="mt-4" :state="tf" :now="now" :role-ok="false" v-model:seconds="trySeconds" @reset="tryFlow.reset()" />
	</div>
</template>

<script setup>
// Motion parameters (design 2.8): the table of the axes (read-only for everybody who sees the module), the edit of ONE parameter at a
// time through a plan (administrator only; `canEdit` is workshopCan for the kind, the server enforces it), and "try now" with the
// auto-revert countdown for the parameters machine.try accepts. The trial survives a page reload (state/try-flow.js).
// Microstepping is shown but not edited here (the service has no plan kind for it).

import { computed, ref, watch } from 'vue'
import ErrorNotice from '../ErrorNotice.vue' // vue/_shared
import MotionTable from './MotionTable.vue'
import PlanReview from './PlanReview.vue'
import TryPanel from './TryPanel.vue'
import { t } from '../text.js'
import { usePlanModule } from './use-plan-module.js'
import { useTrialModule } from './use-trial-module.js'
import { tableRows, PARAMS, DRIVER_MODES, paramOf, editRows, draftOf, changes, valid, planValues, previewLine, rangeOf } from '../lib/motion-table.js'

const props = defineProps({
	api: { type: Object, required: true }, // createMachineApi(...)
	configure: { type: Function, required: true }, // capabilitiesOf(...).configure(kind)
	trial: { type: Function, required: true }, // capabilitiesOf(...).trial(gcodeKind)
	isAdmin: { type: Boolean, default: false }, // the module edits for an administrator only
	now: { type: Number, default: 0 } // epoch seconds, ticks every second
})

const { ps, flow, flowBusy, propose, applyPlan } = usePlanModule(props)
const { tf, tryFlow, trySeconds, tryNow, persistTrial } = useTrialModule(props, propose)

const motion = ref(null)
const loadError = ref(null)
const param = ref(PARAMS[0].id)
const draft = ref({})

const rows = computed(() => tableRows(motion.value ? motion.value.rows : []))
const p = computed(() => paramOf(param.value))
const canEdit = computed(() => props.configure(p.value.kind))
const paramItems = computed(() => PARAMS.map(x => ({ value: x.id, text: t('motion.param_' + x.id) })))
const modeItems = computed(() => DRIVER_MODES.map(m => ({ value: m, text: t('motion.mode_' + m) })))
const edit = computed(() => editRows(rows.value, param.value, motion.value && motion.value.idle))
const limits = computed(() => (motion.value ? motion.value.limits : null))
const range = computed(() => rangeOf(param.value, limits.value))
const list = computed(() => changes(edit.value, param.value, draft.value, limits.value))
const ok = computed(() => valid(list.value))
const problems = computed(() => list.value.filter(c => c.errorKey))
const values = computed(() => planValues(param.value, list.value))
const line = computed(() => previewLine(param.value, list.value))
const unitText = computed(() => (p.value.unit ? t('motion.unit_' + p.value.unit) : ''))

function show(v) {
	return v === null || v === undefined ? '-' : v
}
function labelOf(r) {
	return r.labelKey ? t(r.labelKey) : r.label
}
async function load() {
	try {
		motion.value = await props.api.motion.get()
		loadError.value = null
		resetDraft()
	} catch (e) {
		loadError.value = e
	}
}
function resetDraft() {
	draft.value = draftOf(edit.value, param.value)
}
function bad(key) {
	return problems.value.some(c => c.key === key)
}
function review() {
	return propose(p.value.kind, values.value)
}
async function applied() {
	await applyPlan(canEdit.value)
	if (ps.status === 'done') await load()
}
// the person chose another parameter: its fields start from the board's values
watch(param, () => resetDraft())
load()
</script>
