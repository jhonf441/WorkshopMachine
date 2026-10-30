'use strict'

// Offsets module logic (design 2.7): the tool offsets table, the work coordinate systems G54..G59.3 (read only), the draft of the tools
// the person edits and the values of the plan that persists it. Pure. The snapshot comparison is made by the service (machine.history.compare).
//
// A "set" is {number | index, name, offsets: {X: n, Y: n, ...}}: a tool (number) or a work system (index 1..9, name 'G54'..'G59.3').
// The tool offsets persist as kind config.g10 (ONE tool per plan; not an admin-class kind, so a technician edits them, the server enforces
// it). The work offsets are the work zones of the Workbench (0:/sys/workshop/zones/p<N>.g, with the laser <-> pointer correction inside):
// this page shows them and keeps snapshots to compare; the button "Edit in the Workbench" (lib/cross-page.js) takes the person there.

import { formatNumber } from './format.js'

export const KIND_TOOLS = 'config.g10'
export const LIMIT = 1000 // mm: an offset beyond this is a typing mistake
const AXIS_ORDER = 'XYZUVWABC'

// the axis letters used by the sets, in the usual order (X Y Z U V W A B C, then any other)
export function axesOf(sets) {
	const seen = {}
	;(sets || []).forEach(s => Object.keys(s.offsets || {}).forEach(a => { seen[a] = true }))
	const rank = a => (AXIS_ORDER.indexOf(a) >= 0 ? AXIS_ORDER.indexOf(a) : AXIS_ORDER.length)
	return Object.keys(seen).sort((a, b) => rank(a) - rank(b) || (a < b ? -1 : 1))
}

// the text of a field -> number | null (empty or not a number or out of range)
export function parseOffset(text) {
	if (typeof text === 'number') return isFinite(text) && Math.abs(text) <= LIMIT ? text : null
	const s = String(text === undefined || text === null ? '' : text).trim().replace(',', '.')
	if (s === '' || !/^[-+]?(\d+\.?\d*|\.\d+)$/.test(s)) return null
	const n = Number(s)
	return Math.abs(n) <= LIMIT ? n : null
}

export function keyOf(set) {
	return set.number !== undefined && set.number !== null ? 'T' + set.number : set.name
}

// the label of a set in a table: tools by number and name, work systems by their G code
export function setLabel(set) {
	return set.number !== undefined && set.number !== null ? 'T' + set.number + (set.name ? ' ' + set.name : '') : set.name
}

// {key: {axis: 'text'}} to start editing
export function draftOf(sets, axes) {
	const d = {}
	;(sets || []).forEach(s => {
		d[keyOf(s)] = {}
		axes.forEach(a => { d[keyOf(s)][a] = typeof s.offsets[a] === 'number' ? formatNumber(s.offsets[a], 3) : '' })
	})
	return d
}

// the sets whose draft differs from the original: [{key, set, offsets: {axis: number}, errors: [axis]}]; a field left empty or wrong is an error
export function changedSets(sets, draft, axes) {
	const out = []
	;(sets || []).forEach(s => {
		const row = (draft || {})[keyOf(s)] || {}
		const offsets = {}
		const errors = []
		let changed = false
		axes.forEach(a => {
			if (s.offsets[a] === undefined || s.offsets[a] === null) return
			const v = parseOffset(row[a])
			if (v === null) { errors.push(a); return }
			offsets[a] = v
			if (Math.abs(v - s.offsets[a]) > 0.0005) changed = true
		})
		if (changed || errors.length) out.push({ key: keyOf(s), set: s, offsets, errors })
	})
	return out
}

export function draftErrors(changes) {
	return changes.filter(c => c.errors.length)
}

// the values of the plan of ONE tool (config.g10 edits one tool per plan; api/machine-api-p2.js serviceValues maps the names)
export function toolValues(change) {
	return { tools: [{ number: change.set.number, offsets: change.offsets }] }
}

// the tool whose row the person asked to review: its change, or null when it has nothing to write
export function toolChange(changes, key) {
	const c = changes.find(x => x.key === key)
	return c && !c.errors.length ? c : null
}
