'use strict'

// Resizing the mesh area from the editor, in every mode. Pure.
//   editField      one typed number (X min, X max, Y min, Y max) -> the new region and WHY it was changed when it was (never silently)
//   reachNote      the part of a region the run will not measure (beyond the probe reach), as a reason code
//   boundsOf / scalePoints   the Points mode: the chosen points follow the region (linear map from the old region to the new one)

import { MIN_SIZE } from './bed-region.js'

const FIELDS = ['xmin', 'xmax', 'ymin', 'ymax']
const round = v => Math.round(v * 10) / 10

export const REGION_FIELDS = FIELDS
export const RESIZE_REASONS = ['invalid', 'beyond_bed', 'too_small', 'beyond_reach'] // texts bed.resize_<code>

// field: 'xmin' | 'xmax' | 'ymin' | 'ymax'; value: a number or a numeric string. -> {region, reason, ok}
//   reason: '' | 'invalid' (not a number: nothing changes) | 'beyond_bed' (kept inside the travel) | 'too_small' (kept MIN_SIZE wide)
export function editField(region, field, value, bed) {
	if (!region || FIELDS.indexOf(field) < 0) return { region, reason: 'invalid', ok: false }
	const v = typeof value === 'string' && value.trim() !== '' ? Number(value.replace(',', '.')) : value
	if (typeof v !== 'number' || !isFinite(v)) return { region, reason: 'invalid', ok: false }
	const r = Object.assign({}, region)
	const axis = field.slice(0, 1)
	const lo = bed ? bed[axis + 'min'] : -Infinity
	const hi = bed ? bed[axis + 'max'] : Infinity
	let reason = ''
	let x = v
	if (x < lo) { x = lo; reason = 'beyond_bed' } else if (x > hi) { x = hi; reason = 'beyond_bed' }
	const isMin = field.slice(1) === 'min'
	const other = r[axis + (isMin ? 'max' : 'min')]
	if (isMin && x > other - MIN_SIZE) { x = other - MIN_SIZE; reason = 'too_small' }
	if (!isMin && x < other + MIN_SIZE) { x = other + MIN_SIZE; reason = 'too_small' }
	if (bed && (x < lo || x > hi)) return { region, reason: 'too_small', ok: false } // no room for MIN_SIZE on that side of the bed
	r[field] = round(x)
	return { region: r, reason, ok: true }
}

// '' when the whole region lies inside `area` (what a run accepts); else the code of the side(s): 'beyond_reach'
export function reachNote(region, area) {
	if (!region || !area) return ''
	const eps = 0.05
	return region.xmin < area.xmin - eps || region.xmax > area.xmax + eps || region.ymin < area.ymin - eps || region.ymax > area.ymax + eps ? 'beyond_reach' : ''
}

export function boundsOf(points) {
	if (!points || !points.length) return null
	const xs = points.map(p => p.x)
	const ys = points.map(p => p.y)
	return { xmin: Math.min(...xs), xmax: Math.max(...xs), ymin: Math.min(...ys), ymax: Math.max(...ys) }
}

function mapAxis(v, a0, a1, b0, b1) {
	return a1 - a0 > 1e-9 ? b0 + ((v - a0) * (b1 - b0)) / (a1 - a0) : (b0 + b1) / 2 // a single column / row goes to the middle of the new span
}

// Where each point goes when the region `from` becomes `to`. Same order, same count; rounded to 0.1 mm (the point edit state does the same)
// and kept inside `area` when one is given (what the run accepts).
export function scalePoints(points, from, to, area) {
	return points.map(p => {
		let x = mapAxis(p.x, from.xmin, from.xmax, to.xmin, to.xmax)
		let y = mapAxis(p.y, from.ymin, from.ymax, to.ymin, to.ymax)
		if (area) {
			x = Math.min(area.xmax, Math.max(area.xmin, x))
			y = Math.min(area.ymax, Math.max(area.ymin, y))
		}
		return { x: round(x), y: round(y) }
	})
}
