<template>
	<div class="mesh-run-form">
		<div v-if="locked" class="text-body-medium mb-2" role="status">
			<v-icon size="small" start>mdi-lock-outline</v-icon>{{ t('mesh.locked_by_points', { nx: locked.nx, ny: locked.ny, x0: locked.region.xmin, x1: locked.region.xmax, y0: locked.region.ymin, y1: locked.region.ymax }) }}
		</div>
		<v-radio-group v-if="!locked" v-model="inputs.mode" inline density="compact" hide-details class="mt-0 mb-2" :disabled="disabled">
			<v-radio value="bed" :label="t('mesh.mode_bed')" />
			<v-radio value="region" :label="t('mesh.mode_region')" />
		</v-radio-group>
		<v-row density="compact">
			<v-col v-if="!locked" cols="4" sm="2">
				<v-text-field v-model="inputs.nx" :label="t('mesh.field_nx')" type="number" density="compact" variant="outlined" hide-details="auto" :disabled="disabled" :error-messages="errorOf('nx')" />
			</v-col>
			<v-col v-if="!locked" cols="4" sm="2">
				<v-text-field v-model="inputs.ny" :label="t('mesh.field_ny')" type="number" density="compact" variant="outlined" hide-details="auto" :disabled="disabled" :error-messages="errorOf('ny')" />
			</v-col>
			<v-col cols="4" sm="2">
				<v-text-field v-model="inputs.probe" :label="t('mesh.field_probe')" type="number" density="compact" variant="outlined" hide-details="auto" :disabled="disabled" :error-messages="errorOf('probe')" />
			</v-col>
		</v-row>
		<v-row v-if="inputs.mode === 'region' && !locked" density="compact" class="mt-1">
			<v-col v-for="f in regionFields" :key="f" cols="6" sm="3">
				<v-text-field v-model="inputs.region[f]" :label="t('mesh.field_' + f)" type="number" density="compact" variant="outlined" hide-details="auto" :disabled="disabled" :error-messages="regionError" />
			</v-col>
		</v-row>
	</div>
</template>

<script setup>
// Inputs of the mesh run: whole bed or a region, points per axis (2-21) and the probe; while points are chosen on the bed the counts and the
// region come from them (`locked`) and only the probe is typed. `inputs` is the draft of the module state, `form` is
// probeParams(...) so the errors shown are the ones of the pure validation.

import { computed } from 'vue'
import { t } from '../text.js'

const props = defineProps({
	inputs: { type: Object, required: true },
	form: { type: Object, required: true },
	disabled: { type: Boolean, default: false },
	locked: { type: Object, default: null } // the grid derived from the chosen points {nx, ny, region}: the counts and the region are not typed then
})

const regionFields = ['xmin', 'xmax', 'ymin', 'ymax']
const regionError = computed(() => (props.form.errors.region ? [t(props.form.errors.region)] : []))

function errorOf(field) {
	return props.form.errors[field] ? [t(props.form.errors[field])] : []
}
</script>

