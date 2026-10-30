<template>
	<g class="bedv-points">
		<polyline v-if="route" :points="route" class="bedv-path" />
		<g
			v-for="p in drawn" :key="p.id" :transform="'translate(' + p.px.x + ',' + p.px.y + ')'" class="bedv-point" :class="{ 'bedv-sel': p.id === selected, 'bedv-derived': p.derived, 'bedv-chosen': p.chosen }"
			:data-hit="'p:' + p.id" tabindex="0" role="button" :aria-label="p.aria" :aria-pressed="p.id === selected ? 'true' : 'false'"
			:style="draggable ? 'touch-action:none;cursor:grab' : 'cursor:pointer'"  @keydown.enter.prevent="$emit('select', p.id)" @keydown.space.prevent="$emit('select', p.id)" @keydown="onKey(p.id, $event)"
		>
			<title>{{ p.aria }}</title>
			<circle :r="hit" class="bedv-hit" />
			<circle v-if="p.ringed" :r="r + 4" class="bedv-ring-tol" />
			<circle v-if="p.chosen" :r="r + 7" class="bedv-chosen-ring" />
			<circle :r="p.r + 3" class="bedv-ring" />
			<circle v-if="p.shape === 'disc'" :r="p.r" :class="p.cls" :style="p.fill ? 'fill:' + p.fill : ''" />
			<rect v-else-if="p.shape === 'diamond'" :x="-p.r" :y="-p.r" :width="2 * p.r" :height="2 * p.r" transform="rotate(45)" :class="p.cls" />
			<g v-else-if="p.shape === 'cross'"><circle :r="p.r" :class="p.cls" /><path :d="'M' + -p.r / 2 + ',' + -p.r / 2 + ' L' + p.r / 2 + ',' + p.r / 2 + ' M' + p.r / 2 + ',' + -p.r / 2 + ' L' + -p.r / 2 + ',' + p.r / 2" class="bedv-mark" /></g>
			<circle v-else :r="p.r" :class="p.cls" />
			<text v-if="p.label" y="3" text-anchor="middle" :style="p.fill ? 'fill:' + p.ink : ''" :class="p.shape === 'disc' && !p.fill ? 'bedv-order' : 'bedv-order-out'">{{ p.label }}</text>
		</g>
	</g>
</template>

<script setup>
// The points of a plan or a result on the bed: one glyph per status (disc = measured / will be measured, diamond = clipped, dashed circle
// with a cross = outside the probe reach, dashed circle = unknown), so the status never depends on colour alone; the step number inside
// when there is room, the faint travel route behind. Every point is a 44 px touch target and focusable (Enter / Space selects it, arrows
// move it when it can be dragged). With `chosen`, the points the person chose get a solid outer ring and the derived ones are plain and a
// little smaller: the difference is a shape, never only a colour.

import { computed } from 'vue'
import { t } from '../text.js'
import { glyphRadius, HIT_RADIUS } from '../lib/bed-frame.js'
import { pathOf } from '../lib/bed-mesh-plan.js'
import { textOn } from '../view/color-scale.js'

const SHAPE = { measure: 'disc', measured: 'disc', clipped: 'diamond', outside_reach: 'cross', unknown: 'dash', missing: 'dash', duplicate: 'dash' }

const props = defineProps({
	frame: { type: Object, required: true },
	points: { type: Array, required: true }, // [{id, x, y, status, reason, order, z?}]
	selected: { type: String, default: '' },
	fills: { type: Object, default: null }, // id -> colour of a heat map
	ringed: { type: Array, default: () => [] }, // ids outlined (out of tolerance)
	showPath: { type: Boolean, default: true },
	showValues: { type: Boolean, default: false },
	draggable: { type: Boolean, default: false },
	chosen: { type: Array, default: null } // ids of the points the person chose (a plan where some nodes are only derived); null = no such difference
})
const emit = defineEmits(['select', 'nudge'])

const r = computed(() => glyphRadius(props.frame, props.points))
const hit = HIT_RADIUS
const route = computed(() => {
	const path = props.showPath ? pathOf(props.points) : []
	return path.length > 1 ? path.map(p => props.frame.toPx(p.x, p.y)).map(c => c.x + ',' + c.y).join(' ') : ''
})
const drawn = computed(() => props.points.map(p => ({
	id: p.id, px: props.frame.toPx(p.x, p.y), r: props.chosen && props.chosen.indexOf(p.id) < 0 ? r.value * 0.8 : r.value,
	chosen: !!props.chosen && props.chosen.indexOf(p.id) >= 0, derived: !!props.chosen && props.chosen.indexOf(p.id) < 0, shape: SHAPE[p.status] || 'dash', cls: 'bedv-st-' + p.status, fill: props.fills ? props.fills[p.id] || null : null, ink: props.fills && props.fills[p.id] ? textOn(props.fills[p.id]) : '',
	ringed: props.ringed.indexOf(p.id) >= 0, label: labelOf(p), aria: ariaOf(p, props.chosen ? (props.chosen.indexOf(p.id) >= 0 ? 'chosen' : 'derived') : '')
})))

function labelOf(p) {
	if (props.showValues && typeof p.z === 'number' && r.value >= 8) return p.z.toFixed(2)
	if (props.fills) return ''
	if (p.status === 'unknown') return r.value >= 7 ? '?' : ''
	return p.order > 0 && r.value >= 7 ? String(p.order) : ''
}
function ariaOf(p, kind) {
	const head = p.order > 0 ? t('bed.point_step', { n: p.order }) : t('bed.point_plain')
	return head + ' X ' + p.x.toFixed(1) + ' Y ' + p.y.toFixed(1) + ': ' + t('bed.status_' + p.status) + (kind ? ', ' + t('bed.mark_' + kind) : '')
}
// arrows move a focused point one step (Shift: ten) when the caller lets points be dragged; the caller decides what moves
function onKey(id, ev) {
	if (!props.draggable || ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].indexOf(ev.key) < 0) return
	ev.preventDefault()
	emit('nudge', { id, key: ev.key, shift: ev.shiftKey })
}
</script>
