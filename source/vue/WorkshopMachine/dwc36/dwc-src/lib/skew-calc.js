'use strict'

// Squareness assistant (design 2.6): a square of side L is made, both diagonals are measured and the skew follows from their difference.
// Convention of machine.calc (the service's, "positive = obtuse"): diagSum is the diagonal from the origin corner to the opposite one
// (the X+Y direction), diagDiff the other one; with equal sides  sin(d) = (diagDiff^2 - diagSum^2) / (4 side^2)  and the deviation
// (what M556 takes, over S = side mm) is  side * tan(d). This is the PREVIEW; the plan carries the value machine.calc answers.
// UNVERIFIED on a real machine: which diagonal the firmware calls AC, so the first real test must be repeated after applying. Pure.

import { numOf, round } from './number-input.js'

export const KIND_SKEW = 'config.m556'
export const CALC_SKEW = 'skew'
export const WARN_DEG = 1 // more than this is a mechanical problem to fix first, not to compensate
export const MAX_DEG = 3 // the service refuses more (implausible)
export const SIDE_MIN = 10
export const SIDE_MAX = 1000

// the three pairs of machine.calc, the axes of each and the letter M556 takes for it
export const PAIRS = [
	{ id: 'XY', axes: ['X', 'Y'], letter: 'X' },
	{ id: 'YZ', axes: ['Y', 'Z'], letter: 'Y' },
	{ id: 'ZX', axes: ['Z', 'X'], letter: 'Z' }
]

// the test square: a rectangle and both diagonals, as G-code to show (the tool is the person's choice: pen, laser at low power...)
export function testSquareGcode(pair, side, feed) {
	const p = PAIRS.find(x => x.id === pair)
	const s = numOf(side)
	if (!p || s === null || s <= 0) return ''
	const a = p.axes[0]
	const b = p.axes[1]
	const f = Math.round(numOf(feed) > 0 ? numOf(feed) : 1500)
	// S0: a G1 written here may be run in Laser mode, where S would be the laser power (CLAUDE.md: every new G1 carries S0)
	const g = (x, y) => 'G1 ' + a + round(x) + ' ' + b + round(y) + ' F' + f + ' S0'
	return [
		'; square ' + s + ' mm in ' + a + b + ', then both diagonals (tool down at the start of each line)',
		'G90', 'G1 ' + a + '0 ' + b + '0 F' + f + ' S0', g(s, 0), g(s, s), g(0, s), g(0, 0), g(s, s), g(s, 0), g(0, s)
	].join('\n')
}

// -> {ok, errorKey, tan, deg, deviation, line, formula: {diagSum, diagDiff, side, sin}, bigSkew}
export function skewResult(pair, side, diagSum, diagDiff) {
	const p = PAIRS.find(x => x.id === pair)
	const L = numOf(side)
	const a = numOf(diagSum)
	const b = numOf(diagDiff)
	const none = { ok: false, errorKey: null, tan: null, deg: null, deviation: null, line: '', formula: null, bigSkew: false }
	if (!p) return none
	if (L === null && a === null && b === null) return none
	if (L === null || a === null || b === null || L <= 0 || a <= 0 || b <= 0) return Object.assign(none, { errorKey: 'calibration.err_positive' })
	if (L < SIDE_MIN || L > SIDE_MAX) return Object.assign(none, { errorKey: 'calibration.err_side' })
	const diag = L * Math.SQRT2
	if (Math.abs(a - diag) > L * 0.2 || Math.abs(b - diag) > L * 0.2) return Object.assign(none, { errorKey: 'calibration.err_diagonal' })
	const sin = (b * b - a * a) / (4 * L * L)
	const rad = Math.asin(Math.max(-1, Math.min(1, sin)))
	const deg = rad * 180 / Math.PI
	const tan = Math.tan(rad)
	const deviation = round(L * tan, 4)
	const out = {
		ok: true, errorKey: null, tan: round(tan, 6), deg: round(deg, 4), deviation, bigSkew: Math.abs(deg) > WARN_DEG,
		line: 'M556 S' + round(L, 3) + ' ' + p.letter + deviation, formula: { diagSum: a, diagDiff: b, side: L, sin: round(sin, 6) }
	}
	if (Math.abs(deg) > MAX_DEG) return Object.assign(out, { ok: false, errorKey: 'calibration.err_implausible' })
	return out
}

// the input of machine.calc in the page's names
export function skewInput(pair, side, result) {
	return result && result.ok ? { pair, side: result.formula.side, diagSum: result.formula.diagSum, diagDiff: result.formula.diagDiff } : null
}
