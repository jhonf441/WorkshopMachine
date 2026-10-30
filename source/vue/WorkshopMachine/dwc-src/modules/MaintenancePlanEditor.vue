<template>
	<div class="maintenance-plan-editor">
		<div v-for="(d, i) in state.drafts" :key="i" class="d-flex align-start flex-wrap mb-2" style="gap:8px">
			<v-text-field v-model="d.id" :label="t('maintenance.field_id')" density="compact" variant="outlined" hide-details="auto" style="max-width:150px" :error-messages="errorsOf(i, ['id', 'duplicate'])" />
			<v-text-field v-model="d.label" :label="t('maintenance.field_label')" density="compact" variant="outlined" hide-details="auto" style="min-width:200px;max-width:320px" :error-messages="errorsOf(i, ['label'])" />
			<v-select v-model="d.axis" :items="axisItems" item-title="text" :label="t('maintenance.field_axis')" density="compact" variant="outlined" hide-details style="max-width:140px" />
			<v-text-field v-model="d.value" :label="t('maintenance.field_every')" density="compact" variant="outlined" hide-details="auto" style="max-width:110px" :error-messages="errorsOf(i, ['value'])" />
			<v-select v-model="d.unit" :items="unitItems" item-title="text" :label="t('maintenance.field_unit')" density="compact" variant="outlined" hide-details style="max-width:130px" />
			<v-select v-if="d.unit === 'hours'" v-model="d.basis" :items="basisItems" item-title="text" :label="t('maintenance.field_basis')" density="compact" variant="outlined" hide-details style="max-width:170px" />
			<v-btn size="small" icon :title="t('maintenance.remove')" @click="remove(i)"><v-icon size="small">mdi-delete-outline</v-icon></v-btn>
		</div>
		<div v-if="generalError" class="text-body-medium text-error">{{ generalError }}</div>
		<v-checkbox v-model="state.notify" density="compact" hide-details :label="t('maintenance.field_notify')" />
		<div class="d-flex align-center flex-wrap mt-2" style="gap:8px">
			<v-btn size="small" variant="outlined" @click="add()"><v-icon size="small" start>mdi-plus</v-icon>{{ t('maintenance.add') }}</v-btn>
			<v-spacer />
			<v-btn size="small" variant="text" :disabled="state.saving" @click="$emit('cancel')">{{ t('maintenance.cancel') }}</v-btn>
			<v-btn size="small" color="primary" :disabled="!saveReady" :loading="state.saving" @click="$emit('save')">{{ t('maintenance.save_plan') }}</v-btn>
		</div>
	</div>
</template>

<script setup>
// The plan editor: one row per item (the whole plan is sent at once), the opt-in phone notice; the checks mirror the service's and are shown when saving.

import { computed } from 'vue'
import { t } from '../text.js'
import { addDraft, removeDraft, canSave } from '../state/maintenance-state.js'
import { UNITS, BASES, AXES, errorKey } from '../lib/maintenance-plan.js'

const props = defineProps({
	state: { type: Object, required: true } // the state of state/maintenance-state.js (drafts are edited in place)
})
defineEmits(['cancel', 'save'])

const axisItems = computed(() => AXES.map(a => ({ value: a, text: a || t('maintenance.any_axis') })))
const unitItems = computed(() => UNITS.map(u => ({ value: u, text: t('maintenance.unit_' + u) })))
const basisItems = computed(() => BASES.map(b => ({ value: b, text: t('maintenance.basis_' + b) })))
const saveReady = computed(() => canSave(props.state))
const generalError = computed(() => {
	const e = props.state.planErrors.find(x => x.row < 0)
	return e ? t(errorKey(e.code)) : ''
})

function add() {
	addDraft(props.state)
}
function remove(row) {
	removeDraft(props.state, row)
}
function errorsOf(row, codes) {
	return props.state.planErrors.filter(e => e.row === row && codes.indexOf(e.code) >= 0).map(e => t(errorKey(e.code)))
}
</script>
