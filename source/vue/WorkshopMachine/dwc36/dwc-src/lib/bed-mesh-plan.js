'use strict'

// The probe points of a mesh run, computed locally so the drawing is instant (the service answer only confirms or overrides it, see
// state/bed-state.js). Pure. Statuses: 'measure' | 'outside_reach' | 'clipped' | 'unknown'; the reason is a code with a text 'bed.reason_<code>'.
//
// The grid is in PROBE coordinates (M557): the head goes to point - offset, so a point is reachable when that head position is inside
// the axis limits AND the point itself is inside the travel. reachOf() is the service rule (machine_geometry.reach, margin 0):
// x_min = max(xmin + offset_x, xmin), x_max = min(xmax + offset_x, xmax), the same for Y.

export const TRAVEL_MM_S = 100 // estimate of the travel speed between points (a guess; the service estimate wins)
export const POINT_SECONDS = 6 // estimate of one probing cycle: deploy, touch, retract (a guess)
export const MESH_MARGIN = 5 // mm kept from the edge of the reach by mesh.probe (the service default for a mesh)

export function reachOf(bed, offset) {
	if (!bed || !offset) return null
	const r = { xmin: Math.max(bed.xmin + offset.x, bed.xmin), xmax: Math.min(bed.xmax + offset.x, bed.xmax), ymin: Math.max(bed.ymin + offset.y, bed.ymin), ymax: Math.min(bed.ymax + offset.y, bed.ymax) }
	return r.xmax > r.xmin && r.ymax > r.ymin ? r : null
}

export function inside(r, x, y) {
	return !!r && x >= r.xmin - 1e-6 && x <= r.xmax + 1e-6 && y >= r.ymin - 1e-6 && y <= r.ymax + 1e-6
}

// why a point cannot be probed ('' when it can): outside the travel, or the head would leave its limits on X, Y or both (service reasons)
export function outsideReason(x, y, bed, reach) {
	if (bed && !inside(bed, x, y)) return 'outside_bed'
	if (!reach || inside(reach, x, y)) return ''
	const ox = x < reach.xmin - 1e-6 || x > reach.xmax + 1e-6
	const oy = y < reach.ymin - 1e-6 || y > reach.ymax + 1e-6
	return ox && oy ? 'head_outside_xy' : ox ? 'head_outside_x' : 'head_outside_y'
}

export function inset(r, m) {
	const o = { xmin: r.xmin + m, xmax: r.xmax - m, ymin: r.ymin + m, ymax: r.ymax - m }
	return o.xmax > o.xmin && o.ymax > o.ymin ? o : r
}

function axis(lo, hi, n) {
	if (n < 2) return [(lo + hi) / 2]
	const out = []
	for (let k = 0; k < n; k++) out.push(lo + ((hi - lo) * k) / (n - 1))
	return out
}

// the rectangle a mesh run accepts: the probe reach minus the margin (the whole bed while the reach is unknown). `margin` null = the default
export function meshArea(bed, reach, margin) {
	return reach ? inset(reach, margin === null || margin === undefined ? MESH_MARGIN : margin) : bed
}

// serpentine: row by row, alternating direction (what the firmware does), so the travel is short
export function travelOrder(points) {
	const rows = {}
	points.forEach(p => { (rows[p.j] = rows[p.j] || []).push(p) })
	const out = []
	Object.keys(rows).map(Number).sort((a, b) => a - b).forEach((j, k) => {
		const row = rows[j].slice().sort((a, b) => a.i - b.i)
		out.push.apply(out, k % 2 ? row.reverse() : row)
	})
	return out
}

function number(points) {
	let n = 0
	travelOrder(points).forEach(p => { p.order = p.status === 'measure' ? ++n : 0 })
	return points
}

// region {xmin..ymax}, nx, ny, bed, reach -> [{id, i, j, x, y, status, reason, order}]; order is 1.. over the points that WILL be measured
export function planPoints(region, nx, ny, bed, reach, margin) {
	if (!region || !(nx >= 1) || !(ny >= 1)) return []
	const xs = axis(region.xmin, region.xmax, nx)
	const ys = axis(region.ymin, region.ymax, ny)
	const all = []
	ys.forEach((y, j) => xs.forEach((x, i) => {
		let status = 'measure'
		let reason = outsideReason(x, y, bed, reach)
		if (reason) status = 'outside_reach'
		else if (reach && margin > 0 && !inside(inset(reach, margin), x, y)) { status = 'clipped'; reason = 'inside_margin' }
		all.push({ id: 'm' + i + '_' + j, i, j, x, y, status, reason, order: 0 })
	}))
	return number(all)
}

// the service points override the local ones when they describe the same grid (same count, same i / j when the service numbers them);
// never the other way round
export function mergeService(local, service) {
	if (!service || !service.length || service.length !== local.length) return { points: local, source: 'local' }
	const points = local.map((p, k) => {
		const s = service[k]
		if (typeof s.i === 'number' && typeof s.j === 'number' && (s.i !== p.i || s.j !== p.j)) return null
		return Object.assign({}, p, { x: s.x, y: s.y, status: s.status, reason: s.reason })
	})
	return points.indexOf(null) >= 0 ? { points: local, source: 'local' } : { points: number(points), source: 'service' }
}

// the part of the region the run accepts: the region inside the reach minus the margin (null when nothing of it is reachable)
export function acceptedRegion(region, reach, margin) {
	if (!region || !reach) return null
	const a = inset(reach, margin === undefined ? MESH_MARGIN : margin)
	const r = { xmin: Math.max(region.xmin, a.xmin), xmax: Math.min(region.xmax, a.xmax), ymin: Math.max(region.ymin, a.ymin), ymax: Math.min(region.ymax, a.ymax) }
	return r.xmax > r.xmin && r.ymax > r.ymin ? r : null
}

export function pathOf(points) {
	return points.filter(p => p.order > 0).sort((a, b) => a.order - b.order)
}

export function countsOf(points) {
	const c = { measure: 0, outside_reach: 0, clipped: 0, unknown: 0 }
	points.forEach(p => { c[p.status] = (c[p.status] || 0) + 1 })
	return c
}

export function estimateSeconds(points) {
	const path = pathOf(points)
	let mm = 0
	for (let k = 1; k < path.length; k++) mm += Math.hypot(path[k].x - path[k - 1].x, path[k].y - path[k - 1].y)
	return Math.round(mm / TRAVEL_MM_S + path.length * POINT_SECONDS)
}

// the presets of the region (the machine does not report where the last job was, so there is no "around the last job" preset)
export const PRESETS = ['whole', 'centre']
export const REASONS = ['outside_bed', 'head_outside_x', 'head_outside_y', 'head_outside_xy', 'inside_margin', 'no_limits', 'no_probe', 'unsupported_kinematics', 'duplicate_point', 'screw_outside_reach', 'reach_unknown', 'not_probed'] // the reasons that have a text (bed.reason_<code>; any other is shown as 'other')

// presets of the region: 'whole' (all the reachable bed), 'centre' (the middle half of it) -> region | null
export function presetRegion(id, ctx) {
	const area = ctx.reach ? inset(ctx.reach, MESH_MARGIN) : ctx.bed // the run keeps a margin from the edge of the reach
	if (!area) return null
	if (id === 'whole') return Object.assign({}, area)
	if (id === 'centre') {
		const w = (area.xmax - area.xmin) / 4
		const h = (area.ymax - area.ymin) / 4
		return { xmin: area.xmin + w, xmax: area.xmax - w, ymin: area.ymin + h, ymax: area.ymax - h }
	}
	return null
}

// {min, sec} of a duration in seconds, for the text 'bed.estimate'
export function minSec(seconds) {
	const s = Math.max(0, Math.round(seconds))
	return { min: Math.floor(s / 60), sec: s % 60 }
}
