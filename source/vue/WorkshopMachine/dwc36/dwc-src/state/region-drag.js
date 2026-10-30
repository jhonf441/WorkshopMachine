'use strict'

// Explicit state of a drag on the bed view (mesh region and levelling points). The component feeds it the `pointer` events of BedSvg;
// the functions return what changed (a region, a moved point) and the component applies it. Plain functions that take the state.
//
// kind: '' (nothing) | 'handle' (an edge or corner of the region) | 'move' (the whole region) | 'new' (a region drawn on the empty bed)
//       | 'point' (a levelling point)
// `moved` is true once the pointer travelled more than SLOP px, so a tap (select) is told apart from a drag.

import { dragHandle, dragMove, regionFromCorners } from '../lib/bed-region.js'

export const SLOP = 6

export function createDrag() {
	return { kind: '', hit: '', handle: '', pointId: '', under: '', origin: null, region: null, moved: false, start: null }
}

function reset(d) {
	d.kind = ''
	d.hit = ''
	d.handle = ''
	d.pointId = ''
	d.under = ''
	d.origin = null
	d.region = null
	d.moved = false
	d.start = null
}

// ev: {hit, wx, wy}; px: {x, y} of the pointer in px (for the slop); region: the current region or null
export function begin(d, ev, px, region, editRegion) {
	reset(d)
	d.start = px
	d.hit = ev.hit
	d.under = ev.under || ''
	d.origin = { x: ev.wx, y: ev.wy }
	d.region = region
	if (ev.hit.indexOf('h:') === 0 && region && editRegion) { d.kind = 'handle'; d.handle = ev.hit.slice(2) }
	else if (ev.hit === 'move' && region && editRegion) d.kind = 'move'
	else if (ev.hit.indexOf('p:') === 0) { d.kind = 'point'; d.pointId = ev.hit.slice(2) }
	else if (!ev.hit && editRegion) d.kind = 'new'
	return d.kind
}

// -> {region} | {point: {id, x, y}} | null (nothing to apply yet)
export function update(d, ev, px, bed, step) {
	if (!d.kind) return null
	if (!d.moved && Math.hypot(px.x - d.start.x, px.y - d.start.y) < SLOP) return null
	d.moved = true
	if (d.kind === 'handle') return { region: dragHandle(d.region, d.handle, ev.wx, ev.wy, bed, step) }
	if (d.kind === 'move') return { region: dragMove(d.region, ev.wx - d.origin.x, ev.wy - d.origin.y, bed, step) }
	if (d.kind === 'new') {
		const region = regionFromCorners(d.origin, { x: ev.wx, y: ev.wy }, bed, step)
		return region ? { region } : null
	}
	return { point: { id: d.pointId, x: ev.wx, y: ev.wy } }
}

// true while the pointer is still within the slop of where it went down (the gesture is a tap, not a drag); px = {x, y}
export function isTap(d, px) {
	return !!d.start && Math.hypot(px.x - d.start.x, px.y - d.start.y) < SLOP
}

// the browser took the gesture (a scroll on a touch screen): forget it, nothing was tapped
export function cancel(d) {
	reset(d)
}

// the end of the gesture: {tap: <hit of the pointer down>} when it never moved, else {}. The pointer is captured by the svg, so the
// element under the finger is only known at the pointer down.
export function finish(d) {
	// a tap on a handle that has a point under its centre chooses that point; dragging the handle resizes
	const tap = d.moved ? '' : d.hit.indexOf('h:') === 0 && d.under ? d.under : d.hit
	reset(d)
	return tap ? { tap } : {}
}
