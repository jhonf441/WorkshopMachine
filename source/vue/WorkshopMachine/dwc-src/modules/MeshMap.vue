<template>
	<div class="mesh-map">
		<div v-if="!grid" class="text-body-medium machine-faint">{{ t('mesh.map_empty') }}</div>
		<template v-else>
			<div class="d-flex align-center flex-wrap mb-2" style="gap:8px">
				<v-chip size="small" :color="quality.color" variant="flat"><v-icon size="x-small" start>{{ quality.icon }}</v-icon>{{ t(quality.textKey) }}</v-chip>
				<span class="text-body-medium">{{ grid.name }}</span>
				<v-spacer />
				<v-switch v-model="local.zero" density="compact" hide-details class="mt-0 pt-0" :label="t('mesh.scale_zero')" />
				<v-switch v-model="local.symmetric" density="compact" hide-details class="mt-0 pt-0" :label="t('mesh.symmetric')" />
				<v-switch v-model="local.showValues" density="compact" hide-details class="mt-0 pt-0" :label="t('mesh.show_values')" />
			</div>
			<bed-view
				:bed="bed" :grid="grid" :scale="scale" :tolerance="toleranceMm" :show-values="local.showValues" :hover="hoverCell"
				:label="t('mesh.map_title')" @hover="hit = $event"
			/>
			<div class="text-body-medium mt-1" style="min-height:22px">{{ hoverText }}</div>
			<!-- legend with numbers: the colours are never the only signal -->
			<div v-if="legend" class="d-flex align-center flex-wrap mt-1" style="gap:12px">
				<span class="text-body-small machine-faint">{{ t('mesh.legend') }}</span>
				<span v-for="s in legend.stops" :key="s.value" class="text-body-small d-flex align-center" style="gap:4px">
					<span class="legend-swatch" :style="{ background: s.color }" />{{ fmt(s.value) }}
				</span>
			</div>
			<div class="d-flex align-center flex-wrap mt-3" style="gap:12px">
				<v-text-field v-model="local.tolerance" :label="t('mesh.tolerance')" type="number" step="0.01" density="compact" variant="outlined" hide-details style="max-width:150px" />
				<span class="text-body-small machine-faint">{{ t('mesh.tolerance_hint') }}</span>
			</div>
			<div class="text-body-medium font-weight-medium mt-4 mb-1">{{ t('mesh.stats_title') }}</div>
			<div class="mesh-stats">
				<div v-for="s in statRows" :key="s.id" class="mesh-stat">
					<div class="text-body-small machine-faint">{{ t('mesh.stat_' + s.id) }}</div>
					<div class="text-body-large">{{ s.text }}</div>
				</div>
			</div>
		</template>
	</div>
</template>

<script setup>
// The mesh on the bed (design 2.4): the 2D map, the legend with numbers, the cells out of tolerance outlined, hover with the height and
// the deviation from the mean, the statistics and the quality. Everything is computed by lib/mesh-grid.js and view/bed-geometry.js.

import { computed, reactive, ref } from 'vue'
import BedView from '../view/BedView.vue'
import { t } from '../text.js'
import { gridStats, qualityView } from '../lib/mesh-grid.js'
import { legendFor, formatMm } from '../view/bed-geometry.js'

const props = defineProps({
	grid: { type: Object, default: null },
	bed: { type: Object, required: true },
	thresholds: { type: Object, required: true } // qualityThresholds(...)
})

const local = reactive({ zero: false, symmetric: false, showValues: true, tolerance: 0.1 })
const hit = ref(null)

const stats = computed(() => (props.grid ? gridStats(props.grid) : null))
const quality = computed(() => qualityView(stats.value, props.thresholds))
const scale = computed(() => ({ center: local.zero ? 'zero' : 'mean', symmetric: local.symmetric }))
const toleranceMm = computed(() => {
	const n = Number(local.tolerance)
	return isFinite(n) && n > 0 ? n : null
})
const hoverCell = computed(() => (hit.value ? { i: hit.value.i, j: hit.value.j } : null))
const hoverText = computed(() => {
	const h = hit.value
	if (!h || h.z === null) return ''
	return t('mesh.hover', { x: h.x.toFixed(1), y: h.y.toFixed(1), z: formatMm(h.z), dev: formatMm(h.deviation) })
})
const legend = computed(() => legendFor(props.grid, scale.value))
const statRows = computed(() => {
	const s = stats.value
	if (!s) return []
	const mm = v => (typeof v === 'number' ? v.toFixed(4) : '-')
	return [
		{ id: 'points', text: String(s.n) }, { id: 'missing', text: String(s.missing) }, { id: 'min', text: mm(s.min) }, { id: 'max', text: mm(s.max) },
		{ id: 'range', text: mm(s.range) }, { id: 'mean', text: mm(s.mean) }, { id: 'rms', text: mm(s.rms) }, { id: 'stdev', text: mm(s.stdev) }
	]
})

function fmt(v) {
	return formatMm(v)
}
</script>


<style>
.legend-swatch { display: inline-block; width: 14px; height: 14px; border: 1px solid rgba(128, 128, 128, 0.6); }
.mesh-stats { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px 16px; }
</style>
