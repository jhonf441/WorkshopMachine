<template>
	<div ref="box" class="bed-view">
		<canvas ref="canvas" :width="size.w" :height="size.h" class="bed-canvas" role="img" :aria-label="label" @mousemove="onMove" @mouseleave="emit('hover', null)" />
	</div>
</template>

<script setup>
// The 2D bed view (design 3.3): a canvas that paints the shapes returned by the pure renderBed(). No 3D (the DWC Height Map page has it).
// Props are the spec of renderBed without the size (the component measures its box). Emits `hover` with the cell under the pointer.

import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useTheme } from 'vuetify'
import { renderBed, hitTest, paletteFor } from './bed-geometry.js'
import { drawItems } from './draw-canvas.js'

const MIN_W = 240
const RATIO = 0.7

const props = defineProps({
	bed: { type: Object, required: true },
	grid: { type: Object, default: null },
	scale: { type: Object, default: () => ({ center: 'mean', symmetric: false }) },
	tolerance: { type: Number, default: null },
	showValues: { type: Boolean, default: true },
	region: { type: Object, default: null },
	markers: { type: Array, default: () => [] },
	hover: { type: Object, default: null },
	label: { type: String, default: '' }
})
const emit = defineEmits(['hover'])

const theme = useTheme()
const box = ref(null)
const canvas = ref(null)
const size = ref({ w: 520, h: 364 })

const spec = computed(() => {
	const dark = !theme || !theme.global || !theme.global.current.value || theme.global.current.value.dark !== false
	return {
		size: size.value, bed: props.bed, grid: props.grid, scale: props.scale, tolerance: props.tolerance, showValues: props.showValues,
		region: props.region, markers: props.markers, hover: props.hover, palette: paletteFor(dark)
	}
})

function measure() {
	const w = Math.max(MIN_W, Math.floor((box.value && box.value.clientWidth) || 520))
	if (w !== size.value.w) size.value = { w, h: Math.round(w * RATIO) }
}
function paint() {
	const el = canvas.value
	const ctx = el && el.getContext && el.getContext('2d')
	if (!ctx) return
	const view = renderBed(spec.value)
	drawItems(ctx, view.items, view.width, view.height)
}
function onMove(ev) {
	const r = canvas.value.getBoundingClientRect()
	const k = size.value.w / (r.width || size.value.w)
	emit('hover', hitTest(spec.value, (ev.clientX - r.left) * k, (ev.clientY - r.top) * k))
}

watch(spec, () => nextTick(paint))
onMounted(() => {
	measure()
	window.addEventListener('resize', measure)
	nextTick(paint)
})
onBeforeUnmount(() => window.removeEventListener('resize', measure))
</script>

<style>
.bed-view { width: 100%; }
.bed-canvas { width: 100%; height: auto; display: block; }
</style>
