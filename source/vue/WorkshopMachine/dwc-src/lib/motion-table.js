'use strict'

// Motion parameters module (design 2.8): the table of the axes and extruders and the edit of ONE parameter at a time through a plan. Pure.
// Rows come from api/machine-api-p3.js normalizeMotion (machine.motion.get: mA, %, mm/min, mm/s2). Every parameter has its own plan kind,
// so the review shows exactly one M-code. "Try now" exists only for the kinds machine.try accepts as a volatile trial. The microstepping is
// shown but not edited here (the service has no plan kind for M350). The driver mode is edited per DRIVER (M569 P0.0), the idle current
// (M906 I/T) is global.

import { numOf } from './number-input.js'

export const DRIVER_MODES = ['spreadcycle', 'stealthchop']
export const CURRENT_CEILING = 6300 // mA: the hard ceiling of the service (machine.motion.get limits.ceiling_ma)

// scope: what a row of the edit is ('axis' | 'driver' | 'idle'); field: key of the table row; kind: plan kind; gcode: M-code of the line and
// of the trial (null = no trial); unit: text key suffix; min/max: accepted range; choices: fixed list
export const PARAMS = [
	{ id: 'current', scope: 'axis', field: 'current', kind: 'config.m906', gcode: 'M906', unit: 'mA', min: 100, max: CURRENT_CEILING },
	{ id: 'idle', scope: 'idle', field: null, kind: 'config.m906', gcode: 'M906', unit: '', min: 0, max: 3600 },
	{ id: 'currentPercent', scope: 'axis', field: 'currentPercent', kind: 'config.m913', gcode: 'M913', unit: 'percent', min: 0, max: 100 },
	{ id: 'standstill', scope: 'axis', field: 'standstillPercent', kind: 'config.m917', gcode: 'M917', unit: 'percent', min: 0, max: 100 },
	{ id: 'speed', scope: 'axis', field: 'speed', kind: 'config.m203', gcode: 'M203', unit: 'mmmin', min: 1, max: 200000 },
	{ id: 'acceleration', scope: 'axis', field: 'acceleration', kind: 'config.m201', gcode: 'M201', unit: 'mms2', min: 1, max: 100000 },
	{ id: 'jerk', scope: 'axis', field: 'jerk', kind: 'config.m566', gcode: 'M566', unit: 'mmmin', min: 0, max: 200000 },
	{ id: 'printingJerk', scope: 'axis', field: 'printingJerk', kind: 'config.m205', gcode: 'M205', unit: 'mms', min: 0, max: 1000 },
	{ id: 'mode', scope: 'driver', field: 'mode', kind: 'config.m569', gcode: null, unit: '', choices: DRIVER_MODES }
]

// the columns of the table, in order (microstepping is read-only)
export const COLUMNS = [
	{ id: 'current', field: 'current' }, { id: 'currentPercent', field: 'currentPercent' }, { id: 'standstill', field: 'standstillPercent' },
	{ id: 'microstepping', field: 'microstepping' }, { id: 'speed', field: 'speed' }, { id: 'acceleration', field: 'acceleration' },
	{ id: 'jerk', field: 'jerk' }, { id: 'printingJerk', field: 'printingJerk' }, { id: 'mode', field: 'mode' }
]

export function paramOf(id) {
	return PARAMS.find(p => p.id === id) || PARAMS[0]
}

// the plan kinds of this module
export const MOTION_KINDS = PARAMS.map(p => p.kind).filter((k, i, a) => a.indexOf(k) === i)

// the table: [{key, letter, kind, driver, drivers, stepsPerMm, current, ..., mode, multiMotor, interpolated}]
export function tableRows(rows) {
	return (Array.isArray(rows) ? rows : []).map(r => Object.assign({}, r, {
		key: r.letter, driver: (r.drivers || []).join(', '), interpolated: r.interpolated === true, multiMotor: (r.drivers || []).length > 1
	}))
}

export function cell(row, field) {
	const v = row[field]
	return v === null || v === undefined ? '-' : typeof v === 'number' ? String(Math.round(v * 1000) / 1000) : String(v)
}

// the accepted range of a parameter: the current is capped by the profile's limit (limits.maxCurrent) and never above the ceiling
export function rangeOf(paramId, limits) {
	const p = paramOf(paramId)
	if (p.choices) return null
	const cap = limits && typeof limits.maxCurrent === 'number' ? Math.min(limits.maxCurrent, limits.ceiling || CURRENT_CEILING) : CURRENT_CEILING
	return { min: p.min, max: p.id === 'current' ? cap : p.max }
}

// the rows the edit of a parameter shows: [{key, label | labelKey, before}] (what the person sees: axis letter, driver, or the text of the idle field)
export function editRows(rows, paramId, idle) {
	const p = paramOf(paramId)
	if (p.scope === 'idle') {
		return [
			{ key: 'idle_percent', labelKey: 'motion.idle_percent', before: idle ? idle.percent : null, min: 0, max: 100 },
			{ key: 'idle_timeout', labelKey: 'motion.idle_timeout', before: idle ? idle.timeoutS : null, min: 1, max: 3600 }
		]
	}
	if (p.scope === 'driver') {
		const out = []
		rows.forEach(r => (r.drivers || []).forEach(d => out.push({ key: d, label: r.letter + ' ' + d, before: r.mode })))
		return out
	}
	return rows.filter(r => typeof r[p.field] === 'number').map(r => ({ key: r.key, label: r.letter, before: r[p.field] }))
}

// the draft of a parameter: {X: '800'} with the current value of every row that has one
// (a choice the board reports that the page cannot set, e.g. a driver mode "other", has no field: it would be an error nobody caused)
export function draftOf(edit, paramId) {
	const p = paramOf(paramId)
	const d = {}
	edit.forEach(r => {
		if (r.before === null || r.before === undefined) return
		if (p.choices && p.choices.indexOf(r.before) < 0) return
		d[r.key] = String(r.before)
	})
	return d
}

function valueOf(p, text) {
	return p.choices ? (p.choices.indexOf(text) >= 0 ? text : null) : numOf(text)
}

// -> [{key, value, before, errorKey, range}] of the rows whose draft differs from the table
export function changes(edit, paramId, draft, limits) {
	const p = paramOf(paramId)
	const out = []
	edit.forEach(r => {
		if (!(r.key in (draft || {}))) return
		const value = valueOf(p, (draft || {})[r.key])
		const range = typeof r.min === 'number' ? { min: r.min, max: r.max } : rangeOf(paramId, limits) // a row may carry its own range (the idle fields)
		let errorKey = null
		if (value === null) errorKey = p.choices ? 'motion.err_choice' : 'motion.err_number'
		else if (range && (value < range.min || value > range.max)) errorKey = 'motion.err_range'
		if (errorKey || value !== r.before) out.push({ key: r.key, value, before: r.before === undefined ? null : r.before, errorKey, range })
	})
	return out
}

export function valid(list) {
	return list.length > 0 && list.every(c => !c.errorKey)
}

// the values of the plan (and of the trial: the same shape) in the service's names
export function planValues(paramId, list) {
	const p = paramOf(paramId)
	const ok = list.filter(c => !c.errorKey)
	if (p.scope === 'idle') {
		const out = {}
		ok.forEach(c => { out[c.key] = c.value })
		return out
	}
	if (p.scope === 'driver') {
		const drivers = {}
		ok.forEach(c => { drivers[c.key] = { mode: c.value } })
		return { drivers }
	}
	const axes = {}
	ok.forEach(c => { axes[c.key] = c.value })
	return { axes }
}

// the line "try now" would apply: shown before it is sent, e.g. "M906 X800 Y800" or "M906 I30 T30"
export function previewLine(paramId, list) {
	const p = paramOf(paramId)
	if (!p.gcode) return ''
	const ok = list.filter(c => !c.errorKey)
	if (p.scope === 'idle') return [p.gcode].concat(ok.map(c => (c.key === 'idle_percent' ? 'I' : 'T') + c.value)).join(' ')
	return [p.gcode].concat(ok.map(c => c.key + c.value)).join(' ')
}
