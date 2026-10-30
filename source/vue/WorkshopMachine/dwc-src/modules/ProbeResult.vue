<template>
	<v-card variant="outlined" class="probe-result">
		<v-card-text>
			<!-- traffic light: colour + icon + words -->
			<div class="d-flex align-center flex-wrap" style="gap:8px">
				<v-chip :color="view.color" variant="flat">
					<v-icon size="small" start>{{ view.icon }}</v-icon>{{ t(view.verdictKey) }}
				</v-chip>
				<span class="text-body-small machine-faint">{{ t('probe.thresholds', { warn: view.th.sigmaWarn, bad: view.th.sigmaBad }) }}</span>
			</div>
			<div class="probe-stats mt-3">
				<div v-for="s in rows" :key="s.id" class="probe-stat">
					<div class="text-body-small machine-faint">{{ t('probe.stat_' + s.id) }}</div>
					<div class="text-body-large">{{ s.text }}</div>
				</div>
			</div>
			<div v-if="chart.points.length > 1" class="mt-3">
				<div class="text-body-small machine-faint">{{ t('probe.chart') }}</div>
				<svg :viewBox="'0 0 ' + W + ' ' + H" class="probe-chart" role="img" :aria-label="t('probe.chart')">
					<line :x1="0" :x2="W" :y1="chart.meanY" :y2="chart.meanY" stroke="currentColor" stroke-opacity="0.35" stroke-dasharray="4 3" />
					<polyline :points="line" fill="none" stroke="currentColor" stroke-width="1.5" />
					<circle v-for="(p, i) in chart.points" :key="i" :cx="p.x" :cy="p.y" r="2.5" fill="currentColor" />
				</svg>
			</div>
		</v-card-text>
	</v-card>
</template>

<script setup>
// Result card of the repeatability run: the verdict, the statistics (mean, standard deviation, min, max, range, drift) and the height of
// every touch. `view` comes from lib/probe.js resultView.

import { computed } from 'vue'
import { t } from '../text.js'
import { samplePoints } from '../lib/probe.js'

const W = 320
const H = 70

function mm(v) {
	return typeof v === 'number' ? v.toFixed(4) : '-'
}

const props = defineProps({
	view: { type: Object, required: true }
})

const rows = computed(() => {
	const s = props.view.stats
	return [
		{ id: 'n', text: String(s.n) }, { id: 'mean', text: mm(s.mean) }, { id: 'stdev', text: mm(s.stdev) },
		{ id: 'min', text: mm(s.min) }, { id: 'max', text: mm(s.max) }, { id: 'range', text: mm(s.range) },
		{ id: 'drift', text: mm(props.view.drift) }
	]
})
const chart = computed(() => samplePoints(props.view.samples, W, H, 6))
const line = computed(() => chart.value.points.map(p => p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' '))
</script>


<style>
.probe-stats { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px 16px; }
.probe-chart { width: 100%; max-width: 420px; height: 90px; }
</style>
