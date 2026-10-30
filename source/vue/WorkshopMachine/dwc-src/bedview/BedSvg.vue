<template>
	<div ref="box" class="bedv">
		<svg
			v-if="frame" :width="frame.w" :height="frame.h" :viewBox="'0 0 ' + frame.w + ' ' + frame.h" role="group" :aria-label="label" class="bedv-svg"
			@pointerdown="send('down', $event)" @pointermove="send('move', $event)" @pointerup="send('up', $event)" @pointercancel="send('cancel', $event)"
		>
			<bed-backdrop :frame="frame" :reach="reach" :offset="offset" :anchor="anchor" />
			<slot :frame="frame" />
		</svg>
	</div>
</template>

<script setup>
// The bed at true proportions as pure SVG: the shared drawing surface of Mesh, Level and Probe. It draws the backdrop (limits, mm grid,
// probe reach, axes, origin, scale bar, offset vector) and gives the layers placed in its slot the `frame` (world <-> px). One SVG unit is
// one CSS pixel (the component measures its box), so the touch targets are real sizes. Pointer events are translated to the world and sent
// up as `pointer` {type: 'down' | 'move' | 'up' | 'cancel' (the browser took the gesture, e.g. to scroll: never a tap), hit, wx, wy, px, py, shift}; `hit` is the data-hit of the element under the finger (handles,
// points), '' on the empty bed. Drag logic lives with the caller (state/region-drag.js, state/level-points-state.js).

import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import BedBackdrop from './BedBackdrop.vue'
import { makeFrame } from '../lib/bed-frame.js'
import { pointUnder } from '../lib/bed-hit.js'

const props = defineProps({
	bed: { type: Object, required: true }, // {xmin, xmax, ymin, ymax}
	reach: { type: Object, default: null },
	offset: { type: Object, default: null },
	anchor: { type: Object, default: null },
	include: { type: Array, default: () => [] }, // [{x, y}] mm drawn outside the bed (the Z motors): the margin grows to hold them
	label: { type: String, default: '' }
})
const emit = defineEmits(['pointer'])

const box = ref(null)
const width = ref(520)
const frame = computed(() => (props.bed.xmax > props.bed.xmin && props.bed.ymax > props.bed.ymin ? makeFrame(props.bed, width.value, { include: props.include }) : null))

function measure() {
	const w = box.value && box.value.clientWidth
	if (w && Math.abs(w - width.value) > 1) width.value = w
}
onMounted(() => {
	measure()
	window.addEventListener('resize', measure)
})
onBeforeUnmount(() => window.removeEventListener('resize', measure))

function send(type, ev) {
	const svg = ev.currentTarget
	const r = svg.getBoundingClientRect()
	const w = frame.value.toWorld(ev.clientX - r.left, ev.clientY - r.top)
	const el = ev.target && ev.target.closest ? ev.target.closest('[data-hit]') : null
	const hit = el ? el.getAttribute('data-hit') : ''
	if (type === 'down' && svg.setPointerCapture) {
		try { svg.setPointerCapture(ev.pointerId) } catch (e) { /* a synthetic pointer: nothing to capture */ }
	}
	emit('pointer', { type, hit, under: pointUnder(ev, hit, typeof document === 'undefined' ? null : document), wx: w.x, wy: w.y, px: ev.clientX - r.left, py: ev.clientY - r.top, shift: !!ev.shiftKey })
}
</script>

<style>
.bedv { width: 100%; --bv-limits: #2f3b41; --bv-line: #78909c; --bv-grid: rgba(255, 255, 255, 0.09); --bv-text: #eceff1; --bv-faint: #b0bec5; --bv-ok: #a5d6a7; --bv-warn: #ffb74d; --bv-bad: #ef9a9a; --bv-info: #90caf9; --bv-region: #ffe082; --bv-card: #263238; }
.v-theme--light .bedv { --bv-limits: #f5f7f8; --bv-line: #546e7a; --bv-grid: rgba(0, 0, 0, 0.09); --bv-text: #212121; --bv-faint: #616161; --bv-ok: #2e7d32; --bv-warn: #b26a00; --bv-bad: #c62828; --bv-info: #1565c0; --bv-region: #8d6e00; --bv-card: #ffffff; }
.bedv-svg { display: block; max-width: 100%; touch-action: pan-y; user-select: none; -webkit-user-select: none; }
.bedv text { fill: var(--bv-text); font-size: 11px; }
.bedv-limits { fill: var(--bv-limits); }
.bedv-limits-line { fill: none; stroke: var(--bv-line); stroke-width: 2; }
.bedv-grid line { stroke: var(--bv-grid); stroke-width: 1; }
.bedv-ticks text, .bedv-axes text, .bedv-scale text { fill: var(--bv-faint); font-size: 10px; }
.bedv-reach { fill: none; stroke: var(--bv-info); stroke-width: 1.5; stroke-dasharray: 7 4; }
.bedv .bedv-reach-label { fill: var(--bv-info); font-size: 10px; }
.bedv-axes line, .bedv-scale line { stroke: var(--bv-faint); stroke-width: 1.5; }
.bedv-origin circle { fill: none; stroke: var(--bv-faint); stroke-width: 1.5; }
.bedv-offset line { stroke: var(--bv-info); stroke-width: 2; }
.bedv-head { fill: none; stroke: var(--bv-text); stroke-width: 2; }
.bedv-probe { fill: var(--bv-info); }
.bedv-fill-faint { fill: var(--bv-faint); }
.bedv-fill-info { fill: var(--bv-info); }
.bedv-hit { fill: transparent; stroke: none; }
.bedv-point:focus { outline: none; }
.bedv-chosen-ring { fill: none; stroke: var(--bv-text); stroke-width: 2.5; }
.bedv-derived { opacity: 0.85; }
.bedv-snap line { stroke: var(--bv-warn); stroke-width: 2; }
.bedv-snap-mark { fill: none; stroke: var(--bv-warn); stroke-width: 2; }
.bedv-ignored-mark { fill: none; stroke: var(--bv-bad); stroke-width: 2; stroke-dasharray: 3 2; }
.bedv-job-body { fill: var(--bv-info); fill-opacity: 0.08; stroke: var(--bv-info); stroke-width: 2.5; stroke-dasharray: 2 5; pointer-events: none; }
.bedv-job-body.bedv-job-bad { fill: var(--bv-bad); fill-opacity: 0.1; stroke: var(--bv-bad); }
.bedv-job-body.bedv-job-good { fill: var(--bv-ok); fill-opacity: 0.1; stroke: var(--bv-ok); }
.bedv-job-handle { fill: var(--bv-card); stroke: var(--bv-info); stroke-width: 2; }
.bedv-job-box:focus { outline: none; }
.bedv-job-box:focus .bedv-job-handle { stroke-width: 4; }
.bedv .bedv-job-label { fill: var(--bv-text); font-size: 11px; font-weight: 700; pointer-events: none; }
.bedv-ring-tol { fill: none; stroke: var(--bv-text); stroke-width: 1.5; stroke-dasharray: 3 2; }
.bedv-point:focus .bedv-ring, .bedv-sel .bedv-ring { stroke: var(--bv-text); stroke-width: 2.5; fill: none; }
.bedv-st-measure { fill: var(--bv-ok); stroke: var(--bv-ok); }
.bedv-st-clipped { fill: var(--bv-warn); stroke: var(--bv-warn); }
.bedv-st-outside_reach { fill: none; stroke: var(--bv-bad); stroke-width: 2; stroke-dasharray: 3 2; }
.bedv-st-unknown, .bedv-st-missing, .bedv-st-duplicate { fill: none; stroke: var(--bv-faint); stroke-width: 2; stroke-dasharray: 3 2; }
.bedv-st-measured { stroke: var(--bv-text); stroke-width: 1.5; }
.bedv-mark { stroke: var(--bv-bad); stroke-width: 2; fill: none; }
.bedv .bedv-order { fill: var(--bv-card); font-size: 10px; font-weight: 700; pointer-events: none; }
.bedv .bedv-order-out { fill: var(--bv-text); font-size: 10px; pointer-events: none; }
.bedv-path { fill: none; stroke: var(--bv-faint); stroke-width: 1.5; stroke-opacity: 0.55; stroke-dasharray: 2 4; }
.bedv-region-body { fill: var(--bv-region); fill-opacity: 0.1; stroke: var(--bv-region); stroke-width: 2; stroke-dasharray: 7 4; }
.bedv-accepted rect { fill: none; stroke: var(--bv-ok); stroke-width: 2; pointer-events: none; }
.bedv .bedv-accepted text { fill: var(--bv-ok); font-size: 10px; pointer-events: none; }
.bedv-handle { fill: var(--bv-card); stroke: var(--bv-region); stroke-width: 2; }
.bedv-handle-box:focus { outline: none; }
.bedv-handle-box:focus .bedv-handle { stroke-width: 4; fill: var(--bv-region); }
.bedv-screw circle { fill: var(--bv-card); stroke: var(--bv-text); stroke-width: 2; }
.bedv .bedv-screw text { font-weight: 700; }
.bedv .bedv-screw .bedv-thread { fill: none; stroke-dasharray: 2 2; }
.bedv-link { stroke: var(--bv-faint); stroke-width: 1; stroke-dasharray: 3 3; stroke-opacity: 0.8; }
.bedv-raise { stroke: var(--bv-ok); fill: var(--bv-ok); }
.bedv-lower { stroke: var(--bv-warn); fill: var(--bv-warn); }
.bedv .bedv-corr-label { font-weight: 700; }
.bedv .bedv-t-raise { fill: var(--bv-ok); }
.bedv .bedv-t-lower { fill: var(--bv-warn); }
.bedv .bedv-note { fill: var(--bv-faint); font-size: 11px; }
</style>
