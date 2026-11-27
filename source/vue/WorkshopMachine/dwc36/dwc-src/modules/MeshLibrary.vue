<template>
	<div class="mesh-library">
		<div class="d-flex align-center flex-wrap mb-2" style="gap:8px">
			<v-chip small outlined :color="compensationOn ? 'success' : 'grey'">
				<v-icon x-small left>{{ compensationOn ? 'mdi-grid' : 'mdi-grid-off' }}</v-icon>{{ compensationOn ? t('mesh.compensation_on') : t('mesh.compensation_off') }}
			</v-chip>
			<wf-action-button :action="acts.clear" danger :label="t('mesh.clear')" :arm-label="t('mesh.clear_confirm')" :disabled="!canWrite || !compensationOn || busy" @run="$emit('clear')" />
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
						<wf-action-button variant="text" :action="loadingId === m.id ? acts.load : null" :label="t('mesh.load')" :disabled="!canWrite || busy || m.active" @run="$emit('load', m.id)" />
					</td>
				</tr>
			</tbody>
		</v-simple-table>
		<lock-reason :ops="accessOps.mesh" min="technician" class="mt-2" :subject="$t('plugins.WorkshopMachine.subjects.mesh_library')" />
		<template v-if="canWrite">
			<div class="d-flex align-start flex-wrap mt-3" style="gap:8px">
				<v-text-field v-model="name" :label="t('mesh.save_name')" dense outlined hide-details="auto" style="max-width:240px" :error-messages="nameError" />
				<wf-action-button :action="acts.save" main :label="t('mesh.save')" :disabled="busy || !nameCheck.ok" @run="$emit('save', nameCheck.name)" />
			</div>
			<div class="d-flex align-start flex-wrap mt-3" style="gap:8px">
				<v-text-field v-model="taper" :label="t('mesh.taper')" type="number" dense outlined hide-details="auto" style="max-width:160px" :error-messages="taperError" />
				<wf-action-button :action="acts.taper" data-wf-hit :label="t('mesh.taper_apply')" :disabled="busy || !taperCheck.ok" @run="$emit('taper', taperCheck.height)" />
			</div>
			<div class="text-caption machine-faint mt-1">{{ t('mesh.taper_hint') }}</div>
		</template>
		<!-- what happened to each write: the family line (empty when idle); `error` is a failure of a READ (the list, a mesh to show) -->
		<wf-result v-for="k in ['load', 'clear', 'save', 'taper']" :key="k" :action="acts[k]" :retry="false" class="mt-2" />
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
import LockReason from '../LockReason.vue' // vue/_shared36
import WfActionButton from '../WfActionButton.vue' // vue/_shared36
import WfResult from '../WfResult.vue' // vue/_shared36

export default {
	components: { LockReason, WfActionButton, WfResult },
	mixins: [textMixin],
	props: {
		meshes: { type: Array, default: () => [] },
		compensationOn: { type: Boolean, default: false },
		canWrite: { type: Boolean, default: false },
		busy: { type: Boolean, default: false },
		unavailable: { type: Boolean, default: false }, // the service does not have the library yet
		acts: { type: Object, default: () => ({ load: null, clear: null, save: null, taper: null }) }, // { load, clear, save, taper }: createAction of each write (MeshModule owns them)
		loadingId: { type: String, default: '' }, // the mesh of the row whose Load was touched last (that row shows the state)
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
