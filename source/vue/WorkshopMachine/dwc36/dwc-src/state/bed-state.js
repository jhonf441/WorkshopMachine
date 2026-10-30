'use strict'

// Explicit state of the bed view (Mesh, Level, Probe): the layout the service reports (machine.layout), what the page may assume while it
// has no answer, Plain functions that take the state; the component only holds it in data(). The geometry that
// is pure (grid of points, travel order, reach) is computed locally so the drawing is instant; when the service answers, ITS
// bed, offset, reach, leadscrews and point statuses win.
//
// status: 'idle' | 'loading' | 'ready' | 'unavailable' (the service has no machine.layout: local geometry only) | 'error'

import { bedOf } from '../lib/mesh-grid.js'
import { reachOf } from '../lib/bed-mesh-plan.js'

export const MISSING = ['no_bed', 'no_probe', 'no_reach', 'empty_reach', 'unsupported_kinematics', 'no_m671', 'm671_unreadable', 'layout_unavailable']

export function createBedState() {
	return { status: 'idle', layout: null, draftKey: '', error: '' }
}

const NOT_THERE = ['not_implemented', 'service_outdated', 'invalid_args', 'unknown_op']

// the identity of an ask: the answer is used for the points only if it answered THIS mode and draft
export function draftKeyOf(mode, draft) {
	return JSON.stringify([mode, draft || {}])
}

// mode 'mesh' | 'level'; draft: mesh {region, points: [nx, ny], probe} or level {points: [{x, y}]} so the service can confirm the points; never throws
export async function loadLayout(state, api, mode, draft) {
	// an answer already on screen stays 'ready' while the next one is asked: flipping to 'loading' made the panels blink between the
	// service's points and the local ones (layoutFor() already ignores an answer that is not for the draft being asked)
	if (!state.layout || state.status === 'idle') state.status = 'loading'
	try {
		const key = draftKeyOf(mode, draft)
		state.layout = await api.layout.get(mode, draft)
		state.draftKey = key // which draft the points of this answer belong to (an answer to an older draft is not used)
		state.status = 'ready'
		state.error = ''
	} catch (e) {
		state.status = e && NOT_THERE.indexOf(e.code) >= 0 ? 'unavailable' : 'error'
		state.error = e && e.message ? String(e.message) : ''
	}
	return state.status
}

// What the views draw, merged: {bed, offset, reach, reachSource, screws, probePresent, kinematics, missing[]}.
// Nothing is invented: an unknown part is null and its reason is in `missing`.
export function modelOf(state, axes, grid) {
	const lay = state.status === 'ready' || state.status === 'loading' ? state.layout : null
	const bed = (lay && lay.bed) || bedOf(axes, grid)
	const offset = lay && lay.probe.offset ? lay.probe.offset : null
	let reach = lay ? lay.reach : null
	let reachSource = reach ? 'service' : null
	if (!reach && bed && offset) {
		reach = reachOf(bed, offset)
		reachSource = reach ? 'local' : null
	}
	// the reasons are the service's; a datum this page can compute itself from what DWC reports is no longer "missing"
	let missing = lay ? lay.missing.filter(m => !(m === 'no_bed' && bed) && !(m === 'no_reach' && reach)) : []
	if (!lay) missing = bed ? [] : ['no_bed']
	if (state.status === 'unavailable' || state.status === 'error') missing.push('layout_unavailable')
	return {
		bed, offset, reach, reachSource, screws: lay ? lay.screws : [],
		probePresent: lay ? lay.probe.present : null, kinematics: lay ? lay.kinematics : null, missing
	}
}
