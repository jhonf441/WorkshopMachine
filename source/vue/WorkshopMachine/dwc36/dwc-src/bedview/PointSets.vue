<template>
	<v-card outlined class="point-sets pa-3" role="region" :aria-label="t('bed.sets_title')">
		<div class="text-subtitle-2">{{ t('bed.sets_title') }}</div>
		<div v-if="!view.available" class="text-body-2 machine-faint mt-1"><v-icon small left>mdi-information-outline</v-icon>{{ t('bed.sets_off_' + view.reason) }}</div>
		<template v-else>
			<p class="text-caption machine-faint mb-2">{{ t('bed.sets_intro') }}</p>
			<div v-if="!rows.length" class="text-body-2 machine-faint">{{ t('bed.sets_empty') }}</div>
			<div v-for="s in rows" :key="s.id" class="d-flex align-center point-sets-row" style="gap:6px">
				<span class="text-body-2 flex-grow-1">{{ s.name }} <span class="machine-faint">({{ t('bed.sets_points', { n: s.count }) }})</span></span>
				<v-btn small outlined :disabled="busy || !s.fits || !editable" :title="s.fits ? '' : t('bed.sets_too_big', { max })" style="min-height:44px" @click="$emit('load', s.id)"><v-icon small left>mdi-tray-arrow-down</v-icon>{{ t('bed.sets_load') }}</v-btn>
				<v-btn v-if="canWrite" icon :disabled="busy" :aria-label="t('bed.sets_delete', { name: s.name })" style="min-width:44px;min-height:44px" @click="$emit('remove', s.id)"><v-icon small>mdi-delete-outline</v-icon></v-btn>
			</div>
			<form v-if="canWrite" class="d-flex align-center flex-wrap mt-2" style="gap:8px" @submit.prevent="save()">
				<v-text-field v-model="name" :label="t('bed.sets_name')" dense outlined hide-details style="max-width:220px" :error="!!error" />
				<v-btn small outlined type="submit" :disabled="busy || !canSave" :title="canSave ? '' : t('bed.sets_nothing_to_save')" style="min-height:44px"><v-icon small left>mdi-content-save-outline</v-icon>{{ t('bed.sets_save') }}</v-btn>
			</form>
			<div v-else class="text-caption machine-faint mt-2">{{ t('bed.sets_read_only') }}</div>
			<div v-if="error" class="text-body-2 error--text mt-1" role="alert">{{ error }}</div>
			<div v-else-if="notice" class="text-body-2 mt-1" role="status">{{ notice }}</div>
		</template>
	</v-card>
</template>

<script>
'use strict'

// Named point sets ("corners", "centre and edges") shared by Mesh and Level and kept per machine in the service settings store (see
// api/machine-api-p7.js). A technician and above can save and delete, an operator can only load. When the store is not there the card is
// still shown with the reason it is off (never silently missing). `view` comes from modules/pointsets-mixin.js.

import { textMixin } from '../modules/text-mixin.js'
import { offered } from '../lib/point-sets.js'

export default {
	mixins: [textMixin],
	props: {
		view: { type: Object, required: true }, // {available, reason, sets, canWrite, busy, notice, error}
		editable: { type: Boolean, default: true }, // loading replaces the points: only while they can be edited
		canSave: { type: Boolean, default: false }, // there are points to save
		max: { type: Number, default: 0 } // the most points the tool takes (Level); 0 = no limit
	},
	data() {
		return { name: '' }
	},
	computed: {
		rows() {
			return offered(this.view.sets, this.max)
		},
		canWrite() {
			return this.view.canWrite
		},
		busy() {
			return this.view.busy
		},
		error() {
			return this.view.error
		},
		notice() {
			return this.view.notice
		}
	},
	methods: {
		save() {
			this.$emit('save', this.name)
		}
	}
}
</script>

<style>
.point-sets-row { min-height: 48px; }
</style>
