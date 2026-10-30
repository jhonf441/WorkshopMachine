'use strict'

// "Does a job fit": a work rectangle against the head limits (the axis limits), the probe reach and the mesh. Pure geometry in machine mm.
// The rectangle is {x, y, w, h}: x, y is the corner with the SMALLEST X and Y. A side is one of the four edges:
//   xmin (left), xmax (right), ymin (low Y), ymax (high Y).
// Each check answers, per side, how far the job goes BEYOND the limit (mm, 0 = inside) so the reason can name the side and the distance.

export const SIDES = ['xmin', 'xmax', 'ymin', 'ymax']
export const CHECKS = ['head', 'reach', 'mesh'] // bed.fit_<check>
export const VERDICTS = ['fits', 'does_not_fit', 'unknown'] // bed.job_verdict_<verdict>
export const STATES = ['ok', 'fail', 'unknown'] // bed.fit_state_<state>
export const UNKNOWN_REASONS = ['no_bed', 'no_reach', 'no_mesh'] // bed.fit_unknown_<reason>
export const JOB_HANDLES = ['move', 'nw', 'ne', 'se', 'sw'] // bed.job_handle_<handle>
export const JOB_FIELDS = ['x', 'y', 'w', 'h'] // bed.job_field_<field>
export const EPS = 0.001

const num = v => {
	const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v
	return typeof n === 'number' && isFinite(n) ? n : null
}

// {x, y, w, h} typed as text or numbers -> a rectangle {xmin..ymax} or null while the numbers are not valid (w and h > 0)
export function jobRect(job) {
	const x = num(job && job.x)
	const y = num(job && job.y)
	const w = num(job && job.w)
	const h = num(job && job.h)
	return x !== null && y !== null && w !== null && h !== null && w > 0 && h > 0 ? { xmin: x, xmax: x + w, ymin: y, ymax: y + h } : null
}

// a first rectangle to drag when the person has typed nothing: the middle third of the area (reach if known, else the bed)
export function defaultJob(area) {
	if (!area) return null
	const w = (area.xmax - area.xmin) / 3
	const h = (area.ymax - area.ymin) / 3
	return jobOfRect({ xmin: area.xmin + w, xmax: area.xmin + 2 * w, ymin: area.ymin + h, ymax: area.ymin + 2 * h })
}

export function jobOfRect(r) {
	const s = v => String(Math.round(v * 10) / 10)
	return { x: s(r.xmin), y: s(r.ymin), w: s(r.xmax - r.xmin), h: s(r.ymax - r.ymin) }
}

// how far the rectangle goes beyond `box` on each side (mm, never negative)
export function overshoot(rect, box) {
	return {
		xmin: Math.max(0, box.xmin - rect.xmin), xmax: Math.max(0, rect.xmax - box.xmax),
		ymin: Math.max(0, box.ymin - rect.ymin), ymax: Math.max(0, rect.ymax - box.ymax)
	}
}

// the share (0..1) of the rectangle that lies inside `box`
export function coveredShare(rect, box) {
	const w = Math.max(0, Math.min(rect.xmax, box.xmax) - Math.max(rect.xmin, box.xmin))
	const h = Math.max(0, Math.min(rect.ymax, box.ymax) - Math.max(rect.ymin, box.ymin))
	return (w * h) / ((rect.xmax - rect.xmin) * (rect.ymax - rect.ymin))
}

// one check: a box that is not known is 'unknown' (never invented), else 'ok' or 'fail' with the sides that fail
function check(id, rect, box, why) {
	if (!box) return { id, state: 'unknown', ok: null, reason: why, sides: null, bad: [], share: null }
	const o = overshoot(rect, box)
	const sides = {}
	SIDES.forEach(s => { sides[s] = { ok: o[s] <= EPS, mm: o[s] } })
	const bad = SIDES.filter(s => !sides[s].ok)
	return { id, state: bad.length ? 'fail' : 'ok', ok: !bad.length, reason: '', sides, bad, share: coveredShare(rect, box) }
}

// ctx: {bed: head limits, reach: probe reach, mesh: {rect, source: 'result' | 'plan'} | null}
// -> {valid, rect, checks: {head, reach, mesh}, verdict: 'fits' | 'does_not_fit' | 'unknown', failing: [check ids], meshSource}
export function fitJob(job, ctx) {
	const rect = jobRect(job)
	if (!rect) return { valid: false, rect: null, checks: null, verdict: 'unknown', failing: [], meshSource: '' }
	const c = ctx || {}
	const checks = {
		head: check('head', rect, c.bed || null, 'no_bed'),
		reach: check('reach', rect, c.reach || null, 'no_reach'),
		mesh: check('mesh', rect, c.mesh ? c.mesh.rect : null, 'no_mesh')
	}
	const list = CHECKS.map(id => checks[id])
	const failing = list.filter(x => x.state === 'fail').map(x => x.id)
	const verdict = failing.length ? 'does_not_fit' : list.every(x => x.state === 'ok') ? 'fits' : 'unknown'
	return { valid: true, rect, checks, verdict, failing, meshSource: c.mesh ? c.mesh.source : '' }
}

// the mesh a job is checked against: the measured one when there is one (its bounds), else the one the plan would measure
export function meshBox(grid, planRegion) {
	if (grid && grid.bounds) return { rect: grid.bounds, source: 'result' }
	return planRegion ? { rect: planRegion, source: 'plan' } : null
}
