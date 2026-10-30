'use strict'

// Explicit state of the levelling points: what the service suggests (or the local suggestion, one per leadscrew) until the person edits it,
// then their own set. Plain functions that take the state; the points the page shows are passed in as `current` so the first edit starts
// from exactly what was on screen. `edited` false means "follow the suggestion" (it changes with the layout).

import * as edit from './point-edit-state.js'
import { suggestPoints, classify, orderPoints, withScrews } from '../lib/bed-level-plan.js'

export const MAX_POINTS = 12 // the service accepts up to 32; the page keeps the set small and readable

export function createLevelPoints() {
	return edit.createPointEdit()
}

function liveStatus(status) {
	return status === 'measure' || status === 'clipped'
}

// service: layout.level of the answer to this draft, or null
export function pointsOf(state, screws, reach, service) {
	const sp = service && service.points.length ? service.points : null
	if (state.edited) {
		// the draft sent to the service is this same ordered list, so its answer lines up by position
		const ordered = withScrews(orderPoints(state.points.map(p => classify(p, reach))), screws)
		if (!sp || sp.length !== ordered.length) return ordered
		let n = 0
		return ordered.map((p, k) => Object.assign({}, p, { status: sp[k].status, reason: sp[k].reason, order: liveStatus(sp[k].status) ? ++n : 0, screw: sp[k].near ? sp[k].near.index : p.screw }))
	}
	if (!sp) return withScrews(orderPoints(suggestPoints(screws, reach)), screws)
	// the service numbers its points (the P of G30): its order is kept
	let n = 0
	return sp.map(p => ({ id: 's' + p.index, x: p.x, y: p.y, status: p.status, reason: p.reason, order: liveStatus(p.status) ? ++n : 0, screw: p.near ? p.near.index : null }))
}

// the edits (with undo / redo) are the shared ones of state/point-edit-state.js; these keep the names and the limit of the levelling page
export function movePoint(state, current, id, x, y) {
	edit.movePoint(state, current, id, x, y)
}

export function addPoint(state, current, x, y) {
	return !!edit.addPoint(state, current, x, y, MAX_POINTS)
}

export function removePoint(state, current, id) {
	edit.removePoints(state, current, [id])
}

export function resetPoints(state) {
	edit.resetPoints(state)
}
