<template>
	<div class="probe-bed">
		<v-alert v-if="!model.bed" density="compact" variant="outlined" type="info" class="mb-0">
			<div>{{ t('bed.no_bed') }}</div>
			<div v-for="m in model.missing" :key="m" class="text-body-small">{{ t('bed.missing_' + m) }}</div>
		</v-alert>
		<template v-else>
			<v-alert v-for="m in model.missing" :key="m" density="compact" text type="info" class="mb-2 text-body-small">{{ t('bed.missing_' + m) }}</v-alert>
			<!-- the same two columns as Mesh and Level, so the bed is drawn at the same size on the three pages -->
			<v-row density="compact">
				<v-col cols="12" md="8">
					<bed-svg :bed="model.bed" :include="model.screws" :reach="model.reach" :offset="model.offset" :label="t('bed.probe_label')" />
				</v-col>
				<v-col cols="12" md="4">
					<div v-if="model.offset" class="text-body-medium">{{ t('bed.probe_offset', { x: model.offset.x, y: model.offset.y }) }}</div>
				</v-col>
			</v-row>
		</template>
	</div>
</template>

<script setup>
// The probe on the bed (reuse of the shared bed view): where the probe can reach and how far it sits from the nozzle, drawn at true
// scale. Read only; the numbers come from machine.layout (state/bed-state.js modelOf).

import BedSvg from './BedSvg.vue'
import { t } from '../text.js'

defineProps({
	model: { type: Object, required: true } // state/bed-state.js modelOf(...)
})
</script>
