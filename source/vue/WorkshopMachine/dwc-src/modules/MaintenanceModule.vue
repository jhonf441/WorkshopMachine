<template>
	<div class="maintenance-module">
		<div class="text-title-large mb-1">{{ t('maintenance.title') }}</div>
		<p class="text-body-medium machine-faint">{{ t('maintenance.intro') }}</p>
		<error-notice :error="loadError" retry @retry="load()" />
		<template v-if="ms.data">
			<v-card variant="outlined" class="mb-4">
				<v-card-title class="text-title-medium pb-0">{{ t('maintenance.counters_title') }}</v-card-title>
				<v-card-text>
					<details class="wf-more">
						<summary>{{ t('common.how_it_works') }}</summary>
					<v-alert density="compact" variant="outlined" type="info" class="mb-2">{{ t('maintenance.estimated_note') }}</v-alert>
					</details>
					<maintenance-counters :rows="counters" :data="ms.data.counters" />
				</v-card-text>
			</v-card>
			<v-card variant="outlined" class="mb-4">
				<v-card-title class="text-title-medium pb-0">
					{{ t('maintenance.plan_title') }}
					<v-spacer />
					<v-btn v-if="canEdit && !ms.editing" size="small" variant="outlined" @click="edit()"><v-icon size="small" start>mdi-pencil</v-icon>{{ t('maintenance.edit') }}</v-btn>
				</v-card-title>
				<v-card-text>
					<v-alert v-if="!canMark" density="compact" variant="outlined" type="info" class="mb-2">{{ t('maintenance.needs_technician') }}</v-alert>
					<maintenance-plan-editor v-if="ms.editing" :state="ms" @save="savePlan()" @cancel="cancelEdit()" />
					<template v-else>
						<maintenance-plan :rows="plan" :can-mark="canMark" :marking="ms.marking" @done="markDone" />
						<div class="d-flex align-center flex-wrap mt-2" style="gap:8px">
							<v-btn v-if="canEdit && ms.data.planEmpty" size="small" variant="outlined" @click="restoreDefaults()"><v-icon size="small" start>mdi-playlist-plus</v-icon>{{ t('maintenance.defaults') }}</v-btn>
							<span class="text-body-small machine-faint">{{ ms.data.notify ? t('maintenance.notify_on') : t('maintenance.notify_off') }}</span>
						</div>
					</template>
				</v-card-text>
			</v-card>
			<v-card variant="outlined" class="mb-4">
				<v-card-title class="text-title-medium pb-0">{{ t('maintenance.history_title') }}</v-card-title>
				<v-card-text>
					<maintenance-history :rows="history" />
				</v-card-text>
			</v-card>
		</template>
		<div v-else-if="ms.status === 'loading'" class="text-body-medium machine-faint">{{ t('common.loading') }}</div>
		<div v-if="notice" class="text-body-medium text-success">{{ notice }}</div>
		<div v-if="opError" class="text-body-medium text-error">{{ opError }}</div>
	</div>
</template>

<script setup>
// Maintenance module (design 2.10): counters per axis (labelled as estimated), the plan with due markers, "done" (who and when are
// recorded by the service) and the plan editor. The counters and the plan live in the service; the page only shows and asks.
// A technician marks "done" and edits the plan (machine.maintenance.plan.set); the buttons follow the server's table (workshopCan).

import { computed, reactive, ref } from 'vue'
import ErrorNotice from '../ErrorNotice.vue' // vue/_shared
import MaintenanceCounters from './MaintenanceCounters.vue'
import MaintenancePlan from './MaintenancePlan.vue'
import MaintenancePlanEditor from './MaintenancePlanEditor.vue'
import MaintenanceHistory from './MaintenanceHistory.vue'
import { t } from '../text.js'
import {
	createMaintenanceState, loadBegin, loaded, loadFailed, markBegin, markDone as stateMarkDone, markFailed, editBegin, editCancel, checkedItems, saveBegin, saveDone, saveFailed
} from '../state/maintenance-state.js'
import { planRows, counterRows, historyRows, defaultLabelKey } from '../lib/maintenance.js'
import { planErrorKey } from '../lib/plan-diff.js'
import { refusalOf } from '../api/machine-api.js'

const props = defineProps({
	api: { type: Object, required: true }, // createMachineApi(...)
	canMark: { type: Boolean, default: false }, // workshopCan('machine.maintenance.done'): the technician
	canEdit: { type: Boolean, default: false } // workshopCan('machine.maintenance.plan.set'): the technician
})

const ms = reactive(createMaintenanceState())
const loadError = ref(null)
const notice = ref('')
const opError = ref('')

const counters = computed(() => counterRows(ms.data))
const plan = computed(() => planRows(ms.data))
const history = computed(() => historyRows(ms.data))

async function load() {
	loadBegin(ms)
	try {
		loaded(ms, await props.api.maintenance.get())
		loadError.value = null
	} catch (e) {
		loadFailed(ms, planErrorKey(refusalOf(e)), e && e.message)
		loadError.value = e
	}
}
// a refusal of the service as one line: its reason text and its own message
function failure(e) {
	if (e && e.code === 'cancelled') return ''
	return t(planErrorKey(refusalOf(e))) + (e && e.message ? ' (' + e.message + ')' : '')
}
async function markDone(id) {
	notice.value = ''
	opError.value = ''
	markBegin(ms, id)
	try {
		stateMarkDone(ms, await props.api.maintenance.done(id))
		notice.value = t('maintenance.done_marked')
		await load() // the summary and the other numbers of the service
	} catch (e) {
		markFailed(ms)
		opError.value = failure(e)
	}
}
function edit() {
	notice.value = ''
	opError.value = ''
	editBegin(ms, item => {
		const key = defaultLabelKey(item)
		return key ? t(key) : ''
	})
}
function cancelEdit() {
	editCancel(ms)
}
async function savePlan() {
	const items = checkedItems(ms)
	if (!items) return
	saveBegin(ms)
	try {
		await props.api.maintenance.savePlan(items, ms.notify)
		saveDone(ms)
		notice.value = t('maintenance.plan_saved')
		await load()
	} catch (e) {
		saveFailed(ms)
		opError.value = failure(e)
	}
}
async function restoreDefaults() {
	notice.value = ''
	opError.value = ''
	try {
		await props.api.maintenance.restoreDefaults()
		notice.value = t('maintenance.plan_saved')
		await load()
	} catch (e) {
		opError.value = failure(e)
	}
}

load()
</script>
