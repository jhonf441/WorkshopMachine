<template>
	<g v-if="box" class="bedv-job">
		<rect :x="box.x" :y="box.y" :width="box.w" :height="box.h" class="bedv-job-body" :class="verdictClass" />
		<text :x="box.x + 6" :y="box.y + 14" class="bedv-job-label">{{ t('bed.job_label') }}</text>
		<template v-if="editable">
			<g
				v-for="h in handles" :key="h.id" :transform="'translate(' + h.px.x + ',' + h.px.y + ')'" class="bedv-job-box" :data-hit="'j:' + h.id"
				tabindex="0" role="slider" :aria-label="t(h.id === 'move' ? 'bed.job_handle_move' : 'bed.job_handle_' + h.id)" :aria-valuetext="h.text" style="touch-action:none;cursor:pointer" @keydown="onKey(h.id, $event)"
			>
				<rect x="-22" y="-22" width="44" height="44" class="bedv-hit" />
				<circle v-if="h.id === 'move'" r="9" class="bedv-job-handle" />
				<rect v-else x="-7" y="-7" width="14" height="14" class="bedv-job-handle" />
			</g>
		</template>
	</g>
</template>

<script>
'use strict'

// The work rectangle of "Check a job area" on the bed: dashed rectangle (its outline is blue, red when the job does not fit, green when it
// does; the card says it in words), four corner handles to resize and a round handle in the middle to move it. Every handle is a 44 px
// touch target AND a slider for the keyboard (arrows, Shift = ten steps). Emits `nudge` {handle, key, shift}; dragging is done by the caller
// from the BedSvg pointer events with the hits 'j:<handle>'.

import { textMixin } from '../modules/text-mixin.js'
import { rectPx } from '../lib/bed-frame.js'

const ARROWS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']
const CORNERS = ['nw', 'ne', 'se', 'sw']

export default {
	mixins: [textMixin],
	props: {
		frame: { type: Object, required: true },
		rect: { type: Object, default: null }, // {xmin..ymax} in mm
		verdict: { type: String, default: 'unknown' }, // 'fits' | 'does_not_fit' | 'unknown'
		editable: { type: Boolean, default: true }
	},
	computed: {
		box() {
			return rectPx(this.frame, this.rect)
		},
		verdictClass() {
			return this.verdict === 'fits' ? 'bedv-job-good' : this.verdict === 'does_not_fit' ? 'bedv-job-bad' : ''
		},
		handles() {
			const r = this.rect
			const at = { nw: [r.xmin, r.ymax], ne: [r.xmax, r.ymax], se: [r.xmax, r.ymin], sw: [r.xmin, r.ymin], move: [(r.xmin + r.xmax) / 2, (r.ymin + r.ymax) / 2] }
			return CORNERS.concat(['move']).map(id => ({ id, px: this.frame.toPx(at[id][0], at[id][1]), text: at[id][0].toFixed(1) + ', ' + at[id][1].toFixed(1) }))
		}
	},
	methods: {
		onKey(handle, ev) {
			if (ARROWS.indexOf(ev.key) < 0) return
			ev.preventDefault()
			this.$emit('nudge', { handle, key: ev.key, shift: ev.shiftKey })
		}
	}
}
</script>
