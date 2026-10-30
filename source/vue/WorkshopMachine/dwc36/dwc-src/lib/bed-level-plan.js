'use strict'

// Bed levelling on the bed view: where the leadscrews are (M671, as the service reports them), where to measure, which leadscrew each
// point is nearest to, whether the set of points is valid (and why not), and the correction per leadscrew after a pass. Pure.
//
// Sign convention (ASSUMED, like the service answer): a point's `dz` is the height of the bed there relative to the others, positive =
// the bed is HIGHER. A leadscrew whose points are low has to be raised: correction mm > 0 = raise, mm < 0 = lower.

import { inside, outsideReason } from './bed-mesh-plan.js'

export const MIN_POINTS = 3 // three points define a plane; with two leadscrews two points are enough
export const EPS_MM = 0.0005
export const ISSUE_CODES = ['too_few', 'not_measurable', 'collinear', 'screw_uncovered', 'no_probe', 'no_points', 'too_many_points', 'no_limits', 'out_of_reach', 'duplicate_point', 'descent'] // bed.issue_<code>
export const DIRECTIONS = ['raise', 'lower', 'none'] // bed.corr_<direction>

export function nearestScrew(p, screws) {
	let best = null
	let bestD = Infinity
	screws.forEach(s => {
		const d = Math.hypot(s.x - p.x, s.y - p.y)
		if (d < bestD) { best = s; bestD = d }
	})
	return best
}

function toward(p, reach) {
	return { x: Math.min(reach.xmax, Math.max(reach.xmin, p.x)), y: Math.min(reach.ymax, Math.max(reach.ymin, p.y)) }
}

// a point of the set: status from the reach (unknown reach = unknown status, never invented)
export function classify(p, reach) {
	if (!reach) return Object.assign({}, p, { status: 'unknown', reason: 'reach_unknown' })
	const reason = outsideReason(p.x, p.y, null, reach)
	return reason ? Object.assign({}, p, { status: 'outside_reach', reason }) : Object.assign({}, p, { status: 'measure', reason: '' })
}

// one point per leadscrew, over it; a leadscrew the probe cannot reach gets the nearest reachable point and the status 'clipped'
export function suggestPoints(screws, reach) {
	return screws.map(s => {
		const base = { id: 'l' + s.index, x: s.x, y: s.y, status: 'unknown', reason: 'reach_unknown', order: 0 }
		if (!reach) return base
		if (inside(reach, s.x, s.y)) return Object.assign(base, { status: 'measure', reason: '' })
		const c = toward(s, reach)
		return Object.assign(base, { x: c.x, y: c.y, status: 'clipped', reason: 'screw_outside_reach' })
	})
}

// order of measurement: nearest neighbour starting at the front left (a few points: no serpentine needed)
export function orderPoints(points) {
	const left = points.slice().sort((a, b) => a.y - b.y || a.x - b.x)
	const out = []
	let cur = left.shift()
	while (cur) {
		out.push(cur)
		let k = 0
		left.forEach((p, idx) => { if (Math.hypot(p.x - cur.x, p.y - cur.y) < Math.hypot(left[k].x - cur.x, left[k].y - cur.y)) k = idx })
		cur = left.splice(k, 1)[0]
	}
	let n = 0
	out.forEach(p => { p.order = p.status === 'measure' || p.status === 'clipped' ? ++n : 0 })
	return out
}

export function withScrews(points, screws) {
	return points.map(p => Object.assign({}, p, { screw: screws.length ? nearestScrew(p, screws).index : null }))
}

function collinear(pts) {
	if (pts.length < 3) return false
	const a = pts[0]
	let area = 0
	for (let i = 1; i < pts.length - 1; i++) area = Math.max(area, Math.abs((pts[i].x - a.x) * (pts[i + 1].y - a.y) - (pts[i + 1].x - a.x) * (pts[i].y - a.y)) / 2)
	return area < 25 // mm2: the points are on a line (or nearly)
}

// -> {ok, issues: [{code, key, params}]}; the issue keys are 'bed.issue_<code>'
export function validatePoints(points, screws) {
	const issues = []
	const need = screws.length >= 3 ? MIN_POINTS : Math.max(screws.length, 1)
	const usable = points.filter(p => p.status === 'measure' || p.status === 'clipped')
	const bad = points.filter(p => p.status === 'outside_reach' || p.status === 'unknown')
	if (points.length < need) issues.push({ code: 'too_few', params: { need, have: points.length } })
	if (bad.length) issues.push({ code: 'not_measurable', params: { count: bad.length } })
	if (screws.length >= 3 && usable.length >= 3 && collinear(usable)) issues.push({ code: 'collinear', params: {} })
	const covered = {}
	withScrews(points, screws).forEach(p => { covered[p.screw] = true })
	const lone = screws.filter(s => !covered[s.index]).map(s => s.index)
	if (screws.length && lone.length) issues.push({ code: 'screw_uncovered', params: { screws: lone.join(', ') } })
	return { ok: !issues.length, issues: issues.map(i => Object.assign({ key: 'bed.issue_' + i.code }, i)) }
}

// the verdict of the service (machine.layout level.errors + descent), the same shape as validatePoints; it wins over the local one
export function serviceIssues(level, count) {
	const issues = level.errors.map(e => {
		const code = e.code === 'too_few_points' ? 'too_few' : e.code
		const params = { need: level.leadscrewCount === null ? '?' : level.leadscrewCount, have: count, point: e.point === null ? '?' : e.point }
		return { code, key: 'bed.issue_' + (ISSUE_CODES.indexOf(code) >= 0 ? code : 'other'), params }
	})
	if (level.descent.ok === false) issues.push({ code: 'descent', key: 'bed.issue_descent', params: { bound: level.descent.bound, limit: level.descent.limit } })
	return { ok: !issues.length, issues }
}

// correction per leadscrew: the service adjustments of the last pass when it sent them, else an estimate from the point heights
// -> [{motor, mm, direction: 'raise' | 'lower' | 'none', source: 'service' | 'estimate'}]
export function correctionsOf(screws, lastPass, heights) {
	const dir = mm => (mm > EPS_MM ? 'raise' : mm < -EPS_MM ? 'lower' : 'none')
	if (lastPass && lastPass.adjustments && lastPass.adjustments.length) {
		return screws.map(s => {
			const a = lastPass.adjustments.find(x => x.motor === s.index)
			const mm = a ? a.mm : 0
			return { motor: s.index, mm, direction: dir(mm), source: 'service' }
		})
	}
	if (!heights || !heights.length || !screws.length) return []
	const mean = heights.reduce((t, h) => t + h.dz, 0) / heights.length
	return screws.map(s => {
		const mine = heights.filter(h => nearestScrew(h, screws).index === s.index)
		const mm = mine.length ? mean - mine.reduce((t, h) => t + h.dz, 0) / mine.length : 0
		return { motor: s.index, mm, direction: mine.length ? dir(mm) : 'none', source: 'estimate', measured: mine.length > 0 }
	})
}
