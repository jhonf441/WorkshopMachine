<template>
	<div ref="box" class="bed-view">
		<canvas ref="canvas" :width="size.w" :height="size.h" class="bed-canvas" role="img" :aria-label="label" @mousemove="onMove" @mouseleave="$emit('hover', null)" />
	</div>
</template>

<script>
'use strict'

// The 2D bed view (design 3.3): a canvas that paints the shapes returned by the pure renderBed(). No 3D (the DWC Height Map page has it).
// Props are the spec of renderBed without the size (the component measures its box). Emits `hover` with the cell under the pointer.

import { renderBed, hitTest, paletteFor } from './bed-geometry.js'
import { drawItems } from './draw-canvas.js'

const MIN_W = 240
const RATIO = 0.7

export default {
	props: {
		bed: { type: Object, required: true },
		grid: { type: Object, default: null },
		scale: { type: Object, default: () => ({ center: 'mean', symmetric: false }) },
		tolerance: { type: Number, default: null },
		showValues: { type: Boolean, default: true },
		region: { type: Object, default: null },
		markers: { type: Array, default: () => [] },
		hover: { type: Object, default: null },
		label: { type: String, default: '' }
	},
	data() {
		return { size: { w: 520, h: 364 } }
	},
	computed: {
		spec() {
			const dark = !this.$vuetify || !this.$vuetify.theme || this.$vuetify.theme.dark !== false
			return {
				size: this.size, bed: this.bed, grid: this.grid, scale: this.scale, tolerance: this.tolerance, showValues: this.showValues,
				region: this.region, markers: this.markers, hover: this.hover, palette: paletteFor(dark)
			}
		}
	},
	watch: {
		spec() {
			this.$nextTick(this.paint)
		}
	},
	mounted() {
		this.measure()
		window.addEventListener('resize', this.measure)
		this.$nextTick(this.paint)
	},
	beforeDestroy() {
		window.removeEventListener('resize', this.measure)
	},
	methods: {
		measure() {
			const w = Math.max(MIN_W, Math.floor((this.$refs.box && this.$refs.box.clientWidth) || 520))
			if (w !== this.size.w) this.size = { w, h: Math.round(w * RATIO) }
		},
		paint() {
			const canvas = this.$refs.canvas
			const ctx = canvas && canvas.getContext && canvas.getContext('2d')
			if (!ctx) return
			const view = renderBed(this.spec)
			drawItems(ctx, view.items, view.width, view.height)
		},
		onMove(ev) {
			const r = this.$refs.canvas.getBoundingClientRect()
			const k = this.size.w / (r.width || this.size.w)
			this.$emit('hover', hitTest(this.spec, (ev.clientX - r.left) * k, (ev.clientY - r.top) * k))
		}
	}
}
</script>

<style>
.bed-view { width: 100%; }
.bed-canvas { width: 100%; height: auto; display: block; }
</style>
