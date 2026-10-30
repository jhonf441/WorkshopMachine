<template>
	<div class="mesh-library">
		<div class="d-flex align-center flex-wrap mb-2" style="gap:8px">
			<v-chip small outlined :color="compensationOn ? 'success' : 'grey'">
				<v-icon x-small left>{{ compensationOn ? 'mdi-grid' : 'mdi-grid-off' }}</v-icon>{{ compensationOn ? t('mesh.compensation_on') : t('mesh.compensation_off') }}
			</v-chip>
			<v-btn small outlined :disabled="!canWrite || !compensationOn || busy" @click="$emit('clear')">
				<v-icon small left>mdi-close</v-icon>{{ t('mesh.clear') }}
			</v-btn>
		</div>
		<div v-if="unavailable" class="text-body-2 machine-faint">{{ t('mesh.no_service_meshes') }}</div>
		<div v-else-if="!meshes.length" class="text-body-2 machine-faint">{{ t('mesh.library_empty') }}</div>
		<v-simple-table v-else dense>
			<tbody>
				<tr v-for="m in meshes" :key="m.id">
					<td>
						{{ m.name }}
						<v-chip v-if="m.active" x-small outlined color="success" class="ml-1">{{ t('mesh.active') }}</v-chip>
					</td>
					<td class="text-caption machine-faint">{{ m.user }}</td>
					<td class="text-right">
						<v-btn x-small text :disabled="busy" @click="$emit('show', m.id)">{{ t('mesh.show') }}</v-btn>
						<v-btn x-small text color="primary" :disabled="!canWrite || busy || m.active" @click="$emit('load', m.id)">{{ t('mesh.load') }}</v-btn>
					</td>
				</tr>
			</tbody>
		</v-simple-table>
		<div v-if="!canWrite" class="text-caption machine-faint mt-2">{{ t('mesh.read_only') }}</div>
		<template v-if="canWrite">
			<div class="d-flex align-start flex-wrap mt-3" style="gap:8px">
				<v-text-field v-model="name" :label="t('mesh.save_name')" dense outlined hide-details="auto" style="max-width:240px" :error-messages="nameError" />
				<v-btn small color="primary" :disabled="busy || !nameCheck.ok" @click="$emit('save', nameCheck.name)">
					<v-icon small left>mdi-content-save</v-icon>{{ t('mesh.save') }}
				</v-btn>
			</div>
			<div class="d-flex align-start flex-wrap mt-3" style="gap:8px">
				<v-text-field v-model="taper" :label="t('mesh.taper')" type="number" dense outlined hide-details="auto" style="max-width:160px" :error-messages="taperError" />
				<v-btn small outlined :disabled="busy || !taperCheck.ok" @click="$emit('taper', taperCheck.height)">{{ t('mesh.taper_apply') }}</v-btn>
			</div>
			<div class="text-caption machine-faint mt-1">{{ t('mesh.taper_hint') }}</div>
		</template>
		<div v-if="notice" class="text-body-2 success--text mt-2">{{ notice }}</div>
		<div v-if="error" class="text-body-2 error--text mt-2">{{ error }}</div>
	</div>
</template>

<script>
'use strict'

// Load, clear, save and taper of the mesh compensation (design 2.4), plus the library list. Loading and clearing change the compensation
// of the machine, so they are for a technician (`canWrite`); an operator sees the list and shows a mesh on the map. The operations
// themselves are in MeshModule (it owns the api).

import { textMixin } from './text-mixin.js'
import { saveName, taperParams } from '../lib/mesh-grid.js'

export default {
	mixins: [textMixin],
	props: {
		meshes: { type: Array, default: () => [] },
		compensationOn: { type: Boolean, default: false },
		canWrite: { type: Boolean, default: false },
		busy: { type: Boolean, default: false },
		unavailable: { type: Boolean, default: false }, // the service does not have the library yet
		notice: { type: String, default: '' },
		error: { type: String, default: '' }
	},
	data() {
		return { name: '', taper: '0' }
	},
	computed: {
		nameCheck() {
			return saveName(this.name)
		},
		nameError() {
			return this.name && !this.nameCheck.ok ? [this.t(this.nameCheck.errorKey)] : []
		},
		taperCheck() {
			return taperParams(this.taper)
		},
		taperError() {
			return this.taperCheck.ok ? [] : [this.t(this.taperCheck.errorKey)]
		}
	}
}
</script>
