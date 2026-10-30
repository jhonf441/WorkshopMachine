'use strict'

// What a pointer gesture on the bed view does for the Area page (the same drag maths as the mesh region, state/region-drag.js): resize with a handle,
// move the rectangle, draw a new one on the empty bed, or, with a tap that never moved, pick a bed point. Plain functions that take the drag state
// (createDrag()) and the events of BedSvg; the caller applies what they answer.

import { begin, update, finish, cancel, isTap } from './region-drag.js'
import { snapStepFor, nudge } from '../lib/bed-region.js'
import { bedOf, regionOf, rectOfRegion, round2 } from '../lib/workarea.js'

// ctx: {reach: {xMin..}, draft: the rectangle of the boxes or null, editable}
// -> {rect} (the boxes change), {pick: {x, y}} (a tap on the bed or inside the rectangle) or null (nothing to apply)
export function onGesture(drag, ev, ctx) {
	const bed = bedOf(ctx.reach)
	if (!bed) return null
	const px = { x: ev.px, y: ev.py }
	if (ev.type === 'cancel') {
		cancel(drag)
		return null
	}
	if (ev.type === 'down') {
		begin(drag, ev, px, regionOf(ctx.draft), ctx.editable)
		return null
	}
	if (ev.type === 'move') {
		const r = update(drag, ev, px, bed, snapStepFor(bed))
		return r && r.region ? { rect: rectOfRegion(r.region) } : null
	}
	// a tap on a handle does nothing; a tap on the empty bed or inside the rectangle picks the point
	const tap = isTap(drag, px) && (drag.hit === '' || drag.hit === 'move')
	finish(drag)
	return tap ? { pick: { x: round2(ev.wx), y: round2(ev.wy) } } : null
}

// the keyboard on a handle (BedHandles `nudge`): an arrow key moves it one step, with shift ten
export function onNudge(ev, ctx) {
	const bed = bedOf(ctx.reach)
	const r = bed && ctx.draft ? nudge(regionOf(ctx.draft), ev.handle, ev.key, ev.shift, bed, snapStepFor(bed)) : null
	return r ? { rect: rectOfRegion(r) } : null
}
