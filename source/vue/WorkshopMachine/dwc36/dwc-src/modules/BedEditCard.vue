<template>
	<div class="bed-edit">
		<div class="d-flex align-center flex-wrap" style="gap: 8px">
			<v-btn small outlined :disabled="!canOpen" :aria-label="t('beds.edit_btn')" @click="open()"><v-icon small left>mdi-pencil-outline</v-icon>{{ t('beds.edit_btn') }}</v-btn>
			<span v-if="reason" class="text-caption warning--text bed-edit-reason">{{ reason }}</span>
			<role-note v-if="!canWrite" min="technician" class="text-caption" />
		</div>
		<div v-if="editing" class="mt-3 bed-edit-form">
			<div class="text-subtitle-2 mb-1">{{ t('beds.edit_title', { n: row.bed }) }}</div>
			<p class="text-body-2 machine-faint">{{ t('beds.edit_intro') }}</p>
			<div class="bed-edit-grid">
				<div class="bed-edit-field">
					<div class="bed-edit-label"><label :for="'be-h-' + row.bed" class="text-caption">{{ t('beds.edit_f_heater') }}</label><help-tip :title="t('beds.edit_f_heater')" :what="t('beds.help.edit_heater_what')" :why="t('beds.help.edit_heater_why')" :if-missing="t('beds.help.edit_heater_missing')" :how="t('beds.help.edit_heater_how')" /></div>
					<v-text-field :id="'be-h-' + row.bed" v-model="draft.heater" dense outlined hide-details inputmode="numeric" :disabled="locked" :error="!!issueOf('heater')" :aria-label="t('beds.edit_f_heater')" />
					<div v-if="issueOf('heater')" class="text-caption error--text">{{ message('heater') }}</div>
				</div>
				<div class="bed-edit-field">
					<div class="bed-edit-label"><label :for="'be-s-' + row.bed" class="text-caption">{{ t('beds.edit_f_sensor') }}</label><help-tip :title="t('beds.edit_f_sensor')" :what="t('beds.help.edit_sensor_what')" :why="t('beds.help.edit_sensor_why')" :if-missing="t('beds.help.edit_sensor_missing')" :how="t('beds.help.edit_sensor_how')" /></div>
					<v-text-field :id="'be-s-' + row.bed" v-model="draft.sensor" dense outlined hide-details inputmode="numeric" :disabled="locked || !sensorOk" :error="!!issueOf('sensor')" :aria-label="t('beds.edit_f_sensor')" />
					<div v-if="!sensorOk" class="text-caption machine-faint">{{ t('beds.edit_no_sensor') }}</div>
					<div v-if="issueOf('sensor')" class="text-caption error--text">{{ message('sensor') }}</div>
				</div>
			</div>
			<div v-if="issueOf('draft')" class="text-caption machine-faint mt-1">{{ message('draft') }}</div>
			<div class="d-flex align-center flex-wrap mt-2" style="gap: 8px">
				<v-btn small color="primary" :disabled="!canPlan || working || !!applied || ps.status === 'review'" :loading="ps.status === 'planning'" @click="createPlan()"><v-icon small left>mdi-clipboard-check-outline</v-icon>{{ t('beds.edit_plan_btn') }}</v-btn>
				<v-btn small text @click="close()">{{ applied ? t('beds.edit_close') : t('beds.edit_cancel') }}</v-btn>
			</div>
			<plan-review v-if="ps.status !== 'idle'" class="mt-2" :state="ps" :title="t('beds.edit_review')" :role-ok="canWrite" @apply="applyPlan()" @reset="flow.reset()" />
			<v-alert v-if="applied" dense outlined type="success" class="mt-2 text-body-2">{{ t('beds.edit_applied') }}</v-alert>
		</div>
	</div>
</template>

<script>
'use strict'

// Edit button of a bed the board already has (DWC 3.6, technician): another heater and / or sensor number, through the plan of every other change of the configuration
// (kind config.bed_edit: the plan IS the preview, with the exact diff of each file, the backup and the history; the machine restarts to read it). The page never sends
// loose G-code. The service operation is behind api.beds.planEdit (api/machine-api-beds.js); the checks that block are in lib/bed-edit.js and the service enforces them again.

import HelpTip from '../HelpTip.vue' // vue/_shared36
import RoleNote from './RoleNote.vue'
import PlanReview from './PlanReview.vue'
import { textMixin } from './text-mixin.js'
import { createPlanFlow } from '../state/plan-flow.js'
import { isWorking } from '../state/plan-state.js'
import { editLimits, editDraft, sensorEditable, toEditSpec, specKeyEdit, editIssues } from '../lib/bed-edit.js'

export default {
	mixins: [textMixin],
	components: { HelpTip, RoleNote, PlanReview },
	props: {
		api: { type: Object, required: true },
		row: { type: Object, required: true }, // one of definedRows(): {bed, heater, fileSensor, editable, loaded, ...}
		canWrite: { type: Boolean, default: false }, // technician: creating the plan (the service checks again)
		busy: { type: Boolean, default: false }, // a procedure is running: the machine is not free
		model: { type: Object, default: null } // the live object model (limits.heaters, limits.sensors)
	},
	data() {
		return { editing: false, draft: editDraft(this.row), applied: false, ps: null, flow: null }
	},
	computed: {
		ctx() {
			return { limits: editLimits(this.model), canWrite: this.canWrite, busy: this.busy }
		},
		issues() {
			return editIssues(this.row, this.draft, this.ctx)
		},
		sensorOk() {
			return sensorEditable(this.row)
		},
		// why the button is off, in plain words (the missing role has its own note: RoleNote)
		reason() {
			if (!this.row.editable) return this.t('beds.edit_no_line')
			return this.busy ? this.t('beds.block_busy') : ''
		},
		canOpen() {
			return this.canWrite && this.row.editable && !this.busy
		},
		canPlan() {
			return this.issues.length === 0
		},
		locked() {
			return !!this.applied
		},
		working() {
			return isWorking(this.ps)
		},
		key() {
			return specKeyEdit(this.row, this.draft)
		}
	},
	watch: {
		// any edit makes the plan under review stale: it is dropped, never applied by mistake
		key() {
			if (!this.applied && this.ps.status !== 'idle') this.flow.reset()
		}
	},
	created() {
		this.flow = createPlanFlow({ apply: plan => this.api.beds.apply(plan) })
		this.ps = this.flow.state
	},
	methods: {
		open() {
			this.draft = editDraft(this.row)
			this.applied = false
			this.flow.reset()
			this.editing = true
		},
		close() {
			this.editing = false
			this.flow.reset()
		},
		issueOf(field) {
			return this.issues.find(x => x.field === field) || null
		},
		message(field) {
			const it = this.issueOf(field)
			return it ? this.t('beds.edit_err_' + it.code, it.params) : ''
		},
		createPlan() {
			if (!this.canPlan) return null
			return this.flow.propose(async () => ({ plan: await this.api.beds.planEdit(toEditSpec(this.row, this.draft)), conflict: null }))
		},
		async applyPlan() {
			await this.flow.apply(this.canWrite)
			if (this.ps.status === 'done') this.applied = true
		}
	}
}
</script>

<style scoped>
.bed-edit-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 12px; max-width: 480px; }
.bed-edit-field { min-width: 0; display: flex; flex-direction: column; }
.bed-edit-label { display: flex; align-items: center; gap: 4px; min-height: 28px; }
</style>
