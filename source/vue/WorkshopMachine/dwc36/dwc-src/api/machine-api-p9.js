'use strict'

// Work area of each mode (it was a card of the Workbench, Zones > Cut area). Like the other machine-api*.js, this is the ONLY place that knows the
// operation names, the argument names and the shape of the answers.
//
// WorkshopService docs/api/README.md (machine_workarea.py):
//   machine.workarea.get  -> {mode, areas: {Laser|CNC|FFF: {xmin, xmax, ymin, ymax} | null}, edit_modes, min_mm, reach: {xmin, xmax, ymin, ymax} | null,
//                             macros: {release, capture, goto, frame}, file, homed: {X, Y}}
//   machine.workarea.save {mode: Laser | CNC | FFF, rect?, remove?} -> {mode, areas, applied, apply_reason}; a bad rectangle answers `reason` not_numbers | too_small | outside_travel
//   machine.workarea.release            (level 4 confirmation, asked by api()) -> {action}
//   machine.workarea.step {action: capture | goto | frame, x?, y?} -> {action, x?, y?}
// Not run against a real machine.

export const OPS9 = {
	get: 'machine.workarea.get',
	save: 'machine.workarea.save',
	release: 'machine.workarea.release',
	step: 'machine.workarea.step'
}

export const AREA_MODES = ['Laser', 'CNC', 'FFF']

function obj(v) {
	return v && typeof v === 'object' && !Array.isArray(v) ? v : {}
}

function num(v) {
	return typeof v === 'number' && isFinite(v) ? v : null
}

// {xmin, xmax, ymin, ymax} of the service -> {xMin, xMax, yMin, yMax} of the page; null when something is missing
function rectOf(v) {
	const r = obj(v)
	return [r.xmin, r.xmax, r.ymin, r.ymax].every(n => num(n) !== null) ? { xMin: r.xmin, xMax: r.xmax, yMin: r.ymin, yMax: r.ymax } : null
}

function wire(rect) {
	return { xmin: rect.xMin, xmax: rect.xMax, ymin: rect.yMin, ymax: rect.yMax }
}

function areasOf(v) {
	const a = obj(v)
	const out = {}
	AREA_MODES.forEach(m => { out[m] = rectOf(a[m]) })
	return out
}

export function normalizeArea(raw) {
	const r = obj(raw)
	return {
		mode: AREA_MODES.indexOf(r.mode) >= 0 ? r.mode : null,
		areas: areasOf(r.areas),
		editModes: Array.isArray(r.edit_modes) ? r.edit_modes.filter(m => AREA_MODES.indexOf(m) >= 0) : AREA_MODES.slice(),
		minMm: num(r.min_mm) || 10,
		reach: rectOf(r.reach),
		macros: obj(r.macros),
		file: !!r.file,
		homed: { X: !!obj(r.homed).X, Y: !!obj(r.homed).Y }
	}
}

export function createPhase9Api(call) {
	return {
		get: async () => normalizeArea(await call(OPS9.get, {})),
		// rect null removes the area of the mode; a bad rectangle reaches the caller as an error whose body has `reason`
		save: async (mode, rect) => {
			const r = obj(await call(OPS9.save, rect ? { mode, rect: wire(rect) } : { mode, remove: true }))
			return { mode: String(r.mode || mode), areas: areasOf(r.areas), applied: !!r.applied, applyReason: String(r.apply_reason || '') }
		},
		// the service asks for the level 4 confirmation itself (confirm_required): api() shows the dialog and repeats the call
		release: () => call(OPS9.release, {}),
		capture: async () => {
			const r = obj(await call(OPS9.step, { action: 'capture' }))
			return num(r.x) !== null && num(r.y) !== null ? { x: r.x, y: r.y } : null
		},
		goto: (x, y) => call(OPS9.step, { action: 'goto', x, y }),
		frame: () => call(OPS9.step, { action: 'frame' })
	}
}
