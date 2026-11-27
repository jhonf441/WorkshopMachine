<template>
	<g class="bedv-screws">
		<line v-for="l in linkLines" :key="l.id" :x1="l.a.x" :y1="l.a.y" :x2="l.b.x" :y2="l.b.y" class="bedv-link" />
		<g
			v-for="s in drawn" :key="s.index" :transform="'translate(' + s.px.x + ',' + s.px.y + ')'" class="bedv-screw" :class="{ 'bedv-screw-out': s.out, 'bedv-screw-sel': s.index === selected }"
			role="button" tabindex="0" :aria-label="s.aria" :aria-pressed="s.index === selected ? 'true' : 'false'" :data-hit="'s:' + s.index" @keydown.enter.prevent="$emit('select', s.index)" @keydown.space.prevent="$emit('select', s.index)"
		>
			<circle :r="area" class="bedv-screw-area" />
			<circle v-if="s.out" :r="area" class="bedv-screw-out-ring" />
			<circle r="22" class="bedv-hit" />
			<circle r="15" />
			<circle r="9" class="bedv-thread" />
			<text y="4" text-anchor="middle">Z{{ s.index }}</text>
			<g v-if="s.corr && s.corr.direction !== 'none'" :class="s.corr.direction === 'raise' ? 'bedv-raise' : 'bedv-lower'">
				<line x1="26" :y1="s.corr.direction === 'raise' ? 14 : -14" x2="26" :y2="s.corr.direction === 'raise' ? -s.len : s.len" stroke-width="3" />
				<path :d="s.corr.direction === 'raise' ? 'M19,' + (-s.len + 6) + ' L26,' + -s.len + ' L33,' + (-s.len + 6) + ' z' : 'M19,' + (s.len - 6) + ' L26,' + s.len + ' L33,' + (s.len - 6) + ' z'" />
			</g>
			<text v-if="s.corr" x="0" y="31" text-anchor="middle" class="bedv-corr-label" :class="s.corr.direction === 'raise' ? 'bedv-t-raise' : s.corr.direction === 'lower' ? 'bedv-t-lower' : ''">{{ s.text }}</text>
		</g>
	</g>
</template>

<script>
'use strict'

// The Z motors (leadscrews) where M671 puts them, numbered with the Z motor index, and, after a pass, the correction of each one as an
// arrow AND words ("raise 0.120 mm" / "lower ..." / "no change"). Dashed lines tie each measurement point to the leadscrew it is nearest to.

import { textMixin } from '../modules/text-mixin.js'
import { insideRect, screwAreaPx } from '../lib/bed-frame.js'

export default {
	mixins: [textMixin],
	props: {
		frame: { type: Object, required: true },
		screws: { type: Array, required: true }, // [{index, x, y}]
		corrections: { type: Array, default: () => [] }, // correctionsOf(...)
		links: { type: Array, default: () => [] }, // [{id, from: {x, y}, to: {x, y}}] in mm
		reach: { type: Object, default: null }, // the probe reach {xmin, xmax, ymin, ymax}: a leadscrew outside it cannot be probed from there, and is marked
		selected: { type: Number, default: null } // the index of the chosen leadscrew (its ring is thicker)
	},
	computed: {
		area() {
			return screwAreaPx(this.frame)
		},
		drawn() {
			return this.screws.map(s => {
				const corr = this.corrections.find(c => c.motor === s.index) || null
				const out = !insideRect(this.reach, s)
				const aria = this.t('bed.screw_aria', { n: s.index, x: s.x.toFixed(1), y: s.y.toFixed(1) }) + (out ? '. ' + this.t('bed.screw_outside_reach') : '')
				return { index: s.index, px: this.frame.toPx(s.x, s.y), corr, out, len: corr ? Math.min(46, 14 + Math.abs(corr.mm) * 120) : 0, text: corr ? this.corrText(corr) : '', aria }
			})
		},
		linkLines() {
			return this.links.map(l => ({ id: l.id, a: this.frame.toPx(l.from.x, l.from.y), b: this.frame.toPx(l.to.x, l.to.y) }))
		}
	},
	methods: {
		corrText(c) {
			return c.direction === 'none' ? this.t('bed.corr_none') : this.t('bed.corr_' + c.direction, { mm: Math.abs(c.mm).toFixed(3) })
		}
	}
}
</script>

<style>
.bedv-screw { cursor: pointer; }
.bedv-screw:focus { outline: none; }
.bedv .bedv-screw .bedv-screw-area { fill: var(--bv-info); fill-opacity: 0.12; stroke: var(--bv-info); stroke-width: 2; }
.bedv .bedv-screw .bedv-screw-out-ring { fill: none; stroke: var(--bv-bad); stroke-width: 2; stroke-dasharray: 4 3; }
.bedv .bedv-screw .bedv-screw-area, .bedv .bedv-screw .bedv-screw-out-ring { pointer-events: none; } /* the area is a drawing: a tap on the empty bed inside it still adds a point */
.bedv .bedv-screw .bedv-hit { fill: transparent; stroke: none; }
.bedv .bedv-screw:focus .bedv-screw-area, .bedv .bedv-screw-sel .bedv-screw-area { stroke-width: 4; fill-opacity: 0.2; }
</style>

