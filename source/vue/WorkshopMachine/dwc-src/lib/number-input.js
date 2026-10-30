'use strict'

// Parsing of what a person types into a number field (comma or dot as decimal separator). Pure.

// a finite number, or null when the text is empty or not a number
export function numOf(text) {
	if (typeof text === 'number') return isFinite(text) ? text : null
	const s = String(text === undefined || text === null ? '' : text).trim().replace(',', '.')
	return s !== '' && /^[-+]?(\d+\.?\d*|\.\d+)$/.test(s) ? Number(s) : null
}

// round to `decimals` places (default 3)
export function round(v, decimals) {
	const f = Math.pow(10, decimals === undefined ? 3 : decimals)
	return Math.round(v * f) / f
}
