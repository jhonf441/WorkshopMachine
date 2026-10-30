'use strict'

// The explicit state of the camera verification section: plain object + plain functions, no Vue, no network.
//   form   what the person chose: {target, system ('' = the current one), method, tolerance}
//   rows   the latest result per system / tool (api normalizeVerification rows), keyed in `byKey`
//   seeded true once the history was read

import { rowKey, DEFAULT_TOLERANCE_MM } from '../lib/verification.js'

export function createVerifyState() {
	return { form: { target: 'system', system: '', method: 'crosshair', tolerance: String(DEFAULT_TOLERANCE_MM) }, byKey: {}, seeded: false }
}

// a result of a run just finished: it replaces what the table had for that system / tool
export function addResult(state, row) {
	if (row && row.number !== null) state.byKey = Object.assign({}, state.byKey, { [rowKey(row)]: row })
	return state
}

// the history read at load: newest first, so the first row of each system / tool wins and never replaces a result of this session
export function seed(state, rows) {
	const next = Object.assign({}, state.byKey)
	rows.forEach(r => {
		if (r.number !== null && !next[rowKey(r)]) next[rowKey(r)] = r
	})
	state.byKey = next
	state.seeded = true
	return state
}

export function rowsOf(state) {
	return Object.keys(state.byKey).map(k => state.byKey[k])
}
