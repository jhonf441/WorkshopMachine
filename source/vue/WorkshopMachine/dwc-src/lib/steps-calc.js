'use strict'

// Steps per mm assistant (design 2.6): the person commands a move of a known length, measures what the axis really did and the new
// value is  new = old * commanded / measured.  Pure. This is the PREVIEW (formula and new value shown before anything is sent); the
// number that goes into the plan is the one machine.calc answers, with the same rule (rounded to 3 places).

import { numOf, round } from './number-input.js'

export const KIND_STEPS = 'config.m92'
export const CALC_STEPS = 'steps'
// the service warns outside 0.9 - 1.1 (large_correction) and refuses outside 0.5 - 2 (out_of_range); commanded is 1 - 5000 mm
export const WARN_RATIO = 1.1
export const MAX_RATIO = 2
export const MIN_RATIO = 0.5
export const COMMANDED_MAX = 5000

// the move to command by hand for the test, as G-code to show or copy
export function testMoveGcode(axis, commanded, feed) {
	const d = numOf(commanded)
	if (!axis || d === null || d <= 0) return ''
	const f = numOf(feed)
	return ['G91', 'G1 ' + axis + round(d) + ' F' + (f !== null && f > 0 ? Math.round(f) : 600) + ' S0', 'G90'].join('\n')
}

// -> {ok, errorKey, ratio, next, change, formula: {old, commanded, measured, next}, bigChange}
// `old` is the steps/mm now (number), `commanded` and `measured` what the person typed (mm)
export function stepsResult(old, commanded, measured) {
	const o = typeof old === 'number' && old > 0 ? old : null
	const c = numOf(commanded)
	const m = numOf(measured)
	const none = { ok: false, errorKey: null, ratio: null, next: null, change: null, formula: null, bigChange: false }
	if (o === null) return Object.assign(none, { errorKey: 'calibration.err_no_current' })
	if (c === null && m === null) return none
	if (c === null || m === null || c <= 0 || m <= 0) return Object.assign(none, { errorKey: 'calibration.err_positive' })
	if (c < 1 || c > COMMANDED_MAX) return Object.assign(none, { errorKey: 'calibration.err_commanded' })
	const ratio = c / m
	const next = round(o * ratio)
	const out = {
		ok: true, errorKey: null, ratio: round(ratio, 5), next, change: round(next - o), bigChange: ratio > WARN_RATIO || ratio < 1 / WARN_RATIO,
		formula: { old: o, commanded: c, measured: m, next }
	}
	if (ratio > MAX_RATIO || ratio < MIN_RATIO) return Object.assign(out, { ok: false, errorKey: 'calibration.err_ratio' })
	return out
}

// the input of machine.calc in the page's names (api/machine-api-p3.js calcValues maps them)
export function stepsInput(axis, old, result) {
	return result && result.ok ? { axis, old, commanded: result.formula.commanded, measured: result.formula.measured } : null
}
