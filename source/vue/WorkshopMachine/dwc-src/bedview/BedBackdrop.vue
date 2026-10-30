<template>
	<g class="bedv-backdrop">
		<defs>
			<marker :id="uid + 'a'" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="bedv-fill-faint" /></marker>
			<marker :id="uid + 'o'" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="bedv-fill-info" /></marker>
		</defs>
		<rect :x="d.limits.x" :y="d.limits.y" :width="d.limits.w" :height="d.limits.h" class="bedv-limits" />
		<g class="bedv-grid">
			<line v-for="g in d.grid.vertical" :key="'v' + g.v" :x1="g.px" :x2="g.px" :y1="d.limits.y" :y2="d.limits.y + d.limits.h" />
			<line v-for="g in d.grid.horizontal" :key="'h' + g.v" :y1="g.px" :y2="g.px" :x1="d.limits.x" :x2="d.limits.x + d.limits.w" />
		</g>
		<g class="bedv-ticks">
			<text v-for="g in d.grid.vertical" :key="'tv' + g.v" :x="g.px" :y="d.limits.y + d.limits.h + 12" text-anchor="middle">{{ g.v }}</text>
			<text v-for="g in d.grid.horizontal" :key="'th' + g.v" :x="d.limits.x - 5" :y="g.px + 3" text-anchor="end">{{ g.v }}</text>
		</g>
		<rect :x="d.limits.x" :y="d.limits.y" :width="d.limits.w" :height="d.limits.h" class="bedv-limits-line" />
		<g v-if="d.reach">
			<rect :x="d.reach.x" :y="d.reach.y" :width="d.reach.w" :height="d.reach.h" class="bedv-reach" />
			<text :x="d.reach.x + 6" :y="d.reach.y + 14" class="bedv-reach-label">{{ t('bed.reach_label') }}</text>
		</g>
		<g v-if="d.origin" class="bedv-origin">
			<circle :cx="d.origin.x" :cy="d.origin.y" r="4" />
			<text :x="d.origin.x + 7" :y="d.origin.y - 6">0,0</text>
		</g>
		<g class="bedv-axes">
			<line :x1="d.axes.x.x1" :y1="d.axes.x.y1" :x2="d.axes.x.x2" :y2="d.axes.x.y2" :marker-end="'url(#' + uid + 'a)'" />
			<line :x1="d.axes.y.x1" :y1="d.axes.y.y1" :x2="d.axes.y.x2" :y2="d.axes.y.y2" :marker-end="'url(#' + uid + 'a)'" />
			<text :x="d.axes.x.x2 + 4" :y="d.axes.x.y2 + 4">X</text>
			<text :x="d.axes.y.x2 - 3" :y="d.axes.y.y2 - 5" text-anchor="end">Y</text>
		</g>
		<g class="bedv-scale">
			<line :x1="d.scaleBar.x" :x2="d.scaleBar.x + d.scaleBar.w" :y1="d.scaleBar.y" :y2="d.scaleBar.y" />
			<line :x1="d.scaleBar.x" :x2="d.scaleBar.x" :y1="d.scaleBar.y - 3" :y2="d.scaleBar.y + 3" />
			<line :x1="d.scaleBar.x + d.scaleBar.w" :x2="d.scaleBar.x + d.scaleBar.w" :y1="d.scaleBar.y - 3" :y2="d.scaleBar.y + 3" />
			<text :x="d.scaleBar.x - 6" :y="d.scaleBar.y + 3" text-anchor="end"><title>{{ t('bed.scale_tip', { mm: d.scaleBar.mm }) }}</title>{{ t('bed.scale_label', { mm: d.scaleBar.mm }) }}</text>
		</g>
		<g v-if="vec" class="bedv-offset">
			<circle :cx="vec.head.x" :cy="vec.head.y" r="5" class="bedv-head" />
			<line v-if="!vec.zero" :x1="vec.head.x" :y1="vec.head.y" :x2="vec.probe.x" :y2="vec.probe.y" :marker-end="'url(#' + uid + 'o)'" />
			<rect v-if="!vec.zero" :x="vec.probe.x - 4" :y="vec.probe.y - 4" width="8" height="8" class="bedv-probe" />
			<text :x="labelX" :y="vec.head.y + 16">{{ offsetText }}</text>
		</g>
	</g>
</template>

<script setup>
// Static layers of the bed view: axis-limit rectangle (M208) with the mm grid, the PROBE REACH rectangle, axis arrows, origin, scale bar
// and the nozzle-to-probe offset vector at true scale. All geometry comes from lib/bed-frame.js.

import { computed } from 'vue'
import { t } from '../text.js'
import { backdropOf, offsetVector } from '../lib/bed-frame.js'

let counter = 0
const CHAR_PX = 6.2 // width of a letter of the caption (11 px font), a little generous

const props = defineProps({
	frame: { type: Object, required: true },
	reach: { type: Object, default: null }, // {xmin..ymax} in probe coordinates, null = unknown
	offset: { type: Object, default: null }, // {x, y} of the probe from the nozzle, null = unknown
	anchor: { type: Object, default: null } // where the offset vector is drawn (world mm); the bed centre by default
})

counter += 1
const uid = 'bedv' + counter
const d = computed(() => backdropOf(props.frame, props.reach))
const vec = computed(() => offsetVector(props.frame, props.offset, props.anchor))
// the caption never leaves the drawing (phone: it was cut on the right): it is moved left by what it would stick out
const offsetText = computed(() => (vec.value ? t('bed.offset_label', { x: vec.value.x, y: vec.value.y }) : ''))
const labelX = computed(() => (vec.value ? Math.max(4, Math.min(vec.value.head.x + 9, props.frame.w - 4 - offsetText.value.length * CHAR_PX)) : 0))
</script>
