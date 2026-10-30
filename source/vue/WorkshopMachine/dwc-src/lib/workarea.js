'use strict'

// Work area: what the Area page decides without touching the browser or the service. Pure; the module draws and calls `api.workarea`
// (api/machine-api-p9.js). The limits are the ones of the service (machine_workarea.py), which is the one that enforces them.

export const KEYS = ['xMin', 'xMax', 'yMin', 'yMax']
// the text of each reason a step cannot run (literal keys: a test sees that they exist and are used); 'working' is the state's own
export const BLOCK_TEXT = {
	loading: 'workarea.block_loading', macro_missing: 'workarea.block_macro_missing', not_homed: 'workarea.block_not_homed',
	no_area: 'workarea.block_no_area', not_edited: 'workarea.block_not_edited', working: 'workarea.block_working'
}

export function round2(v) {
	return Math.round(v * 100) / 100
}

// the text boxes of a rectangle ('' while the mode has no area)
export function draftOf(rect) {
	const d = {}
	KEYS.forEach(k => { d[k] = rect ? String(round2(rect[k])) : '' })
	return d
}

// the draft -> {ok, rect} or {ok: false, errorKey}: four finite numbers (a comma is read as a decimal point)
export function parseDraft(draft) {
	const rect = {}
	for (const k of KEYS) {
		const text = String((draft && draft[k]) === undefined || (draft && draft[k]) === null ? '' : draft[k]).trim().replace(',', '.')
		const n = text === '' ? NaN : Number(text)
		if (!isFinite(n)) return { ok: false, errorKey: 'workarea.err_numbers' }
		rect[k] = round2(n)
	}
	return { ok: true, rect }
}

// what is wrong with a rectangle: keys of workarea.<key> (the same rules as the service, which refuses it anyway)
export function rectProblems(rect, reach, minMm) {
	const out = []
	if (rect.xMax - rect.xMin < minMm || rect.yMax - rect.yMin < minMm) out.push('workarea.err_small')
	if (reach && (rect.xMin < reach.xMin - 0.001 || rect.xMax > reach.xMax + 0.001 || rect.yMin < reach.yMin - 0.001 || rect.yMax > reach.yMax + 0.001)) out.push('workarea.err_outside')
	return out
}

// two opposite corners, in any order -> the rectangle
export function cornersRect(a, b) {
	return { xMin: round2(Math.min(a.x, b.x)), xMax: round2(Math.max(a.x, b.x)), yMin: round2(Math.min(a.y, b.y)), yMax: round2(Math.max(a.y, b.y)) }
}

export function sameRect(a, b) {
	if (!a || !b) return !a && !b
	return KEYS.every(k => round2(a[k]) === round2(b[k]))
}

// "X 10 to 300, Y 20 to 250 (290 x 230)" pieces for the card of a mode
export function sizeOf(rect) {
	return rect ? { w: round2(rect.xMax - rect.xMin), h: round2(rect.yMax - rect.yMin) } : null
}

// the first reason a step cannot run now ('' = it can): a key of BLOCK_TEXT. `data` is normalizeArea, `mode` the mode being edited
export function blockReason(data, action, mode) {
	if (!data) return 'loading'
	if (!data.macros[action]) return 'macro_missing'
	if ((action === 'goto' || action === 'frame') && !(data.homed.X && data.homed.Y)) return 'not_homed'
	if (action === 'frame') {
		if (data.mode !== mode) return 'not_edited'
		if (!data.areas[mode]) return 'no_area'
	}
	return ''
}

// the sentence of a reason ('' when there is none)
export function blockKey(reason) {
	return BLOCK_TEXT[reason] || ''
}

// ---- the shared bed view (bedview/BedSvg.vue, BedHandles.vue) speaks {xmin, xmax, ymin, ymax}; this page keeps {xMin, xMax, yMin, yMax} ----

export function bedOf(reach) {
	return reach ? { xmin: reach.xMin, xmax: reach.xMax, ymin: reach.yMin, ymax: reach.yMax } : null
}

export function regionOf(rect) {
	return rect ? { xmin: rect.xMin, xmax: rect.xMax, ymin: rect.yMin, ymax: rect.yMax } : null
}

export function rectOfRegion(region) {
	return region ? { xMin: round2(region.xmin), xMax: round2(region.xmax), yMin: round2(region.ymin), yMax: round2(region.ymax) } : null
}

// where the tool is now, in bed coordinates (X and Y of the model), or null while X or Y has no homing; `axes` = move.axes of the DWC model
export function toolPoint(axes) {
	const find = letter => (Array.isArray(axes) ? axes : []).find(a => a && String(a.letter).toUpperCase() === letter)
	const x = find('X'), y = find('Y')
	if (!x || !y || !x.homed || !y.homed) return null
	if (!isFinite(x.machinePosition) || !isFinite(y.machinePosition)) return null
	return { x: round2(x.machinePosition), y: round2(y.machinePosition) }
}
