'use strict'

// The number fields of the calibration assistants control themselves: type number, the range on the field (min / max), nothing but a number can be typed
// (blockKey) and a value outside the range marks the field with its own short message. There is no permanent sentence "write numbers greater than zero":
// the text that used to say it (calibration.err_positive and the range ones) is what the service-side checks of the calculation answer, and the fields
// answer it first, so the page only shows the errors that need the OTHER fields (the ratio, the diagonals, the plausibility).

// the keys of lib/*-calc.js that a single field already says by itself
export const FIELD_ERRORS = ['calibration.err_positive', 'calibration.err_commanded', 'calibration.err_side', 'calibration.err_multiplier', 'calibration.err_sample']

export function numberOf(v) {
	const s = String(v === undefined || v === null ? '' : v).trim().replace(',', '.')
	if (s === '' || !/^[-+]?(\d+\.?\d*|\.\d+)$/.test(s)) return null
	const n = Number(s)
	return isFinite(n) ? n : null
}

// o = { min, max, positive }: an empty field is not wrong (it is not filled yet); anything typed has to be a number inside the range
export function fieldInvalid(v, o) {
	const s = String(v === undefined || v === null ? '' : v).trim()
	if (s === '') return false
	const n = numberOf(s)
	if (n === null) return true
	const r = o || {}
	if (r.positive && n <= 0) return true
	if (typeof r.min === 'number' && n < r.min) return true
	if (typeof r.max === 'number' && n > r.max) return true
	return false
}

// the key and params of the short message of a field with that range
export function fieldMessage(o) {
	const r = o || {}
	return typeof r.min === 'number' && typeof r.max === 'number' ? { key: 'calibration.field_between', params: { min: r.min, max: r.max } } : { key: 'calibration.field_positive', params: {} }
}

// keys that would make a number field wrong: no minus, no plus, no exponent
export function blockKey(ev) {
	if (ev && (ev.key === '-' || ev.key === '+' || ev.key === 'e' || ev.key === 'E')) ev.preventDefault()
}

// the same for a field that may be negative (a coordinate): only the exponent and the plus sign are blocked
export function blockExponent(ev) {
	if (ev && (ev.key === '+' || ev.key === 'e' || ev.key === 'E')) ev.preventDefault()
}

// the most the page sends as a test move (the same limit as the service, machine.test_move)
export const TEST_MOVE_MAX_MM = 200
