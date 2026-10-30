<template>
	<g v-if="box" class="bedv-region">
		<rect v-if="layer !== 'handles'" :x="box.x" :y="box.y" :width="box.w" :height="box.h" class="bedv-region-body" :data-hit="editable && body ? 'move' : null" :style="editable && body ? 'cursor:move;touch-action:none' : 'pointer-events:none'" />
		<g v-if="okBox && layer !== 'handles'" class="bedv-accepted">
			<rect :x="okBox.x" :y="okBox.y" :width="okBox.w" :height="okBox.h" />
			<text :x="okBox.x + 5" :y="okBox.y + okBox.h - 6">{{ t('bed.accepted_label') }}</text>
		</g>
		<template v-if="editable && layer !== 'body'">
			<g
				v-for="h in handles" :key="h.id" :transform="'translate(' + h.px.x + ',' + h.px.y + ')'" class="bedv-handle-box" :data-hit="'h:' + h.id"
				tabindex="0" role="slider" :aria-label="t('bed.handle_' + h.id)" :aria-valuetext="h.text" style="touch-action:none;cursor:pointer" @keydown="onKey(h.id, $event)"
			>
				<rect x="-22" y="-22" width="44" height="44" class="bedv-hit" />
				<rect x="-7" y="-7" width="14" height="14" class="bedv-handle" />
			</g>
		</template>
	</g>
</template>

<script setup>
// The mesh region on the bed: dashed rectangle (drag it to move it, unless `body` is off) and eight handles (drag to resize). Each handle is a 44 px touch
// target AND reachable by keyboard: Tab to the handle, arrow keys move it one step (shift = ten steps). Emits `nudge` {handle, key, shift};
// the dragging itself is done by the caller from the BedSvg pointer events (state/region-drag.js).

import { computed } from 'vue'
import { t } from '../text.js'
import { rectPx } from '../lib/bed-frame.js'
import { handlePositions } from '../lib/bed-region.js'

const ARROWS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']

const props = defineProps({
	frame: { type: Object, required: true },
	region: { type: Object, default: null }, // {xmin..ymax} in mm
	accepted: { type: Object, default: null }, // the part of it the run accepts (inside the reach minus the margin), when smaller
	editable: { type: Boolean, default: true },
	body: { type: Boolean, default: true }, // the rectangle itself can be dragged (not in the Points mode: a tap inside it adds a point there)
	layer: { type: String, default: '' } // 'body' = the rectangle only (drawn under the points), 'handles' = the eight handles only (drawn above them), '' = both
})
const emit = defineEmits(['nudge'])

const box = computed(() => rectPx(props.frame, props.region))
const okBox = computed(() => rectPx(props.frame, props.accepted))
const handles = computed(() => (props.region ? handlePositions(props.region).map(h => ({ id: h.id, px: props.frame.toPx(h.x, h.y), text: h.x.toFixed(1) + ', ' + h.y.toFixed(1) })) : []))

function onKey(handle, ev) {
	if (ARROWS.indexOf(ev.key) < 0) return
	ev.preventDefault()
	emit('nudge', { handle, key: ev.key, shift: ev.shiftKey })
}
</script>
