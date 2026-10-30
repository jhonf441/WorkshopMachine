<template>
	<div class="area-map">
		<bed-svg v-if="bed" :bed="bed" :label="t('workarea.map_title')" @pointer="onPointer">
			<template #default="{ frame }">
				<g v-if="savedRegion" class="area-saved"><bed-handles layer="body" :frame="frame" :region="savedRegion" :editable="false" /></g>
				<bed-handles v-if="draftRegion" layer="body" :frame="frame" :region="draftRegion" :editable="editable" />
				<g v-for="id in markIds" :key="id" class="area-mark" :transform="at(frame, corners[id])">
					<circle r="10" />
					<text y="4" text-anchor="middle">{{ id === 'a' ? 1 : 2 }}</text>
				</g>
				<bed-handles v-if="draftRegion" layer="handles" :frame="frame" :region="draftRegion" :editable="editable" @nudge="onNudge" />
			</template>
		</bed-svg>
		<div v-else class="text-body-medium machine-faint">{{ t('workarea.map_none') }}</div>
		<div v-if="bed" class="text-body-small machine-faint mt-1">{{ t(editable ? 'workarea.map_legend_edit' : 'workarea.map_legend') }}</div>
	</div>
</template>

<script setup>
// The area on the shared bed view of Machine (the same surface as Mesh, Level and Probe): the saved area of the mode as a green dashed rectangle, the one
// being edited (the four boxes) with its eight handles, and the two corners. Dragging a handle or the rectangle, or drawing one on the empty bed, writes
// the boxes (`region`); a tap that never moved sends the bed point up (`pick`). The drag maths is state/area-gesture.js.

import { computed } from 'vue'
import BedSvg from '../bedview/BedSvg.vue'
import BedHandles from '../bedview/BedHandles.vue'
import { t } from '../text.js'
import { createDrag } from '../state/region-drag.js'
import { onGesture, onNudge as nudgeOf } from '../state/area-gesture.js'
import { bedOf, regionOf } from '../lib/workarea.js'

const props = defineProps({
	reach: { type: Object, default: null }, // {xMin, xMax, yMin, yMax} travel of X and Y
	saved: { type: Object, default: null }, // the saved rectangle of the mode
	draft: { type: Object, default: null }, // the rectangle of the boxes (valid numbers) or null
	corners: { type: Object, default: () => ({ a: null, b: null }) },
	editable: { type: Boolean, default: false } // handles, moving and drawing (technician)
})
const emit = defineEmits(['region', 'pick'])

const drag = createDrag()
const bed = computed(() => bedOf(props.reach))
const savedRegion = computed(() => regionOf(props.saved))
const draftRegion = computed(() => regionOf(props.draft))
const markIds = computed(() => ['a', 'b'].filter(id => props.corners[id]))

function at(frame, p) {
	const q = frame.toPx(p.x, p.y)
	return 'translate(' + q.x + ',' + q.y + ')'
}
function apply(r) {
	if (!r) return
	if (r.rect) emit('region', r.rect)
	else if (r.pick) emit('pick', r.pick)
}
function onPointer(ev) {
	apply(onGesture(drag, ev, { reach: props.reach, draft: props.draft, editable: props.editable }))
}
function onNudge(ev) {
	apply(nudgeOf(ev, { reach: props.reach, draft: props.draft }))
}
</script>

<style>
.area-saved .bedv-region-body { stroke: var(--bv-ok); fill: var(--bv-ok); fill-opacity: 0.08; pointer-events: none; }
.bedv .area-mark circle { fill: #e65100; stroke: #fff; stroke-width: 1.5; }
.bedv .area-mark text { fill: #fff; font-size: 11px; font-weight: 700; pointer-events: none; }
</style>
