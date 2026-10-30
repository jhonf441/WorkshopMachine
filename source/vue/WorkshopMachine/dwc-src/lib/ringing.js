'use strict'

// The ringing test of the input shaping module. The test G-code comes from the service (machine.shaping.test, text only, never sent to
// the board); this file has the arithmetic of what the person measures afterwards. Pure.
// The person counts `ripples` ripples over `distance` mm of the test part: wavelength = distance / ripples and  f = speed / wavelength.
// The preview here is the same arithmetic as machine.calc "ringing"; the service's answer is the one that fills the form.

import { numOf, round } from './number-input.js'

export const CALC_RINGING = 'ringing'
export const AXES_CHOICES = ['XY', 'X', 'Y']
export const MIN_HZ = 4
export const MAX_HZ = 200
export const RIPPLES = { min: 2, max: 200 }

// -> {ok, errorKey, frequency, wavelength, speed, warnKey}
export function ringingFrequency(feed, ripples, distance) {
	const f = numOf(feed)
	const n = numOf(ripples)
	const d = numOf(distance)
	const none = { ok: false, errorKey: null, frequency: null, wavelength: null, speed: null, warnKey: null }
	if (n === null && d === null) return none
	if (f === null || n === null || d === null || f <= 0 || d <= 0) return Object.assign(none, { errorKey: 'shaping.err_ringing' })
	if (!Number.isInteger(n) || n < RIPPLES.min || n > RIPPLES.max) return Object.assign(none, { errorKey: 'shaping.err_ripples' })
	const wavelength = d / n
	const speed = f / 60
	const hz = round(speed / wavelength, 2)
	return { ok: true, errorKey: null, frequency: hz, wavelength: round(wavelength, 3), speed: round(speed, 3), warnKey: hz < MIN_HZ ? 'calibration.warn_below_minimum' : hz > MAX_HZ ? 'calibration.warn_very_high' : null }
}

export function ringingInput(feed, ripples, distance) {
	const r = ringingFrequency(feed, ripples, distance)
	return r.ok ? { feed: numOf(feed), ripples: numOf(ripples), distance: numOf(distance) } : null
}

// the options of machine.shaping.test from what the form holds (empty / invalid fields are left out: the service has defaults)
export function testOptions(form) {
	const f = form || {}
	const accels = String(f.accels || '').split(/[\s,;]+/).map(numOf).filter(a => a !== null)
	const out = { axes: AXES_CHOICES.indexOf(f.axes) >= 0 ? f.axes : 'XY', accels }
	;['size', 'feed', 'repeats'].forEach(k => { if (numOf(f[k]) !== null) out[k] = numOf(f[k]) })
	return out
}
