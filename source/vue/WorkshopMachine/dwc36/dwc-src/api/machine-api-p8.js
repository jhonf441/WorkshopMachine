'use strict'

// Height calibration of the tool (it was a card of the Workbench). Like the other machine-api*.js, this is the ONLY place that knows the
// operation names, the argument names and the shape of the answers.
//
// WorkshopService docs/api/README.md (machine_height.py):
//   machine.height.get  -> {mode, rev, data: {paper, modes: {Laser|CNC|FFF: {general: {method, setting}, k0, szp}}}, hooks, applied, probes, macros, homed, z, reach, ...}
//   machine.height.save {base_rev, changes} -> {rev, data, applied, apply_reason, hooks}; a changed file answers the error code 'conflict' with `value` and `rev`
//   machine.height.hook -> {added, already, absent, hooks}
//   machine.height.step {action: goto|jog|mark|measure|szp, x?, y?, dz?, paper?, h?, a?} -> {action, measured?, output?}
// Not run against a real machine.

export const OPS8 = {
	get: 'machine.height.get',
	save: 'machine.height.save',
	hook: 'machine.height.hook',
	step: 'machine.height.step'
}

export const HEIGHT_MODES = ['Laser', 'CNC', 'FFF']

function obj(v) {
	return v && typeof v === 'object' && !Array.isArray(v) ? v : {}
}

function num(v) {
	return typeof v === 'number' && isFinite(v) ? v : null
}

function list(v) {
	return Array.isArray(v) ? v : []
}

function recordOf(v, keys) {
	const r = obj(v)
	return keys.every(k => num(r[k]) !== null) ? Object.assign({ date: String(r.date || '') }, ...keys.map(k => ({ [k]: r[k] }))) : null
}

export function normalizeData(raw) {
	const d = obj(raw)
	const modes = {}
	HEIGHT_MODES.forEach(m => {
		const src = obj(obj(d.modes)[m])
		const gen = obj(src.general)
		modes[m] = {
			method: ['bltouch', 'paper', 'szp'].indexOf(gen.method) >= 0 ? gen.method : 'bltouch',
			setting: num(gen.setting) || 0,
			k0: recordOf(src.k0, ['p', 'x', 'y', 'z']),
			szp: recordOf(src.szp, ['s', 'r'])
		}
	})
	return { paper: num(d.paper) === null ? 0.1 : d.paper, modes }
}

export function normalizeHeight(raw) {
	const r = obj(raw)
	const reach = obj(r.reach)
	return {
		mode: HEIGHT_MODES.indexOf(r.mode) >= 0 ? r.mode : null,
		rev: String(r.rev === undefined || r.rev === null ? '0' : r.rev),
		data: normalizeData(r.data),
		hooks: obj(r.hooks),
		applied: !!r.applied,
		probes: list(r.probes).map(p => ({
			index: num(obj(p).index), triggerHeight: num(obj(p).trigger_height), threshold: num(obj(p).threshold), offsetX: num(obj(p).offset_x) || 0, offsetY: num(obj(p).offset_y) || 0
		})),
		macros: obj(r.macros),
		homed: obj(r.homed),
		z: num(r.z),
		reach: num(reach.x_min) === null ? null : { xMin: reach.x_min, xMax: reach.x_max, yMin: reach.y_min, yMax: reach.y_max },
		jogSteps: list(r.jog_steps).filter(n => num(n) !== null)
	}
}

export function createPhase8Api(call) {
	return {
		get: async () => normalizeHeight(await call(OPS8.get, {})),
		// the reply of a save is the new state of what changed; a conflict reaches the caller as an error with code 'conflict'
		save: async (rev, changes) => {
			const r = obj(await call(OPS8.save, { base_rev: rev, changes }))
			return { rev: String(r.rev), data: normalizeData(r.data), applied: !!r.applied, applyReason: String(r.apply_reason || ''), hooks: obj(r.hooks) }
		},
		hook: async () => {
			const r = obj(await call(OPS8.hook, {}))
			return { added: list(r.added), already: list(r.already), absent: list(r.absent), hooks: obj(r.hooks) }
		},
		step: async (action, args) => {
			const r = obj(await call(OPS8.step, Object.assign({ action }, args || {})))
			return { action: String(r.action || action), measured: num(r.measured), output: String(r.output || '') }
		}
	}
}
