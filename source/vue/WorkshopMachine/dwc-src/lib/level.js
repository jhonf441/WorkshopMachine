'use strict'

// Level module logic (design 2.3): which detection mode the machine is in (from the capabilities the service discovered), which runs are
// offered, the parameters and the per-pass table. Pure.
//
// Modes (capabilities.levelling.mode, shown in machine.overview ready.levelling_mode):
//   leadscrews   M671 has as many entries as Z motors      -> G32 and G30 corrections and measure-only
//   missingM671  several Z motors but no M671 matching     -> measure only (the M671 assistant arrives in a later phase)
//   singleZ      one Z motor                                -> measure only (a tilt cannot be corrected)
//   noZ / unsupported / unknown                             -> nothing runs, with the reason
//
// Run kinds: level.g32 (G32 through bed.g), level.g30 (G30 points + correction), level.measure (G30 S-1, nothing corrected).
// Result of a run (ASSUMED until the service implements it):
//   {passes: [{n, deviation_before, deviation_after, mean, corrected}], tolerance, converged, final_deviation, probe}

export const KINDS = ['level.g32', 'level.g30', 'level.measure']
export const MAX_PASSES = { min: 1, max: 10, default: 5 }
export const TOLERANCE = { min: 0.001, max: 1, default: 0.02 }

export const MODES = ['leadscrews', 'missingM671', 'singleZ', 'noZ', 'unsupported', 'unknown']
const OFFERED = {
	leadscrews: ['level.g32', 'level.g30', 'level.measure'],
	missingM671: ['level.measure'],
	singleZ: ['level.measure']
}

// {mode, kinds, reasonKey}: kinds is empty with a reason when nothing can run
export function detect(ready) {
	const mode = (ready && ready.levellingMode) || 'unknown'
	const kinds = OFFERED[mode] || []
	const known = MODES.indexOf(mode) >= 0
	return { mode: known ? mode : 'unknown', modeKey: 'level.mode_' + (known ? mode : 'unknown'), kinds, reasonKey: kinds.length ? null : 'level.reason_' + (known ? mode : 'unknown'), zMotors: (ready && ready.zMotors) || 0 }
}

function numIn(v, lo, hi) {
	const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v
	return typeof n === 'number' && isFinite(n) && n >= lo && n <= hi ? n : null
}

// inputs -> {params, errors, ok}; the profile levelling block ({max_passes, tolerance_mm}) gives the defaults
export function runParams(inputs, profile) {
	const i = inputs || {}
	const p = profile || {}
	const defPasses = numIn(p.max_passes, MAX_PASSES.min, MAX_PASSES.max) || MAX_PASSES.default
	const defTol = numIn(p.tolerance_mm, TOLERANCE.min, TOLERANCE.max) || TOLERANCE.default
	const passes = numIn(i.maxPasses === undefined || i.maxPasses === '' ? defPasses : i.maxPasses, MAX_PASSES.min, MAX_PASSES.max)
	const tol = numIn(i.toleranceMm === undefined || i.toleranceMm === '' ? defTol : i.toleranceMm, TOLERANCE.min, TOLERANCE.max)
	const errors = {}
	if (passes === null || Math.floor(passes) !== passes) errors.maxPasses = 'level.err_passes'
	if (tol === null) errors.toleranceMm = 'level.err_tolerance'
	return { params: { max_passes: passes || defPasses, tolerance_mm: tol || defTol }, errors, ok: !Object.keys(errors).length }
}

export function defaultsOf(profile) {
	const r = runParams({}, profile).params
	return { maxPasses: r.max_passes, toleranceMm: r.tolerance_mm }
}

// the per-pass table: [{n, before, after, mean, improved, corrected, withinTolerance}]
export function passRows(result, tolerance) {
	const passes = result && Array.isArray(result.passes) ? result.passes : []
	const tol = typeof tolerance === 'number' ? tolerance : result && typeof result.tolerance === 'number' ? result.tolerance : null
	return passes.map((p, idx) => {
		// the service sends a pass as {n, kind, before: {deviation, mean}, after: {...}, adjustments} (kind 'setting' = the Z motors were moved)
		const dev = o => (o && typeof o.deviation === 'number' ? o.deviation : null)
		const before = dev(p.before) !== null ? dev(p.before) : typeof p.deviation_before === 'number' ? p.deviation_before : null
		const after = dev(p.after) !== null ? dev(p.after) : typeof p.deviation_after === 'number' ? p.deviation_after : null
		const mean = p.after && typeof p.after.mean === 'number' ? p.after.mean : typeof p.mean === 'number' ? p.mean : null
		return {
			n: typeof p.n === 'number' ? p.n : idx + 1, before, after, mean,
			improved: before !== null && after !== null ? after < before : null, corrected: p.kind === 'setting' || !!p.corrected,
			withinTolerance: after !== null && tol !== null ? after <= tol : null
		}
	})
}

// 'converged' | 'diverging' | 'stalled' | 'unknown' from the rows (the service decides when to stop; this is what the person reads)
export function trendOf(rows, tolerance) {
	const done = rows.filter(r => r.after !== null)
	if (!done.length) return 'unknown'
	const last = done[done.length - 1]
	if (tolerance !== null && tolerance !== undefined && last.after <= tolerance) return 'converged'
	if (done.length >= 2 && last.after > done[done.length - 2].after) return 'diverging'
	if (done.length >= 2 && Math.abs(last.after - done[done.length - 2].after) < 0.0005) return 'stalled'
	return 'unknown'
}

// the summary line under the table
export function summaryOf(result, rows) {
	if (!result) return null
	const tol = typeof result.tolerance === 'number' ? result.tolerance : null
	const last = rows.length ? rows[rows.length - 1] : null
	return {
		passes: rows.length, tolerance: tol, final: typeof result.final_deviation === 'number' ? result.final_deviation : last ? last.after : null,
		trend: result.converged === true || result.outcome === 'converged' ? 'converged' : trendOf(rows, tol)
	}
}
