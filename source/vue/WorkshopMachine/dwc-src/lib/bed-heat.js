'use strict'

// The measured heights of a mesh drawn on the same points as the plan (a heat map), and the comparison with the previous mesh. Pure.
// The grid is the one of lib/mesh-grid.js normalizeGrid (xs, ys, z[j][i], null = not probed).

import { makeScale, legendStops } from '../view/color-scale.js'
import { gridStats } from './mesh-grid.js'

export const COMPARE_REASONS = ['no_previous', 'grid_differs']

// every node of the grid as a point: status 'measured' with its height, or 'missing'
export function heatNodes(grid) {
	const out = []
	if (!grid) return out
	grid.ys.forEach((y, j) => grid.xs.forEach((x, i) => {
		const z = grid.z[j][i]
		out.push({ id: 'h' + i + '_' + j, i, j, x, y, z, status: z === null ? 'missing' : 'measured', reason: z === null ? 'not_probed' : '', order: 0 })
	}))
	return out
}

// colour scale of a grid: centre on the mean (the shape) or on 0 (the real height); symmetric makes low and high equally strong
export function heatScale(grid, options) {
	const stats = grid ? gridStats(grid) : null
	if (!stats || !stats.n) return null
	const center = options && options.center === 'zero' ? 0 : stats.mean
	const span = Math.max(Math.abs(stats.max - center), Math.abs(stats.min - center))
	const symmetric = !!(options && options.symmetric)
	const lo = symmetric ? center - span : Math.min(stats.min, center)
	const hi = symmetric ? center + span : Math.max(stats.max, center)
	const o = { center, symmetric }
	return { colorOf: makeScale(lo, hi, o), stops: legendStops(lo, hi, o, 5), lo, hi, center, stats }
}

function sameAxis(a, b) {
	return a.length === b.length && a.every((v, k) => Math.abs(v - b[k]) < 0.01)
}

// current - previous on the same points: {ok, diff (a grid), stats} or {ok: false, reason}
export function compareGrids(cur, prev) {
	if (!cur || !prev) return { ok: false, reason: 'no_previous' }
	if (!sameAxis(cur.xs, prev.xs) || !sameAxis(cur.ys, prev.ys)) return { ok: false, reason: 'grid_differs' }
	const z = cur.z.map((row, j) => row.map((v, i) => (v === null || prev.z[j][i] === null ? null : v - prev.z[j][i])))
	const diff = Object.assign({}, cur, { z, id: 'diff', name: 'diff' })
	return { ok: true, diff, stats: gridStats(diff) }
}

// the detail of one node for the side panel: its height, its distance from the mean and, when there is one, the change from the previous mesh
export function nodeDetail(node, grid, previous) {
	if (!node || !grid) return null
	const stats = gridStats(grid)
	const prev = previous && previous.z[node.j] && typeof previous.z[node.j][node.i] === 'number' ? previous.z[node.j][node.i] : null
	return {
		z: node.z, fromMean: node.z === null || stats.mean === null ? null : node.z - stats.mean,
		change: node.z === null || prev === null ? null : node.z - prev
	}
}
