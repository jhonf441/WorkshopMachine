'use strict'

// Limits module logic (design 2.5): the M208 table per axis, the edit through a plan, and the endstop verification result. Pure.
// The table comes from machine.limits.get (the board's model plus the M208 lines of the configuration); the edit persists as kind config.m208 (admin class: the server enforces it,
// the page only offers it to who workshopCan says may).

export const KIND_LIMITS = 'config.m208'
export const RANGE = 5000 // mm: beyond this a limit is a typing mistake

function numOf(text) {
	if (typeof text === 'number') return isFinite(text) ? text : null
	const s = String(text === undefined || text === null ? '' : text).trim().replace(',', '.')
	return s !== '' && /^[-+]?(\d+\.?\d*|\.\d+)$/.test(s) ? Number(s) : null
}

// machine.limits.get axes (api normalizeLimits) -> [{letter, min, max, homed, position}] of the visible axes that have a numeric range
export function limitRows(axes) {
	return (Array.isArray(axes) ? axes : [])
		.filter(a => a && a.visible !== false && typeof a.letter === 'string' && a.letter && typeof a.min === 'number' && typeof a.max === 'number')
		.map(a => ({ letter: a.letter, min: a.min, max: a.max, homed: a.homed === true ? true : a.homed === false ? false : null, position: typeof a.position === 'number' ? a.position : null }))
}

export function draftOf(rows) {
	const d = {}
	rows.forEach(r => { d[r.letter] = { min: String(r.min), max: String(r.max) } })
	return d
}

// the axes whose draft differs: [{letter, min, max, errorKey}]; errorKey when not a number, outside +-RANGE or min >= max
export function changedLimits(rows, draft) {
	const out = []
	rows.forEach(r => {
		const d = (draft || {})[r.letter] || {}
		const min = numOf(d.min)
		const max = numOf(d.max)
		let errorKey = null
		if (min === null || max === null || Math.abs(min) > RANGE || Math.abs(max) > RANGE) errorKey = 'limits.err_number'
		else if (min >= max) errorKey = 'limits.err_order'
		const changed = min !== r.min || max !== r.max
		if (changed || errorKey) out.push({ letter: r.letter, min, max, errorKey })
	})
	return out
}

export function limitsValid(changes) {
	return changes.length > 0 && changes.every(c => !c.errorKey)
}

// the values of the plan, in the page's own names (api/machine-api-p2.js serviceValues maps them to the service's)
export function planValues(changes) {
	return { limits: changes.filter(c => !c.errorKey).map(c => ({ letter: c.letter, min: c.min, max: c.max })) }
}

// the travel in mm of an axis
export function travel(row) {
	return Math.round((row.max - row.min) * 1000) / 1000
}

// the warnings of machine.limits.get (code + axis) with their text
export const WARNING_CODES = ['bad_limits', 'no_endstop']

export function warningRows(warnings) {
	return (warnings || []).map(w => ({ axis: w.axis, textKey: 'limits.warn_' + (WARNING_CODES.indexOf(w.code) >= 0 ? w.code : 'other'), code: w.code }))
}

// ---- endstop verification (run kind homing.verify; api normalizeVerify) ----

const VIEW = {
	ok: { color: 'success', icon: 'mdi-check-circle' },
	bad: { color: 'error', icon: 'mdi-close-octagon' },
	unknown: { color: 'grey', icon: 'mdi-help-circle-outline' }
}

// the four checks of an axis in the order they are shown; each has its own text limits.check_<id>
export const CHECKS = ['endstopPresent', 'notPressedBefore', 'positionMatches', 'triggeredAfter']

export function verdictOf(row) {
	return row.ok === true ? 'ok' : row.ok === false ? 'bad' : 'unknown'
}

// rows of the result table: [{axis, type, homeAt, declared, position, delta, checks: [{id, verdict, icon, color}], verdict, textKey, icon, color}]
export function verifyRows(result) {
	return ((result && result.axes) || []).map(r => {
		const v = verdictOf(r)
		return Object.assign({
			axis: r.axis, type: r.type, homeAt: r.homeAt, declared: r.declared, position: r.after.position, delta: r.delta, verdict: v, textKey: 'limits.verdict_' + v,
			checks: CHECKS.map(id => {
				const cv = r.checks[id] === true ? 'ok' : r.checks[id] === false ? 'bad' : 'unknown'
				return Object.assign({ id, verdict: cv, textKey: 'limits.check_' + id }, VIEW[cv])
			})
		}, VIEW[v])
	})
}

export function verifySummary(result) {
	const out = { ok: 0, bad: 0, unknown: 0 }
	verifyRows(result).forEach(r => { out[r.verdict]++ })
	return out
}

// 'ok' | 'warn' | 'failed' of the whole run: the text of its verdict
export function outcomeKey(result) {
	return result && result.outcome ? 'limits.outcome_' + result.outcome : null
}
