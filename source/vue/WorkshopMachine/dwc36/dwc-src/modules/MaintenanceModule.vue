<template>
	<div class="maintenance-module">
		<div class="text-h6 mb-1">{{ t('maintenance.title') }}</div>
		<p class="text-body-2 machine-faint">{{ t('maintenance.intro') }}</p>
		<error-notice :error="loadError" retry @retry="load()" />
		<template v-if="ms.data">
			<v-card outlined class="mb-4">
				<v-card-title class="text-subtitle-1 pb-0">{{ t('maintenance.counters_title') }}</v-card-title>
				<v-card-text>
					<details class="wf-more">
						<summary>{{ t('common.how_it_works') }}</summary>
					<v-alert dense outlined type="info" class="mb-2">{{ t('maintenance.estimated_note') }}</v-alert>
					</details>
					<maintenance-counters :rows="counters" :data="ms.data.counters" />
				</v-card-text>
			</v-card>
			<v-card outlined class="mb-4">
				<v-card-title class="text-subtitle-1 pb-0">
					{{ t('maintenance.plan_title') }}
					<v-spacer />
					<v-btn v-if="canEdit && !ms.editing" small outlined @click="edit()"><v-icon small left>mdi-pencil</v-icon>{{ t('maintenance.edit') }}</v-btn>
				</v-card-title>
				<v-card-text>
					<v-alert v-if="!canMark" dense outlined type="info" class="mb-2">{{ t('maintenance.needs_technician') }}</v-alert>
					<maintenance-plan-editor v-if="ms.editing" :state="ms" @save="savePlan()" @cancel="cancelEdit()" />
					<template v-else>
						<maintenance-plan :rows="plan" :can-mark="canMark" :marking="ms.marking" @done="markDone" />
						<div class="d-flex align-center flex-wrap mt-2" style="gap:8px">
							<v-btn v-if="canEdit && ms.data.planEmpty" small outlined @click="restoreDefaults()"><v-icon small left>mdi-playlist-plus</v-icon>{{ t('maintenance.defaults') }}</v-btn>
							<span class="text-caption machine-faint">{{ ms.data.notify ? t('maintenance.notify_on') : t('maintenance.notify_off') }}</span>
						</div>
					</template>
				</v-card-text>
			</v-card>
			<v-card outlined class="mb-4">
				<v-card-title class="text-subtitle-1 pb-0">{{ t('maintenance.history_title') }}</v-card-title>
				<v-card-text>
					<maintenance-history :rows="history" />
				</v-card-text>
			</v-card>
		</template>
		<div v-else-if="ms.status === 'loading'" class="text-body-2 machine-faint">{{ t('common.loading') }}</div>
		<div v-if="notice" class="text-body-2 success--text">{{ notice }}</div>
		<div v-if="opError" class="text-body-2 error--text">{{ opError }}</div>
	</div>
</template>

<script>
'use strict'

// Maintenance module (design 2.10): counters per axis (labelled as estimated), the plan with due markers, "done" (who and when are
// recorded by the service) and the plan editor. The counters and the plan live in the service; the page only shows and asks.
// A technician marks "done" and edits the plan (machine.maintenance.plan.set); the buttons follow the server's table (workshopCan).

import ErrorNotice from '../ErrorNotice.vue' // vue/_shared
import MaintenanceCounters from './MaintenanceCounters.vue'
import MaintenancePlan from './MaintenancePlan.vue'
import MaintenancePlanEditor from './MaintenancePlanEditor.vue'
import MaintenanceHistory from './MaintenanceHistory.vue'
import { textMixin } from './text-mixin.js'
import {
	createMaintenanceState, loadBegin, loaded, loadFailed, markBegin, markDone, markFailed, editBegin, editCancel, checkedItems, saveBegin, saveDone, saveFailed
} from '../state/maintenance-state.js'
import { planRows, counterRows, historyRows, defaultLabelKey } from '../lib/maintenance.js'
import { planErrorKey } from '../lib/plan-diff.js'
import { refusalOf } from '../api/machine-api.js'

export default {
	components: { ErrorNotice, MaintenanceCounters, MaintenancePlan, MaintenancePlanEditor, MaintenanceHistory },
	mixins: [textMixin],
	props: {
		api: { type: Object, required: true }, // createMachineApi(...)
		canMark: { type: Boolean, default: false }, // workshopCan('machine.maintenance.done'): the technician
		canEdit: { type: Boolean, default: false } // workshopCan('machine.maintenance.plan.set'): the technician
	},
	data() {
		return { ms: createMaintenanceState(), loadError: null, notice: '', opError: '' }
	},
	computed: {
		counters() {
			return counterRows(this.ms.data)
		},
		plan() {
			return planRows(this.ms.data)
		},
		history() {
			return historyRows(this.ms.data)
		}
	},
	created() {
		this.load()
	},
	methods: {
		async load() {
			loadBegin(this.ms)
			try {
				loaded(this.ms, await this.api.maintenance.get())
				this.loadError = null
			} catch (e) {
				loadFailed(this.ms, planErrorKey(refusalOf(e)), e && e.message)
				this.loadError = e
			}
		},
		// a refusal of the service as one line: its reason text and its own message
		failure(e) {
			if (e && e.code === 'cancelled') return ''
			return this.t(planErrorKey(refusalOf(e))) + (e && e.message ? ' (' + e.message + ')' : '')
		},
		async markDone(id) {
			this.notice = ''
			this.opError = ''
			markBegin(this.ms, id)
			try {
				markDone(this.ms, await this.api.maintenance.done(id))
				this.notice = this.t('maintenance.done_marked')
				await this.load() // the summary and the other numbers of the service
			} catch (e) {
				markFailed(this.ms)
				this.opError = this.failure(e)
			}
		},
		edit() {
			this.notice = ''
			this.opError = ''
			editBegin(this.ms, item => {
				const key = defaultLabelKey(item)
				return key ? this.t(key) : ''
			})
		},
		cancelEdit() {
			editCancel(this.ms)
		},
		async savePlan() {
			const items = checkedItems(this.ms)
			if (!items) return
			saveBegin(this.ms)
			try {
				await this.api.maintenance.savePlan(items, this.ms.notify)
				saveDone(this.ms)
				this.notice = this.t('maintenance.plan_saved')
				await this.load()
			} catch (e) {
				saveFailed(this.ms)
				this.opError = this.failure(e)
			}
		},
		async restoreDefaults() {
			this.notice = ''
			this.opError = ''
			try {
				await this.api.maintenance.restoreDefaults()
				this.notice = this.t('maintenance.plan_saved')
				await this.load()
			} catch (e) {
				this.opError = this.failure(e)
			}
		}
	}
}
</script>
