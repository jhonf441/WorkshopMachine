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

<script>
'use strict'

// The points of a plan or a result on the bed: one glyph per status (disc = measured / will be measured, diamond = clipped, dashed circle
// with a cross = outside the probe reach, dashed circle = unknown), so the status never depends on colour alone; the step number inside
// when there is room, the faint travel route behind. Every point is a 44 px touch target and focusable (Enter / Space selects it, arrows
// move it when it can be dragged). With `chosen`, the points the person chose get a solid outer ring and the derived ones are plain and a
// little smaller: the difference is a shape, never only a colour.

import { textMixin } from '../modules/text-mixin.js'
import { glyphRadius, HIT_RADIUS } from '../lib/bed-frame.js'
import { pathOf } from '../lib/bed-mesh-plan.js'
import { textOn } from '../view/color-scale.js'

const SHAPE = { measure: 'disc', measured: 'disc', clipped: 'diamond', outside_reach: 'cross', unknown: 'dash', missing: 'dash', duplicate: 'dash' }

export default {
	mixins: [textMixin],
	props: {
		frame: { type: Object, required: true },
		points: { type: Array, required: true }, // [{id, x, y, status, reason, order, z?}]
		selected: { type: String, default: '' },
		fills: { type: Object, default: null }, // id -> colour of a heat map
		ringed: { type: Array, default: () => [] }, // ids outlined (out of tolerance)
		showPath: { type: Boolean, default: true },
		showValues: { type: Boolean, default: false },
		draggable: { type: Boolean, default: false },
		chosen: { type: Array, default: null } // ids of the points the person chose (a plan where some nodes are only derived); null = no such difference
	},
	computed: {
		r() {
			return glyphRadius(this.frame, this.points)
		},
		hit() {
			return HIT_RADIUS
		},
		route() {
			const path = this.showPath ? pathOf(this.points) : []
			return path.length > 1 ? path.map(p => this.frame.toPx(p.x, p.y)).map(c => c.x + ',' + c.y).join(' ') : ''
		},
		drawn() {
			return this.points.map(p => ({
				id: p.id, px: this.frame.toPx(p.x, p.y), r: this.chosen && this.chosen.indexOf(p.id) < 0 ? this.r * 0.8 : this.r,
					chosen: !!this.chosen && this.chosen.indexOf(p.id) >= 0, derived: !!this.chosen && this.chosen.indexOf(p.id) < 0, shape: SHAPE[p.status] || 'dash', cls: 'bedv-st-' + p.status, fill: this.fills ? this.fills[p.id] || null : null, ink: this.fills && this.fills[p.id] ? textOn(this.fills[p.id]) : '',
				ringed: this.ringed.indexOf(p.id) >= 0, label: this.labelOf(p), aria: this.ariaOf(p, this.chosen ? (this.chosen.indexOf(p.id) >= 0 ? 'chosen' : 'derived') : '')
			}))
		}
	},
	methods: {
		labelOf(p) {
			if (this.showValues && typeof p.z === 'number' && this.r >= 8) return p.z.toFixed(2)
			if (this.fills) return ''
			if (p.status === 'unknown') return this.r >= 7 ? '?' : ''
			return p.order > 0 && this.r >= 7 ? String(p.order) : ''
		},
		ariaOf(p, kind) {
			const head = p.order > 0 ? this.t('bed.point_step', { n: p.order }) : this.t('bed.point_plain')
			return head + ' X ' + p.x.toFixed(1) + ' Y ' + p.y.toFixed(1) + ': ' + this.t('bed.status_' + p.status) + (kind ? ', ' + this.t('bed.mark_' + kind) : '')
		},
		// arrows move a focused point one step (Shift: ten) when the caller lets points be dragged; the caller decides what moves
		onKey(id, ev) {
			if (!this.draggable || ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].indexOf(ev.key) < 0) return
			ev.preventDefault()
			this.$emit('nudge', { id, key: ev.key, shift: ev.shiftKey })
		}
	}
}
</script>
