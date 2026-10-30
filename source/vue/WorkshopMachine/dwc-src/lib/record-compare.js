'use strict'

// Comparison of two calibration records of the same kind (design 2.11) and the flattening of a record into path / value rows. The
// service makes the comparison (machine.history.compare, including the difference of two height maps); this file shapes it. Pure.

import { formatValue } from './format.js'

const MAX_LEAVES = 200
const MAX_ARRAY = 40

// {path: value} of every number, text or boolean inside a record part; arrays of numbers keep their index ("samples[3]")
export function flatten(value, prefix, out) {
	const acc = out || {}
	const pre = prefix || ''
	if (Array.isArray(value)) {
		value.slice(0, MAX_ARRAY).forEach((v, i) => flatten(v, pre + '[' + i + ']', acc))
		if (value.length > MAX_ARRAY) acc[pre + '.length'] = value.length
	} else if (value && typeof value === 'object') {
		Object.keys(value).forEach(k => flatten(value[k], pre ? pre + '.' + k : k, acc))
	} else if (pre && Object.keys(acc).length < MAX_LEAVES) {
		acc[pre] = value
	}
	return acc
}

const MESH_REASONS = ['grid_differs', 'mesh_missing', 'unreadable']

// The comparison the service made (machine.history.compare, normalized by the api) as the table the page shows: the changed values
// first, with the input values prefixed `inputs.` and the results `results.`; for height maps the difference grid (b - a).
// -> {ok, reasonKey, rows: [{path, aText, bText, delta, changed}], changed, cut, mesh: {ok, reasonKey, grid} | null}
export function compareView(compare, a, b) {
	if (!a || !b) return { ok: false, reasonKey: 'history.err_pick_two', rows: [], changed: 0, cut: false, mesh: null }
	if (a.id === b.id) return { ok: false, reasonKey: 'history.err_same_record', rows: [], changed: 0, cut: false, mesh: null }
	if (a.kind !== b.kind) return { ok: false, reasonKey: 'history.err_kind_mismatch', rows: [], changed: 0, cut: false, mesh: null }
	if (!compare) return { ok: true, reasonKey: null, rows: [], changed: 0, cut: false, mesh: null }
	const rows = diffRows(compare.inputs, 'inputs').concat(diffRows(compare.results, 'results'))
	rows.sort((x, y) => Number(y.changed) - Number(x.changed))
	const m = compare.mesh
	return {
		ok: true, reasonKey: null, rows, changed: rows.filter(r => r.changed).length, cut: compare.inputs.cut || compare.results.cut,
		mesh: m ? { ok: m.ok, reasonKey: m.ok ? null : 'history.err_mesh_' + (MESH_REASONS.indexOf(m.reason) >= 0 ? m.reason : 'unreadable'), grid: m.grid } : null
	}
}

// the rows of a normalized Diff for the table, with a prefix on the key
export function diffRows(diff, prefix) {
	return ((diff && diff.rows) || []).map(r => ({ path: prefix ? prefix + '.' + r.key : r.key, aText: formatValue(r.a), bText: formatValue(r.b), delta: r.delta, changed: r.changed }))
}

export function visibleRows(view, onlyChanged) {
	return onlyChanged ? view.rows.filter(r => r.changed) : view.rows
}
