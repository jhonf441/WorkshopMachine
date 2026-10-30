'use strict'

// Small formatting helpers shared by the history, report and offsets code. Pure, no locale (the same text on every browser).

function two(n) {
	return (n < 10 ? '0' : '') + n
}

// epoch seconds -> 'YYYY-MM-DD HH:MM' in the browser's time zone; '-' when there is no date
export function formatDate(ts) {
	if (typeof ts !== 'number' || !isFinite(ts)) return '-'
	const d = new Date(ts * 1000)
	return d.getFullYear() + '-' + two(d.getMonth() + 1) + '-' + two(d.getDate()) + ' ' + two(d.getHours()) + ':' + two(d.getMinutes())
}

// 'YYYY-MM-DD' (an <input type=date>) -> epoch seconds of the start of that day, or of its last second when `endOfDay`; null if invalid
export function dayToEpoch(text, endOfDay) {
	const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(text || ''))
	if (!m) return null
	const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0)
	if (d.getMonth() !== Number(m[2]) - 1) return null
	return Math.floor(d.getTime() / 1000) + (endOfDay ? 86399 : 0)
}

// a number for a table: fixed decimals, '-' when it is not a number
export function formatNumber(v, decimals) {
	return typeof v === 'number' && isFinite(v) ? (Math.abs(v) < Math.pow(10, -(decimals === undefined ? 3 : decimals)) / 2 ? 0 : v).toFixed(decimals === undefined ? 3 : decimals) : '-'
}

// a leaf value of a record (number, text, boolean, null) for a table cell
export function formatValue(v) {
	if (v === null || v === undefined) return '-'
	if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(Math.round(v * 10000) / 10000)
	if (typeof v === 'boolean') return v ? 'true' : 'false'
	return String(v)
}
