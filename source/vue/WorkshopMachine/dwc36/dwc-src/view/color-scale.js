'use strict'

// Colour scale of the height map: diverging blue (low) - light (centre) - red (high). Pure. Colour is never the only signal: the map also
// prints the values, draws a legend with numbers and outlines the cells out of tolerance (bed-geometry.js).

const LOW = [44, 123, 182]
const MID = [247, 247, 247]
const HIGH = [215, 25, 28]

function mix(a, b, t) {
	return a.map((c, k) => Math.round(c + (b[k] - c) * t))
}

function hex(rgb) {
	return '#' + rgb.map(c => ('0' + c.toString(16)).slice(-2)).join('')
}

// options: {center, symmetric}; center defaults to the middle of [min, max] (use the mean to see the shape, 0 to see the real height)
export function makeScale(min, max, options) {
	const o = options || {}
	const center = typeof o.center === 'number' ? o.center : (min + max) / 2
	let below = center - min
	let above = max - center
	if (o.symmetric) below = above = Math.max(below, above)
	return function colorOf(value) {
		if (typeof value !== 'number' || !isFinite(value)) return null
		if (value >= center) return hex(mix(MID, HIGH, above > 0 ? Math.min(1, (value - center) / above) : 0))
		return hex(mix(MID, LOW, below > 0 ? Math.min(1, (center - value) / below) : 0))
	}
}

// the numbers of the legend: n values from low to high with their colours
export function legendStops(min, max, options, n) {
	const colorOf = makeScale(min, max, options)
	const count = n || 5
	const out = []
	for (let k = 0; k < count; k++) {
		const value = count === 1 ? min : min + ((max - min) * k) / (count - 1)
		out.push({ value, color: colorOf(value) })
	}
	return out
}

// the text colour that reads on that background (WCAG-style luminance)
export function textOn(background) {
	const n = parseInt(background.slice(1), 16)
	const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255
	return lum > 0.55 ? '#111111' : '#ffffff'
}
