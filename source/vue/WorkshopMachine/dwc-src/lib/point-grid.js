'use strict'

// The regular grid that contains the points a person CHOSE on the bed. Pure.
//
// The firmware measures one thing: a regular grid (M557 X<min>:<max> Y<min>:<max> P<nx>:<ny>, spacing = span / (n - 1) on each axis). It
// cannot skip a node inside the grid, and it cannot measure a point that is not a node. So the chosen points are CONSTRAINTS and this module
// derives the grid:
//   1. the bounding box of the chosen points is the region;
//   2. nx and ny are the SMALLEST counts for which every chosen point lies within `tol` mm of a node (an exact grid);
//   3. when no such grid exists inside the limits (too many nodes would be needed, or the spacings do not line up), the best grid inside
//      the limits is used and every chosen point is SNAPPED to its nearest node; each snapped point is reported with its distance.
// The x and y lattices are independent (the grid is their product), so each axis is searched alone and the pair is chosen together.

export const GRID_LIMITS = {
	tol: 0.5, // mm: a chosen point this close to a node is "on" it
	minAxis: 2, // the service takes 2 or more points per axis
	maxAxis: 21, // points per axis the page offers (lib/mesh-grid.js POINTS.max)
	maxNodes: 100, // nodes in a run (the default safety limit of the service profile)
	maxChosen: 100, // chosen points kept
	padStep: 20, // mm: the second row / column when every chosen point has the same X (or Y)
	minPad: 2, // mm: the least room worth padding into
	probe: 200 // axis counts tried to tell WHY a grid is not exact
}

export const NONE_REASONS = ['no_points', 'all_ignored', 'no_room'] // bed.grid_none_<reason>: why there is no grid
export const INEXACT_REASONS = ['too_many', 'no_common_spacing'] // bed.grid_inexact_<reason>: why a grid is not exact
export const MARKS = ['chosen', 'derived'] // bed.mark_<mark>

const SAME = 0.05 // mm: two grids this close in error count as equally good (the one with fewer nodes wins)
const r3 = v => Math.round(v * 1000) / 1000

function fits(area, p) {
	return !area || (p.x >= area.xmin - 1e-6 && p.x <= area.xmax + 1e-6 && p.y >= area.ymin - 1e-6 && p.y <= area.ymax + 1e-6)
}

// residuals of the values on the lattice lo + k * step (k = 0..n-1): {n, lo, hi, step, res[], idx[]}
function lattice(values, lo, hi, n) {
	const step = (hi - lo) / (n - 1)
	const res = []
	const idx = []
	values.forEach(v => {
		const k = Math.min(n - 1, Math.max(0, Math.round((v - lo) / step)))
		idx.push(k)
		res.push(Math.abs(v - (lo + k * step)))
	})
	return { n, lo, hi, step, res, idx }
}

// the second row of an axis where every chosen point has the same value: up when there is room, else down (null when there is none)
function padAxis(v, areaLo, areaHi, limits) {
	const up = areaHi === undefined ? limits.padStep : areaHi - v
	const down = areaLo === undefined ? limits.padStep : v - areaLo
	if (up >= limits.minPad) return { lo: v, hi: r3(v + Math.min(limits.padStep, up)) }
	if (down >= limits.minPad) return { lo: r3(v - Math.min(limits.padStep, down)), hi: v }
	return null
}

// every axis count that could hold the values: [{n, lo, hi, step, res, idx, padded}]
function axisOptions(values, areaLo, areaHi, limits, maxAxis) {
	const lo = Math.min.apply(null, values)
	const hi = Math.max.apply(null, values)
	if (hi - lo <= limits.tol) {
		const pad = padAxis(lo, areaLo, areaHi, limits)
		if (!pad) return []
		return [Object.assign(lattice(values, pad.lo, pad.hi, 2), { padded: true })]
	}
	const out = []
	for (let n = limits.minAxis; n <= maxAxis; n++) out.push(Object.assign(lattice(values, lo, hi, n), { padded: false }))
	return out
}

function pairError(a, b) {
	let worst = 0
	for (let k = 0; k < a.res.length; k++) worst = Math.max(worst, Math.hypot(a.res[k], b.res[k]))
	return worst
}

// the best pair of axis options inside the node limit: the exact one with the fewest nodes, else the least error (then fewer nodes)
function bestPair(xs, ys, limits) {
	let best = null
	xs.forEach(a => ys.forEach(b => {
		if (a.n * b.n > limits.maxNodes) return
		const err = pairError(a, b)
		const nodes = a.n * b.n
		const exact = err <= limits.tol
		const better = !best ||
			(exact && !best.exact) ||
			(exact === best.exact && (exact ? nodes < best.nodes || (nodes === best.nodes && err < best.err) : err < best.err - SAME || (err <= best.err + SAME && nodes < best.nodes)))
		if (better) best = { x: a, y: b, err, nodes, exact }
	}))
	return best
}

// how many nodes an exact grid would need, ignoring the limits (null when there is none up to `probe` points per axis): tells the person WHY
function exactNeeds(xv, yv, limits) {
	const find = values => {
		const lo = Math.min.apply(null, values)
		const hi = Math.max.apply(null, values)
		if (hi - lo <= limits.tol) return 2
		for (let n = limits.minAxis; n <= limits.probe; n++) {
			if (lattice(values, lo, hi, n).res.every(r => r <= limits.tol * 0.7)) return n
		}
		return null
	}
	const nx = find(xv)
	const ny = find(yv)
	return nx && ny ? { nx, ny, nodes: nx * ny } : null
}

function nodesOf(region, nx, ny) {
	const out = []
	for (let j = 0; j < ny; j++) {
		for (let i = 0; i < nx; i++) {
			out.push({ id: 'm' + i + '_' + j, i, j, x: r3(region.xmin + ((region.xmax - region.xmin) * i) / (nx - 1)), y: r3(region.ymin + ((region.ymax - region.ymin) * j) / (ny - 1)), chosen: [] })
		}
	}
	return out
}

function empty(reason, ignored, chosen) {
	return { ok: false, reason, region: null, nx: 0, ny: 0, sx: 0, sy: 0, nodes: [], snapped: [], merged: [], ignored, exact: false, extra: 0, chosen, nodeOf: {}, exactNeeds: null, padded: { x: false, y: false } }
}

// points [{id, x, y}] -> {ok, reason, region, nx, ny, sx, sy, nodes[{id, i, j, x, y, chosen[ids]}], snapped[{id, x, y, node, distance}],
//   merged[{node, ids}], ignored[{id, reason, x, y}], exact, extra, chosen, nodeOf{id: node id}, exactNeeds, padded{x, y}}
// opts: {area: {xmin..ymax} the region the run accepts (points outside it are ignored), limits: overrides of GRID_LIMITS}
export function gridFromPoints(points, opts) {
	const o = opts || {}
	const limits = Object.assign({}, GRID_LIMITS, o.limits || {})
	const all = (points || []).filter(p => p && isFinite(p.x) && isFinite(p.y))
	const ignored = []
	const usable = []
	all.forEach(p => {
		if (fits(o.area, p)) usable.push(p)
		else ignored.push({ id: p.id, reason: 'outside_area', x: p.x, y: p.y })
	})
	if (!all.length) return empty('no_points', ignored, 0)
	if (!usable.length) return empty('all_ignored', ignored, 0)
	const xv = usable.map(p => p.x)
	const yv = usable.map(p => p.y)
	const a = o.area || {}
	const xs = axisOptions(xv, a.xmin, a.xmax, limits, limits.maxAxis)
	const ys = axisOptions(yv, a.ymin, a.ymax, limits, limits.maxAxis)
	const best = xs.length && ys.length ? bestPair(xs, ys, limits) : null
	if (!best) return empty('no_room', ignored, usable.length)
	const region = { xmin: r3(best.x.lo), xmax: r3(best.x.hi), ymin: r3(best.y.lo), ymax: r3(best.y.hi) }
	const nodes = nodesOf(region, best.x.n, best.y.n)
	const byKey = {}
	nodes.forEach(n => { byKey[n.i + '_' + n.j] = n })
	const nodeOf = {}
	const snapped = []
	usable.forEach((p, k) => {
		const node = byKey[best.x.idx[k] + '_' + best.y.idx[k]]
		node.chosen.push(p.id)
		nodeOf[p.id] = node.id
		const distance = Math.hypot(p.x - node.x, p.y - node.y)
		if (distance > limits.tol) snapped.push({ id: p.id, x: p.x, y: p.y, node: node.id, distance })
	})
	const merged = nodes.filter(n => n.chosen.length > 1).map(n => ({ node: n.id, ids: n.chosen.slice() }))
	const used = nodes.filter(n => n.chosen.length).length
	return {
		ok: true, reason: '', region, nx: best.x.n, ny: best.y.n, sx: (region.xmax - region.xmin) / (best.x.n - 1), sy: (region.ymax - region.ymin) / (best.y.n - 1),
		nodes, snapped, merged, ignored, exact: best.exact, extra: nodes.length - used, chosen: usable.length, nodeOf,
		exactNeeds: best.exact ? null : exactNeeds(xv, yv, limits), padded: { x: best.x.padded, y: best.y.padded }
	}
}

// 'too_many' (an exact grid exists but needs more nodes than the limits allow) | 'no_common_spacing' (no regular grid holds them all) | ''
export function inexactWhy(grid) {
	if (!grid || !grid.ok || grid.exact) return ''
	return grid.exactNeeds ? 'too_many' : 'no_common_spacing'
}

// the run inputs for a derived grid (the shape lib/mesh-grid.js probeParams reads): region and counts are the grid's, nothing else changes
export function effectiveInputs(inputs, grid) {
	if (!grid || !grid.ok) return inputs
	return Object.assign({}, inputs, { mode: 'region', nx: grid.nx, ny: grid.ny, region: Object.assign({}, grid.region) })
}

// the points a grid of the current plan would give as chosen points (every node), so the person can take some away: [{x, y}]
export function seedFromNodes(nodes, max) {
	const cap = max || GRID_LIMITS.maxChosen
	return nodes.slice(0, cap).map(n => ({ x: n.x, y: n.y }))
}
