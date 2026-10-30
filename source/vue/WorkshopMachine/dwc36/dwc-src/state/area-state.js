'use strict'

// The explicit state of the Area module: plain object + plain functions, no Vue.
//   data      machine.workarea.get normalised (api/machine-api-p9.js), null until read
//   mode      the mode being edited (Laser or CNC)
//   draft     the four text boxes {xMin, xMax, yMin, yMax} (lib/workarea.js draftOf)
//   corners   the two corners taken by hand, with the pointer on the map or typed: {a, b} each {x, y} or null
//   tool      what a tap on the map does: 'a' / 'b' sets that corner, 'goto' takes the pointer there
//   working   '' or the name of the call in progress (release, capture, goto, frame, save, remove): one at a time
//   error     the text of what failed (the service's own words); errorKey a key of the plugin texts when the page knows the reason itself
//   released  true between "release X and Y" and the next corner measurement (the motors have no force)
// The actions take the api (createMachineApi(...).workarea) so a test passes a fake.

import { draftOf, parseDraft, rectProblems, cornersRect, sameRect, blockReason, toolPoint } from '../lib/workarea.js'

export function createAreaState() {
	return {
		data: null, loadError: null, mode: 'Laser', draft: draftOf(null), corners: { a: null, b: null }, tool: 'a',
		working: '', released: false, notice: '', error: '', errorKey: ''
	}
}

export function savedRect(state) {
	return state.data ? state.data.areas[state.mode] || null : null
}

export function applyData(state, data, first) {
	state.data = data
	if (first) {
		state.mode = data.editModes.indexOf(data.mode) >= 0 ? data.mode : data.editModes[0] || 'Laser'
		state.draft = draftOf(savedRect(state))
	}
	return state
}

export function selectMode(state, mode) {
	state.mode = mode
	state.draft = draftOf(savedRect(state))
	state.corners = { a: null, b: null }
	state.notice = ''
	state.error = ''
	state.errorKey = ''
	return state
}

export function setField(state, key, text) {
	state.draft = Object.assign({}, state.draft, { [key]: text })
	state.notice = ''
	return state
}

// the rectangle dragged on the map: the four boxes take its numbers
export function setRect(state, rect) {
	state.draft = draftOf(rect)
	state.notice = ''
	return state
}

// the draft read and checked: {ok, rect, problems: [key]} (ok false with `errorKey` while a box is not a number)
export function checked(state) {
	const p = parseDraft(state.draft)
	if (!p.ok) return { ok: false, rect: null, problems: [p.errorKey], empty: KEYS_EMPTY(state.draft) }
	const problems = rectProblems(p.rect, state.data ? state.data.reach : null, state.data ? state.data.minMm : 10)
	return { ok: problems.length === 0, rect: p.rect, problems, empty: false }
}

function KEYS_EMPTY(draft) {
	return Object.keys(draft).every(k => String(draft[k]).trim() === '')
}

export function isDirty(state) {
	const c = checked(state)
	if (c.empty) return !!savedRect(state)
	return !c.rect || !sameRect(c.rect, savedRect(state))
}

// a corner arrives (measured, tapped on the map): with both corners the draft becomes their rectangle
export function setCorner(state, which, point) {
	state.corners = Object.assign({}, state.corners, { [which]: { x: point.x, y: point.y } })
	if (state.corners.a && state.corners.b) {
		state.draft = draftOf(cornersRect(state.corners.a, state.corners.b))
		state.notice = ''
	}
	return state
}

export function clearCorners(state) {
	state.corners = { a: null, b: null }
	return state
}

// the reason `action` cannot run now ('' = it can)
export function blocked(state, action) {
	if (state.working) return 'working'
	return blockReason(state.data, action, state.mode)
}

async function work(state, name, fn) {
	if (state.working) return false
	state.working = name
	state.error = ''
	state.errorKey = ''
	try {
		await fn()
		return true
	} catch (e) {
		if (e && e.code === 'cancelled') return false
		state.error = e && e.message ? e.message : String(e)
		return false
	} finally {
		state.working = ''
	}
}

export async function load(state, api) {
	try {
		applyData(state, await api.get(), !state.data)
		state.loadError = null
	} catch (e) {
		state.loadError = e
	}
}

// saves the draft as the area of the mode (the service checks it again and keeps the other modes)
export function save(state, api, noticeText) {
	const c = checked(state)
	if (!c.ok) return Promise.resolve(false)
	return work(state, 'save', async () => {
		const r = await api.save(state.mode, c.rect)
		state.data = Object.assign({}, state.data, { areas: r.areas, file: true })
		state.notice = noticeText
	})
}

export function remove(state, api, noticeText) {
	return work(state, 'remove', async () => {
		const r = await api.save(state.mode, null)
		state.data = Object.assign({}, state.data, { areas: r.areas, file: true })
		state.draft = draftOf(null)
		state.corners = { a: null, b: null }
		state.notice = noticeText
	})
}

export function release(state, api) {
	return work(state, 'release', async () => {
		await api.release()
		state.released = true
	})
}

// the tool is where the corner is (taken there with the jog): its position is corner `which`; nothing moves
export function hereCorner(state, axes, which) {
	const p = toolPoint(axes)
	if (!p) {
		state.errorKey = 'workarea.err_not_homed_here'
		return state
	}
	state.errorKey = ''
	state.error = ''
	return setCorner(state, which, p)
}

// measures the corner at the end stops (the macro ends with a homing of X and Y) and keeps it as corner `which`
export function capture(state, api, which) {
	return work(state, 'capture', async () => {
		const p = await api.capture()
		state.released = false
		if (!p) {
			state.errorKey = 'workarea.err_no_reading'
			return
		}
		setCorner(state, which, p)
		await refreshHomed(state, api)
	})
}

export function gotoPoint(state, api, point) {
	return work(state, 'goto', async () => { await api.goto(point.x, point.y) })
}

export function frame(state, api) {
	return work(state, 'frame', async () => { await api.frame() })
}

async function refreshHomed(state, api) {
	try {
		applyData(state, await api.get(), false)
	} catch (e) {
		/* the numbers are what matters: the next load shows the homing */
	}
}
