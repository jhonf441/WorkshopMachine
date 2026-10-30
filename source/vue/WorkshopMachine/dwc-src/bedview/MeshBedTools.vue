<template>
	<div v-if="show" class="d-flex align-center flex-wrap mb-2" style="gap:8px">
		<template v-if="view === 'plan' && editable && !resizable && pointsMode">
			<span class="text-body-small machine-faint">{{ t('bed.resize_needs_points') }}</span>
		</template>
		<template v-if="view === 'plan' && editable && resizable">
			<span class="text-body-small machine-faint">{{ t('bed.size') }}</span>
			<v-btn size="small" variant="outlined" style="min-height:44px" :title="t('bed.smaller_tip')" @click="$emit('resize', -10)"><v-icon size="small" start>mdi-minus</v-icon>{{ t('bed.smaller') }}</v-btn>
			<v-btn size="small" variant="outlined" style="min-height:44px" :title="t('bed.bigger_tip')" @click="$emit('resize', 10)"><v-icon size="small" start>mdi-plus</v-icon>{{ t('bed.bigger') }}</v-btn>
			<span class="text-body-small machine-faint">{{ t('bed.presets') }}</span>
			<v-btn v-for="p in presets" :key="p.id" size="small" variant="outlined" :disabled="!p.region" :title="p.region ? '' : t('bed.preset_unavailable')" style="min-height:44px" @click="$emit('preset', p.id)">
				<v-icon size="small" start>{{ p.icon }}</v-icon>{{ t('bed.preset_' + p.id) }}
			</v-btn>
			<mesh-region-fields class="mt-1" style="flex-basis:100%" :region="region" :bed="model.bed" :area="area" @region="$emit('region', $event)" />
		</template>
		<template v-if="view === 'result'">
			<v-btn v-if="editable && hasArea" size="small" variant="outlined" style="min-height:44px" :title="t('bed.edit_area_tip')" @click="$emit('edit-area')"><v-icon size="small" start>mdi-resize</v-icon>{{ t('bed.edit_area') }}</v-btn>
			<v-btn size="small" variant="outlined" :active="compare" :disabled="!canCompare" style="min-height:44px" @click="$emit('compare', !compare)"><v-icon size="small" start>mdi-compare</v-icon>{{ t('bed.compare') }}</v-btn>
			<span v-if="!canCompare && compareReason" class="text-body-small machine-faint">{{ t('bed.compare_' + compareReason) }}</span>
		</template>
	</div>
</template>

<script setup>
// Toolbar of the mesh bed (the Plan / Result tabs are PlanTabs.vue): in the Plan, in EVERY mode, the size buttons, the region presets
// (whole reachable bed, centre, around the last job; a preset that cannot be computed is disabled with a title saying why) and the four
// typed numbers of the area; in the Points mode they scale the chosen points. In the Result, the comparison with the previous mesh and
// "edit this area" (back to the plan with the area of the mesh). Big buttons (44 px) for touch.

import { computed } from 'vue'
import MeshRegionFields from './MeshRegionFields.vue'
import { t } from '../text.js'
import { PRESETS, presetRegion } from '../lib/bed-mesh-plan.js'

const ICON = { whole: 'mdi-fullscreen', centre: 'mdi-image-filter-center-focus', job: 'mdi-printer-3d-nozzle-outline' }

const props = defineProps({
	view: { type: String, default: 'plan' },
	pointsMode: { type: Boolean, default: false }, // the Points mode: the size buttons then scale the chosen points
	resizable: { type: Boolean, default: true }, // there is a region to resize (the Region mode, or the Points mode once the chosen points give a grid)
	region: { type: Object, default: null }, // the region on show (the typed fields)
	area: { type: Object, default: null }, // what a run accepts
	hasArea: { type: Boolean, default: false }, // the result has a mesh whose area can be taken back to the plan
	editable: { type: Boolean, default: true },
	compare: { type: Boolean, default: false },
	canCompare: { type: Boolean, default: false },
	compareReason: { type: String, default: '' }, // 'no_previous' | 'grid_differs'
	model: { type: Object, required: true } // modelOf(...): bed, reach, lastJob
})
defineEmits(['resize', 'preset', 'region', 'edit-area', 'compare'])

const show = computed(() => props.view === 'result' || props.editable)
const presets = computed(() => PRESETS.map(id => ({ id, icon: ICON[id], region: presetRegion(id, { bed: props.model.bed, reach: props.model.reach, lastJob: props.model.lastJob }) })))
</script>
