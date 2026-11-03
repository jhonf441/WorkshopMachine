'use strict'

// Checks of a motion procedure that the machine can answer by itself (the model of DWC), so nobody has to tick them:
// the axes are homed and the probe is there and at rest. Pure: the model in, the answer out (tests/machine-precheck.test.js).
// The checklist of RunStart keeps only what a person can see and the machine cannot (free space, the bed clear, the emergency stop within reach).

export const AUTO_CHECKS = ['homed', 'probe']

// The axes that matter for a procedure with the probe: X, Y and Z (the others, such as extruders, are not axes of motion for it).
export function homedCheck(model) {
	const axes = (model && model.move && model.move.axes) || []
	const xyz = axes.filter(a => a && ['X', 'Y', 'Z'].indexOf(a.letter) >= 0)
	if (!xyz.length) return { ok: false, reason: 'unknown', axes: [] }
	const missing = xyz.filter(a => !a.homed).map(a => a.letter)
	return missing.length ? { ok: false, reason: 'not_homed', axes: missing } : { ok: true, reason: '', axes: xyz.map(a => a.letter) }
}

// The probe `index` exists (type other than 0 = none / manual) and is NOT triggered now (its value is under its threshold).
export function probeCheck(model, index) {
	const i = Number.isInteger(index) && index >= 0 ? index : 0
	const probes = (model && model.sensors && model.sensors.probes) || []
	const p = probes[i]
	if (!p) return { ok: false, reason: 'no_probe', index: i, type: null }
	if (!p.type) return { ok: false, reason: 'manual_probe', index: i, type: p.type }
	const v = Array.isArray(p.value) ? p.value[0] : p.value
	const th = typeof p.threshold === 'number' ? p.threshold : 500
	if (typeof v === 'number' && v >= th) return { ok: false, reason: 'triggered', index: i, type: p.type }
	return { ok: true, reason: '', index: i, type: p.type }
}
