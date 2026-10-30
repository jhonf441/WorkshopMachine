'use strict'

// The 2D bed view of the Mesh module as a PURE function: renderBed(spec) returns the list of shapes to draw (rect, circle, text) and
// the legend; BedView.vue only paints that list on a canvas. Machine looks at the bed from above: X to the right, Y up (the canvas Y is
// flipped). No 3D here: the DWC Height Map page has it.
//
// spec: {
//   size: {w, h}, pad,
//   bed: {xmin, xmax, ymin, ymax},          the area of the machine (M208), mm
//   grid: normalizeGrid(...) | null,
//   scale: {center: 'mean' | 'zero', symmetric},
//   tolerance: mm | null,                   cells whose deviation from the mean exceeds it are outlined (colour is not the only signal)
//   showValues: bool, region: {xmin..} | null, markers: [{x, y, label}],
//   palette: {bedFill, bedStroke, gridLine, text, region, marker}, hover: {i, j} | null
// }

import { makeScale, legendStops, textOn } from './color-scale.js'
import { gridStats } from '../lib/mesh-grid.js'

export const DEFAULT_PALETTE = { bedFill: '#37474f', bedStroke: '#90a4ae', gridLine: 'rgba(0,0,0,0.25)', text: '#eceff1', region: '#ffb74d', marker: '#212121' }

export const LIGHT_PALETTE = { bedFill: '#eceff1', bedStroke: '#546e7a', gridLine: 'rgba(0,0,0,0.25)', text: '#212121', region: '#e65100', marker: '#212121' }

export function paletteFor(dark) {
	return Object.assign({}, dark ? DEFAULT_PALETTE : LIGHT_PALETTE)
}

// world mm <-> canvas px, aspect kept, the bed centred inside the padding
export function makeTransform(bed, size, pad) {
	const p = pad === undefined ? 24 : pad
	const bw = bed.xmax - bed.xmin
	const bh = bed.ymax - bed.ymin
	const scale = Math.max(0.0001, Math.min((size.w - 2 * p) / bw, (size.h - 2 * p) / bh))
	const ox = (size.w - bw * scale) / 2
	const oy = (size.h - bh * scale) / 2
	return {
		scale,
		toCanvas: (x, y) => ({ x: ox + (x - bed.xmin) * scale, y: size.h - oy - (y - bed.ymin) * scale }),
		toWorld: (cx, cy) => ({ x: bed.xmin + (cx - ox) / scale, y: bed.ymin + (size.h - oy - cy) / scale }),
		rect: { x: ox, y: oy, w: bw * scale, h: bh * scale }
	}
}

// the n + 1 edges of the cells around n node positions (half way between nodes; the outer ones half a step outside, kept in [lo, hi])
export function cellEdges(values, lo, hi) {
	const n = values.length
	if (n === 1) return [lo, hi]
	const edges = [values[0] - (values[1] - values[0]) / 2]
	for (let k = 0; k < n - 1; k++) edges.push((values[k] + values[k + 1]) / 2)
	edges.push(values[n - 1] + (values[n - 1] - values[n - 2]) / 2)
	return edges.map(e => Math.max(lo, Math.min(hi, e)))
}

function scaleOf(stats, options) {
	const center = options && options.center === 'zero' ? 0 : stats.mean
	const span = Math.max(Math.abs(stats.max - center), Math.abs(stats.min - center))
	const symmetric = !!(options && options.symmetric)
	const lo = symmetric ? center - span : Math.min(stats.min, center)
	const hi = symmetric ? center + span : Math.max(stats.max, center)
	const o = { center, symmetric }
	return { colorOf: makeScale(lo, hi, o), legend: legendStops(lo, hi, o, 5), lo, hi, center }
}

// the legend alone (MeshMap shows it next to the canvas): {stops: [{value, color}], min, max, center} or null
export function legendFor(grid, scale) {
	const stats = grid ? gridStats(grid) : null
	if (!stats || !stats.n) return null
	const sc = scaleOf(stats, scale)
	return { stops: sc.legend, min: sc.lo, max: sc.hi, center: sc.center }
}

export function formatMm(v) {
	return (Math.abs(v) < 0.0005 ? 0 : v).toFixed(3)
}

function cellItems(spec, tr, stats, sc, items) {
	const g = spec.grid
	const xe = cellEdges(g.xs, spec.bed.xmin, spec.bed.xmax)
	const ye = cellEdges(g.ys, spec.bed.ymin, spec.bed.ymax)
	const tol = typeof spec.tolerance === 'number' ? spec.tolerance : null
	const pal = spec.palette
	for (let j = 0; j < g.ny; j++) {
		for (let i = 0; i < g.nx; i++) {
			const a = tr.toCanvas(xe[i], ye[j + 1])
			const b = tr.toCanvas(xe[i + 1], ye[j])
			const z = g.z[j][i]
			const fill = z === null ? pal.bedFill : sc.colorOf(z)
			const out = z !== null && tol !== null && Math.abs(z - stats.mean) > tol
			const hover = !!spec.hover && spec.hover.i === i && spec.hover.j === j
			items.push({
				t: 'rect', x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y, fill, stroke: hover ? pal.text : out ? '#000000' : pal.gridLine,
				lineWidth: hover || out ? 2 : 1, dash: out ? [4, 3] : null, cell: { i, j, outOfTolerance: out }
			})
			if (spec.showValues && z !== null && b.x - a.x >= 38 && b.y - a.y >= 18) {
				items.push({ t: 'text', x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, text: formatMm(z), align: 'center', color: textOn(fill), size: 11 })
			}
		}
	}
}

function pointItems(spec, tr, items) {
	const g = spec.grid
	if (g && g.nx * g.ny <= 441) {
		g.xs.forEach(x => g.ys.forEach(y => {
			const c = tr.toCanvas(x, y)
			items.push({ t: 'circle', x: c.x, y: c.y, r: 2.5, fill: spec.palette.marker, stroke: null })
		}))
	}
	;(spec.markers || []).forEach(m => {
		const c = tr.toCanvas(m.x, m.y)
		items.push({ t: 'circle', x: c.x, y: c.y, r: 5, fill: null, stroke: spec.palette.region })
		if (m.label) items.push({ t: 'text', x: c.x + 8, y: c.y - 8, text: m.label, align: 'left', color: spec.palette.text, size: 11 })
	})
}

export function renderBed(spec) {
	const pal = Object.assign({}, DEFAULT_PALETTE, spec.palette || {})
	const full = Object.assign({}, spec, { palette: pal })
	const tr = makeTransform(spec.bed, spec.size, spec.pad)
	const items = [{ t: 'rect', x: tr.rect.x, y: tr.rect.y, w: tr.rect.w, h: tr.rect.h, fill: pal.bedFill, stroke: pal.bedStroke, lineWidth: 2, dash: null }]
	let stats = null
	let legend = null
	if (spec.grid) {
		stats = gridStats(spec.grid)
		if (stats.n) {
			const sc = scaleOf(stats, spec.scale)
			legend = { stops: sc.legend, min: sc.lo, max: sc.hi, center: sc.center }
			cellItems(full, tr, stats, sc, items)
		}
	}
	if (spec.region) {
		const a = tr.toCanvas(spec.region.xmin, spec.region.ymax)
		const b = tr.toCanvas(spec.region.xmax, spec.region.ymin)
		items.push({ t: 'rect', x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y, fill: null, stroke: pal.region, lineWidth: 2, dash: [6, 4] })
	}
	pointItems(full, tr, items)
	items.push({ t: 'text', x: tr.rect.x, y: tr.rect.y + tr.rect.h + 12, text: 'X ' + spec.bed.xmin + ' .. ' + spec.bed.xmax, align: 'left', color: pal.text, size: 11 })
	items.push({ t: 'text', x: tr.rect.x, y: tr.rect.y - 6, text: 'Y ' + spec.bed.ymin + ' .. ' + spec.bed.ymax, align: 'left', color: pal.text, size: 11 })
	return { width: spec.size.w, height: spec.size.h, items, legend, stats, transform: tr }
}

// the cell under a canvas point: {i, j, x, y, z, deviation} or null when the point is outside the cells
export function hitTest(spec, cx, cy) {
	const g = spec.grid
	if (!g) return null
	const tr = makeTransform(spec.bed, spec.size, spec.pad)
	const w = tr.toWorld(cx, cy)
	const xe = cellEdges(g.xs, spec.bed.xmin, spec.bed.xmax)
	const ye = cellEdges(g.ys, spec.bed.ymin, spec.bed.ymax)
	const find = (edges, v) => {
		for (let k = 0; k < edges.length - 1; k++) if (v >= edges[k] && v <= edges[k + 1]) return k
		return -1
	}
	const i = find(xe, w.x)
	const j = find(ye, w.y)
	if (i < 0 || j < 0) return null
	const z = g.z[j][i]
	const mean = gridStats(g).mean
	return { i, j, x: g.xs[i], y: g.ys[j], z, deviation: z === null || mean === null ? null : z - mean }
}
