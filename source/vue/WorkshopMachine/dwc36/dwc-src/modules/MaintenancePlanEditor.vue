<template>
	<div class="maintenance-plan-editor">
		<div v-for="(d, i) in state.drafts" :key="i" class="d-flex align-start flex-wrap mb-2" style="gap:8px">
			<v-text-field v-model="d.id" :label="t('maintenance.field_id')" dense outlined hide-details="auto" style="max-width:150px" :error-messages="errorsOf(i, ['id', 'duplicate'])" />
			<v-text-field v-model="d.label" :label="t('maintenance.field_label')" dense outlined hide-details="auto" style="min-width:200px;max-width:320px" :error-messages="errorsOf(i, ['label'])" />
			<v-select v-model="d.axis" :items="axisItems" :label="t('maintenance.field_axis')" dense outlined hide-details style="max-width:140px" />
			<v-text-field v-model="d.value" :label="t('maintenance.field_every')" dense outlined hide-details="auto" style="max-width:110px" :error-messages="errorsOf(i, ['value'])" />
			<v-select v-model="d.unit" :items="unitItems" :label="t('maintenance.field_unit')" dense outlined hide-details style="max-width:130px" />
			<v-select v-if="d.unit === 'hours'" v-model="d.basis" :items="basisItems" :label="t('maintenance.field_basis')" dense outlined hide-details style="max-width:170px" />
			<v-btn small icon :title="t('maintenance.remove')" @click="remove(i)"><v-icon small>mdi-delete-outline</v-icon></v-btn>
		</div>
		<div v-if="generalError" class="text-body-2 error--text">{{ generalError }}</div>
		<v-checkbox v-model="state.notify" dense hide-details :label="t('maintenance.field_notify')" />
		<div class="d-flex align-center flex-wrap mt-2" style="gap:8px">
			<v-btn small outlined @click="add()"><v-icon small left>mdi-plus</v-icon>{{ t('maintenance.add') }}</v-btn>
			<v-spacer />
			<v-btn small text :disabled="state.saving" @click="$emit('cancel')">{{ t('maintenance.cancel') }}</v-btn>
			<v-btn small color="primary" :disabled="!saveReady" :loading="state.saving" @click="$emit('save')">{{ t('maintenance.save_plan') }}</v-btn>
		</div>
	</div>
</template>

<script>
'use strict'

// The plan editor: one row per item (the whole plan is sent at once), the opt-in phone notice; the checks mirror the service's and are shown when saving.

import { textMixin } from './text-mixin.js'
import { addDraft, removeDraft, canSave } from '../state/maintenance-state.js'
import { UNITS, BASES, AXES, errorKey } from '../lib/maintenance-plan.js'

export default {
	mixins: [textMixin],
	props: {
		state: { type: Object, required: true } // the state of state/maintenance-state.js (drafts are edited in place)
	},
	computed: {
		axisItems() {
			return AXES.map(a => ({ value: a, text: a || this.t('maintenance.any_axis') }))
		},
		unitItems() {
			return UNITS.map(u => ({ value: u, text: this.t('maintenance.unit_' + u) }))
		},
		basisItems() {
			return BASES.map(b => ({ value: b, text: this.t('maintenance.basis_' + b) }))
		},
		saveReady() {
			return canSave(this.state)
		},
		generalError() {
			const e = this.state.planErrors.find(x => x.row < 0)
			return e ? this.t(errorKey(e.code)) : ''
		}
	},
	methods: {
		add() {
			addDraft(this.state)
		},
		remove(row) {
			removeDraft(this.state, row)
		},
		errorsOf(row, codes) {
			return this.state.planErrors.filter(e => e.row === row && codes.indexOf(e.code) >= 0).map(e => this.t(errorKey(e.code)))
		}
	}
}
</script>
