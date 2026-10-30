'use strict'

// What lies under a press on a resize handle. The handles are drawn above the points (a handle has to win the drag) and have a 44 px hit
// area, but the nodes of a grid sit exactly on the corners and the middle of the area. The press keeps the handle, so dragging it resizes;
// the point whose glyph is under the finger is reported apart (`under`) and is chosen when the gesture turns out to be a tap.

export const POINT_GRAB = 12 // px from the centre of a point: its glyph and a little more

// `hit` = the data-hit of the element under the finger; returns the data-hit ('p:<id>') of the point under a handle, or ''
export function pointUnder(ev, hit, doc) {
	if (hit.indexOf('h:') !== 0 || !doc || typeof doc.elementsFromPoint !== 'function') return ''
	const stack = doc.elementsFromPoint(ev.clientX, ev.clientY)
	let best = ''
	let bestD = POINT_GRAB
	stack.forEach(el => {
		const g = el.closest ? el.closest('[data-hit^="p:"]') : null
		if (!g) return
		const r = g.getBoundingClientRect()
		const d = Math.hypot(ev.clientX - (r.left + r.width / 2), ev.clientY - (r.top + r.height / 2))
		if (d <= bestD) {
			bestD = d
			best = g.getAttribute('data-hit')
		}
	})
	return best
}
