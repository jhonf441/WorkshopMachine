<template>
	<g class="bedv-snap">
		<g v-for="m in drawn" :key="m.id" role="img" :aria-label="m.text">
			<title>{{ m.text }}</title>
			<line v-if="m.to" :x1="m.from.x" :y1="m.from.y" :x2="m.to.x" :y2="m.to.y" />
			<g :transform="'translate(' + m.from.x + ',' + m.from.y + ')'" :class="m.ignored ? 'bedv-ignored-mark' : 'bedv-snap-mark'">
				<circle r="7" />
				<path d="M-4,-4 L4,4 M4,-4 L-4,4" />
			</g>
		</g>
	</g>
</template>

<script>
'use strict'

// Where the person chose a point that the run will NOT measure as chosen: a snapped point (small circle with a cross where it was chosen and
// a line to the node that is measured instead) and an ignored one (dashed red circle with a cross: outside what the run accepts). The words
// and the numbers are in the list of the side panel (GridSummary.vue); this layer is only the picture, so it takes no pointer.

import { textMixin } from '../modules/text-mixin.js'

export default {
	mixins: [textMixin],
	props: {
		frame: { type: Object, required: true },
		marks: { type: Array, required: true } // [{id, x, y, to: {x, y} | null, ignored}]
	},
	computed: {
		drawn() {
			return this.marks.map(m => ({ id: m.id, ignored: !!m.ignored, text: this.t(m.ignored ? 'bed.mark_ignored' : 'bed.mark_snapped'), from: this.frame.toPx(m.x, m.y), to: m.to ? this.frame.toPx(m.to.x, m.to.y) : null }))
		}
	}
}
</script>
