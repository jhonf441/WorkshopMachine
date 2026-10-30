'use strict'

// Backlash assistant (design 2.6): the person approaches the same point from the two directions and enters both readings (dial gauge
// or any measurement of the position reached). Each row is one sample of lost motion = |reading from + - reading from -| (0 - 2 mm).
// Proposes  M425 <axis><mean> [S<multiplier>]. This is the PREVIEW; the plan carries what machine.calc answers.
// M425 compensates FIXED backlash (play in couplings, nuts, pulleys); it does not fix belt stretch, which changes with speed and load.
// The scatter rule is the service's: stdev above 35 % of the mean, or range above half of it. Pure.

import { numOf, round } from './number-input.js'

export const KIND_BACKLASH = 'config.m425'
export const CALC_BACKLASH = 'backlash'
export const SAMPLE_MAX = 2 // mm per sample; the service refuses more
export const SAMPLES_MAX = 20
export const BIG_BACKLASH = 0.5 // mm: above this the service warns (big_backlash)
export const STDEV_RATIO = 0.35
export const RANGE_RATIO = 0.5
export const MULTIPLIER = { min: 1, max: 100 }

export function emptyEntry() {
	return { plus: '', minus: '' }
}

function stdev(values, mean) {
	return Math.sqrt(values.reduce((s, v) => s + (v - mean) * (v - mean), 0) / values.length)
}

// -> {ok, errorKey, n, mean, stdev, min, max, inconsistent, big, zero, line, values: [mm]}
export function backlashResult(axis, entries, multiplier) {
	const none = { ok: false, errorKey: null, n: 0, mean: null, stdev: null, min: null, max: null, inconsistent: false, big: false, zero: false, line: '', values: [] }
	const rows = (entries || []).map(e => ({ p: numOf(e && e.plus), m: numOf(e && e.minus), any: !!e && (String(e.plus).trim() !== '' || String(e.minus).trim() !== '') }))
	if (rows.some(r => r.any && (r.p === null || r.m === null))) return Object.assign(none, { errorKey: 'calibration.err_entry' })
	const values = rows.filter(r => r.p !== null && r.m !== null).map(r => Math.abs(r.p - r.m))
	if (!values.length) return none
	if (values.length > SAMPLES_MAX || values.some(v => v > SAMPLE_MAX)) return Object.assign(none, { errorKey: 'calibration.err_sample' })
	const mult = numOf(multiplier)
	if (String(multiplier === undefined || multiplier === null ? '' : multiplier).trim() !== '' && (mult === null || mult < MULTIPLIER.min || mult > MULTIPLIER.max)) {
		return Object.assign(none, { errorKey: 'calibration.err_multiplier' })
	}
	const mean = values.reduce((s, v) => s + v, 0) / values.length
	const sd = stdev(values, mean)
	const min = Math.min.apply(null, values)
	const max = Math.max.apply(null, values)
	const proposal = round(mean, 3)
	return {
		ok: true, errorKey: null, n: values.length, mean: proposal, stdev: round(sd, 4), min: round(min, 4), max: round(max, 4),
		inconsistent: values.length > 1 && (sd > mean * STDEV_RATIO || max - min > mean * RANGE_RATIO), big: mean > BIG_BACKLASH, zero: proposal === 0,
		line: 'M425 ' + axis + proposal + (mult !== null ? ' S' + mult : ''), values: values.map(v => round(v, 4))
	}
}

// the input of machine.calc in the page's names: the samples are the lost motions in mm
export function backlashInput(axis, result, multiplier) {
	if (!result || !result.ok) return null
	const m = numOf(multiplier)
	return m !== null ? { axis, samples: result.values, multiplier: m } : { axis, samples: result.values }
}
