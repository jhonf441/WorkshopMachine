<template>
	<div class="mesh-bed-side">
		<template v-if="view === 'plan'">
			<grid-summary v-if="pointsMode" class="mb-3" :derived="derived" :editable="editable" @use-node="$emit('use-node', $event)" @remove="$emit('remove', $event)" />
			<div class="text-body-large">{{ t('bed.mesh_summary', { points: counts.measure, clipped: counts.clipped, outside: counts.outside_reach }) }}</div>
			<div v-if="seconds !== null" class="text-body-medium">{{ t('bed.estimate', time) }}</div>
			<div class="text-body-small machine-faint">{{ t(source === 'service' ? 'bed.source_service' : 'bed.source_local') }}</div>
		</template>
		<template v-else>
			<div v-if="quality" class="d-flex align-center flex-wrap" style="gap:8px">
				<v-chip size="small" :color="quality.color" variant="flat"><v-icon size="x-small" start>{{ quality.icon }}</v-icon>{{ t(quality.textKey) }}</v-chip>
				<span class="text-body-medium">{{ name }}</span>
			</div>
			<div class="mesh-stats mt-2">
				<div v-for="s in rows" :key="s.id"><div class="text-body-small machine-faint">{{ t('mesh.stat_' + s.id) }}</div><div class="text-body-large">{{ s.text }}</div></div>
			</div>
			<div class="d-flex flex-wrap mt-2" style="gap:12px">
				<v-switch v-model="opts.zero" density="compact" hide-details class="mt-0 pt-0" :label="t('mesh.scale_zero')" />
				<v-switch v-model="opts.symmetric" density="compact" hide-details class="mt-0 pt-0" :label="t('mesh.symmetric')" />
				<v-switch v-model="opts.values" density="compact" hide-details class="mt-0 pt-0" :label="t('mesh.show_values')" />
			</div>
			<v-text-field v-model="opts.tolerance" :label="t('mesh.tolerance')" type="number" step="0.01" density="compact" variant="outlined" hide-details class="mt-3" style="max-width:150px" />
			<div class="text-body-small machine-faint mt-1">{{ t('mesh.tolerance_hint') }}</div>
		</template>
	</div>
</template>

<script setup>
// Side summary of the mesh bed. Plan (Points mode: first the grid the chosen points imply, GridSummary): how many points will be measured / are outside the reach, the estimated time and whether the points
// are the service's or only the local computation. Result: quality, min / max / mean / range and the colour options (the switches write
// into `opts`, which MeshBed owns).

import { computed } from 'vue'
import GridSummary from './GridSummary.vue'
import { t } from '../text.js'
import { minSec } from '../lib/bed-mesh-plan.js'

const props = defineProps({
	view: { type: String, default: 'plan' },
	pointsMode: { type: Boolean, default: false }, // plan of the Points mode: the grid the chosen points imply is described first
	derived: { type: Object, default: null }, // lib/point-grid.js gridFromPoints(...) (ok) or null
	editable: { type: Boolean, default: false },
	counts: { type: Object, required: true },
	seconds: { type: Number, default: null },
	source: { type: String, default: 'local' },
	stats: { type: Object, default: null },
	quality: { type: Object, default: null },
	name: { type: String, default: '' },
	opts: { type: Object, required: true } // {zero, symmetric, values, tolerance}
})
defineEmits(['use-node', 'remove'])

const time = computed(() => (props.seconds === null ? {} : minSec(props.seconds)))
const rows = computed(() => {
	const s = props.stats
	if (!s) return []
	const mm = v => (typeof v === 'number' ? v.toFixed(4) : '-')
	return [{ id: 'points', text: String(s.n) }, { id: 'missing', text: String(s.missing) }, { id: 'min', text: mm(s.min) }, { id: 'max', text: mm(s.max) }, { id: 'range', text: mm(s.range) }, { id: 'mean', text: mm(s.mean) }]
})
</script>
