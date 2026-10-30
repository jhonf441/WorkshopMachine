<template>
	<div class="mesh-library">
		<div class="d-flex align-center flex-wrap mb-2" style="gap:8px">
			<v-chip size="small" variant="outlined" :color="compensationOn ? 'success' : 'grey'">
				<v-icon size="x-small" start>{{ compensationOn ? 'mdi-grid' : 'mdi-grid-off' }}</v-icon>{{ compensationOn ? t('mesh.compensation_on') : t('mesh.compensation_off') }}
			</v-chip>
			<v-btn size="small" variant="outlined" :disabled="!canWrite || !compensationOn || busy" @click="$emit('clear')">
				<v-icon size="small" start>mdi-close</v-icon>{{ t('mesh.clear') }}
			</v-btn>
		</div>
		<div v-if="unavailable" class="text-body-medium machine-faint">{{ t('mesh.no_service_meshes') }}</div>
		<div v-else-if="!meshes.length" class="text-body-medium machine-faint">{{ t('mesh.library_empty') }}</div>
		<v-table v-else density="compact">
			<tbody>
				<tr v-for="m in meshes" :key="m.id">
					<td>
						{{ m.name }}
						<v-chip v-if="m.active" size="x-small" variant="outlined" color="success" class="ml-1">{{ t('mesh.active') }}</v-chip>
					</td>
					<td class="text-body-small machine-faint">{{ m.user }}</td>
					<td class="text-right">
						<v-btn size="x-small" variant="text" :disabled="busy" @click="$emit('show', m.id)">{{ t('mesh.show') }}</v-btn>
						<v-btn size="x-small" variant="text" color="primary" :disabled="!canWrite || busy || m.active" @click="$emit('load', m.id)">{{ t('mesh.load') }}</v-btn>
					</td>
				</tr>
			</tbody>
		</v-table>
		<div v-if="!canWrite" class="text-body-small machine-faint mt-2">{{ t('mesh.read_only') }}</div>
		<template v-if="canWrite">
			<div class="d-flex align-start flex-wrap mt-3" style="gap:8px">
				<v-text-field v-model="name" :label="t('mesh.save_name')" density="compact" variant="outlined" hide-details="auto" style="max-width:240px" :error-messages="nameError" />
				<v-btn size="small" color="primary" :disabled="busy || !nameCheck.ok" @click="$emit('save', nameCheck.name)">
					<v-icon size="small" start>mdi-content-save</v-icon>{{ t('mesh.save') }}
				</v-btn>
			</div>
			<div class="d-flex align-start flex-wrap mt-3" style="gap:8px">
				<v-text-field v-model="taper" :label="t('mesh.taper')" type="number" density="compact" variant="outlined" hide-details="auto" style="max-width:160px" :error-messages="taperError" />
				<v-btn size="small" variant="outlined" :disabled="busy || !taperCheck.ok" @click="$emit('taper', taperCheck.height)">{{ t('mesh.taper_apply') }}</v-btn>
			</div>
			<div class="text-body-small machine-faint mt-1">{{ t('mesh.taper_hint') }}</div>
		</template>
		<div v-if="notice" class="text-body-medium text-success mt-2">{{ notice }}</div>
		<div v-if="error" class="text-body-medium text-error mt-2">{{ error }}</div>
	</div>
</template>

<script setup>
// Load, clear, save and taper of the mesh compensation (design 2.4), plus the library list. Loading and clearing change the compensation
// of the machine, so they are for a technician (`canWrite`); an operator sees the list and shows a mesh on the map. The operations
// themselves are in MeshModule (it owns the api).

import { computed, ref } from 'vue'
import { t } from '../text.js'
import { saveName, taperParams } from '../lib/mesh-grid.js'

defineProps({
	meshes: { type: Array, default: () => [] },
	compensationOn: { type: Boolean, default: false },
	canWrite: { type: Boolean, default: false },
	busy: { type: Boolean, default: false },
	unavailable: { type: Boolean, default: false }, // the service does not have the library yet
	notice: { type: String, default: '' },
	error: { type: String, default: '' }
})
defineEmits(['clear', 'show', 'load', 'save', 'taper'])

const name = ref('')
const taper = ref('0')

const nameCheck = computed(() => saveName(name.value))
const nameError = computed(() => (name.value && !nameCheck.value.ok ? [t(nameCheck.value.errorKey)] : []))
const taperCheck = computed(() => taperParams(taper.value))
const taperError = computed(() => (taperCheck.value.ok ? [] : [t(taperCheck.value.errorKey)]))
</script>

