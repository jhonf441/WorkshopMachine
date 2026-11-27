<template>
	<div class="maintenance-module">
		<card-head icon="mdi-wrench-clock" :title="t('maintenance.title')" />
		<section-notice :error="loadError" retry @retry="load()" />
		<template v-if="ms.data">
			<div class="wf-group mb-4">
				<div class="wf-group-title d-flex align-center flex-wrap" style="gap: 8px">
					{{ t('maintenance.counters_title') }}
				</div>
				<div>
					<maintenance-counters :rows="counters" :data="ms.data.counters" />
				</div>
			</div>
			<div class="wf-group mb-4">
				<div class="wf-group-title d-flex align-center flex-wrap" style="gap: 8px">
					{{ t('maintenance.plan_title') }}
					<v-spacer />
					<v-btn v-if="!ms.editing" small outlined :disabled="!canEdit" @click="edit()"><v-icon small left>mdi-pencil</v-icon>{{ t('maintenance.edit') }}</v-btn>
				</div>
				<div>
					<maintenance-plan-editor v-if="ms.editing" :state="ms" :action="planAct" @save="savePlan()" @cancel="cancelEdit()" />
					<template v-else>
						<maintenance-plan :rows="plan" :can-mark="canMark" :marking="ms.marking" :action="markAct" @done="markDone" />
						<div class="d-flex align-center flex-wrap mt-2" style="gap:8px">
							<wf-action-button v-if="ms.data.planEmpty" :action="defaultsAct" :label="t('maintenance.defaults')" :disabled="!canEdit" @run="defaultsAct.run({})" />
							<span class="text-caption machine-faint">{{ ms.data.notify ? t('maintenance.notify_on') : t('maintenance.notify_off') }}</span>
						</div>
					</template>
					<lock-reason v-if="!canMark || !canEdit" :ops="accessOps.maintenance" min="technician" class="mt-2" :subject="$t('plugins.WorkshopMachine.subjects.maintenance')" />
				</div>
			</div>
			<div class="wf-group mb-4">
				<div class="wf-group-title d-flex align-center flex-wrap" style="gap: 8px">{{ t('maintenance.history_title') }}</div>
				<div>
					<maintenance-history :rows="history" />
				</div>
			</div>
		</template>
		<div v-else-if="ms.status === 'loading'" class="text-body-2 machine-faint">{{ t('common.loading') }}</div>
		<!-- what happened to the three writes of the page: the family line, one per write (empty when idle) -->
		<wf-result :action="markAct" :retry="false" />
		<wf-result :action="planAct" :retry="false" />
		<wf-result :action="defaultsAct" :retry="false" />
		<help-fold :title="t('maintenance.title')" class="mt-4"><p>{{ t('maintenance.intro') }}</p><div class="help-tip-title">{{ t('maintenance.counters_title') }}</div><p>{{ t('maintenance.estimated_note') }}</p></help-fold>
	</div>
</template>

<script>
'use strict'

// Maintenance module (design 2.10): counters per axis (labelled as estimated), the plan with due markers, "done" (who and when are
// recorded by the service) and the plan editor. The counters and the plan live in the service; the page only shows and asks.
// A technician marks "done" and edits the plan (machine.maintenance.plan.set); the buttons follow the server's table (workshopCan).

import SectionNotice from './SectionNotice.vue' // one notice per cause
import MaintenanceCounters from './MaintenanceCounters.vue'
import MaintenancePlan from './MaintenancePlan.vue'
import MaintenancePlanEditor from './MaintenancePlanEditor.vue'
import MaintenanceHistory from './MaintenanceHistory.vue'
import { textMixin } from './text-mixin.js'
import HelpFold from '../HelpFold.vue' // vue/_shared36
import {
	createMaintenanceState, loadBegin, loaded, loadFailed, markBegin, markDone, markFailed, editBegin, editCancel, checkedItems, saveBegin, saveDone, saveFailed
} from '../state/maintenance-state.js'
import { planRows, counterRows, historyRows, defaultLabelKey } from '../lib/maintenance.js'
import { planErrorKey } from '../lib/plan-diff.js'
import { refusalOf } from '../api/machine-api.js'
import { detailOf } from '../lib/refusal.js'
import LockReason from '../LockReason.vue' // vue/_shared36
import WfActionButton from '../WfActionButton.vue' // vue/_shared36
import WfResult from '../WfResult.vue' // vue/_shared36
import { createAction } from '../workshop-action.js' // vue/_shared36
import CardHead from '../CardHead.vue' // vue/_shared36

export default {
	components: { CardHead, WfActionButton, WfResult, LockReason, HelpFold, SectionNotice, MaintenanceCounters, MaintenancePlan, MaintenancePlanEditor, MaintenanceHistory },
	mixins: [textMixin],
	props: {
		api: { type: Object, required: true }, // createMachineApi(...)
		canMark: { type: Boolean, default: false }, // workshopCan('machine.maintenance.done'): the technician
		canEdit: { type: Boolean, default: false } // workshopCan('machine.maintenance.plan.set'): the technician
	},
	data() {
		return { ms: createMaintenanceState(), loadError: null }
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
		// the three writes of the page are writes of the family; a refusal of the service ends as the control's own line (failure() is its sentence)
		this.markAct = createAction({ run: ({ id }) => this.doMark(id) })
		this.planAct = createAction({ run: () => this.doSavePlan() })
		this.defaultsAct = createAction({ run: () => this.doDefaults() })
		this.load()
	},
	beforeDestroy() {
		;[this.markAct, this.planAct, this.defaultsAct].forEach(a => a.dispose())
	},
	methods: {
		async load() {
			loadBegin(this.ms)
			try {
				loaded(this.ms, await this.api.maintenance.get())
				this.loadError = null
			} catch (e) {
				loadFailed(this.ms, planErrorKey(refusalOf(e)), detailOf(e))
				this.loadError = e
			}
		},
		// a refusal of the service as one line: its reason text and its own message
		failure(e) {
			if (e && e.code === 'cancelled') return ''
			return this.t(planErrorKey(refusalOf(e))) + (detailOf(e) ? ' (' + detailOf(e) + ')' : '')
		},
		markDone(id) {
			this.markAct.run({ id })
		},
		async doMark(id) {
			markBegin(this.ms, id)
			try {
				markDone(this.ms, await this.api.maintenance.done(id))
				await this.load() // the summary and the other numbers of the service
				return { text: this.t('maintenance.done_marked') }
			} catch (e) {
				markFailed(this.ms)
				throw this.refused(e)
			}
		},
		refused(e) {
			return Object.assign(new Error(this.failure(e)), { code: 'internal' })
		},
		edit() {
			this.markAct.reset()
			this.planAct.reset()
			this.defaultsAct.reset()
			editBegin(this.ms, item => {
				const key = defaultLabelKey(item)
				return key ? this.t(key) : ''
			})
		},
		cancelEdit() {
			editCancel(this.ms)
		},
		savePlan() {
			if (checkedItems(this.ms)) this.planAct.run({})
		},
		async doSavePlan() {
			const items = checkedItems(this.ms)
			if (!items) throw this.refused(null)
			saveBegin(this.ms)
			try {
				await this.api.maintenance.savePlan(items, this.ms.notify)
				saveDone(this.ms)
				await this.load()
				return { text: this.t('maintenance.plan_saved') }
			} catch (e) {
				saveFailed(this.ms)
				throw this.refused(e)
			}
		},
		async doDefaults() {
			try {
				await this.api.maintenance.restoreDefaults()
				await this.load()
				return { text: this.t('maintenance.plan_saved') }
			} catch (e) {
				throw this.refused(e)
			}
		}
	}
}
</script>
