<template>
	<div v-if="show" class="d-flex align-center flex-wrap mb-2" style="gap:8px">
		<template v-if="view === 'plan' && editable && !resizable && pointsMode">
			<span class="text-caption machine-faint">{{ t('bed.resize_needs_points') }}</span>
		</template>
		<template v-if="view === 'plan' && editable && resizable">
			<span class="text-caption machine-faint">{{ t('bed.size') }}</span>
			<v-btn small outlined style="min-height:44px" :title="t('bed.smaller_tip')" @click="$emit('resize', -10)"><v-icon small left>mdi-minus</v-icon>{{ t('bed.smaller') }}</v-btn>
			<v-btn small outlined style="min-height:44px" :title="t('bed.bigger_tip')" @click="$emit('resize', 10)"><v-icon small left>mdi-plus</v-icon>{{ t('bed.bigger') }}</v-btn>
			<span class="text-caption machine-faint">{{ t('bed.presets') }}</span>
			<v-btn v-for="p in presets" :key="p.id" small outlined :disabled="!p.region" :title="p.region ? '' : t('bed.preset_unavailable')" style="min-height:44px" @click="$emit('preset', p.id)">
				<v-icon small left>{{ p.icon }}</v-icon>{{ t('bed.preset_' + p.id) }}
			</v-btn>
			<mesh-region-fields class="mt-1" style="flex-basis:100%" :region="region" :bed="model.bed" :area="area" @region="$emit('region', $event)" />
		</template>
		<template v-if="view === 'result'">
			<v-btn v-if="editable && hasArea" small outlined style="min-height:44px" :title="t('bed.edit_area_tip')" @click="$emit('edit-area')"><v-icon small left>mdi-resize</v-icon>{{ t('bed.edit_area') }}</v-btn>
			<v-btn small outlined :input-value="compare" :disabled="!canCompare" style="min-height:44px" @click="$emit('compare', !compare)"><v-icon small left>mdi-compare</v-icon>{{ t('bed.compare') }}</v-btn>
			<span v-if="!canCompare && compareReason" class="text-caption machine-faint">{{ t('bed.compare_' + compareReason) }}</span>
		</template>
	</div>
</template>

<script>
'use strict'

// Toolbar of the mesh bed (the Plan / Result tabs are PlanTabs.vue): in the Plan, in EVERY mode, the size buttons, the region presets
// (whole reachable bed, centre; a preset that cannot be computed is disabled with a title saying why) and the four typed numbers of the
// area; in the Points mode they scale the chosen points. In the Result, the comparison with the previous mesh and "edit this area" (back
// to the plan with the area of the mesh). Big buttons (44 px) for touch.

import MeshRegionFields from './MeshRegionFields.vue'
import { textMixin } from '../modules/text-mixin.js'
import { PRESETS, presetRegion } from '../lib/bed-mesh-plan.js'

const ICON = { whole: 'mdi-fullscreen', centre: 'mdi-image-filter-center-focus' }

export default {
	components: { MeshRegionFields },
	mixins: [textMixin],
	props: {
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
		model: { type: Object, required: true } // modelOf(...): bed, reach
	},
	computed: {
		show() {
			return this.view === 'result' || this.editable
		},
		presets() {
			return PRESETS.map(id => ({ id, icon: ICON[id], region: presetRegion(id, { bed: this.model.bed, reach: this.model.reach }) }))
		}
	}
}
</script>
