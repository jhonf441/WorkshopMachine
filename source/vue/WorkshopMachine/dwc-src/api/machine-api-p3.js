'use strict'

// Phase 3 part of the Machine api (steps/mm, squareness, backlash, motion parameters, input shaping, trial with auto-revert). Like
// machine-api.js and machine-api-p2.js, this is the ONLY place that knows the operation names, the argument names and the shape of the
// answers of these operations; the rest of the plugin works with the normalized values returned here.
//
// Contract: WorkshopService docs/MACHINE-PHASE3-CONTRACT.md (branch m3-service, commit b90c78f, "draft"). Not run against a real machine.
// ASSUMED (marked ASSUMED below, nothing else is):
//   - machine.try.pending answers {pending: [trial]} (contract addendum). The page also keeps the last trial in the browser (state/try-flow.js `store`) and keeps/reverts it by its try_id.
//   - machine.calc answers its plan as {kind, values} for every calc (documented), and the result fields named in the contract; the
//     warnings are codes (the plugin has a text for each).
//   - machine.shaping.test: the keys of `params` and `notes` are only shown, never interpreted.
//   - run `shaping.tune` takes {axis, accelerometer} (the other params have service defaults) and answers the result of the contract.

import { OPS2, normalizePlan } from './machine-api-p2.js'

export const OPS3 = {
	calc: 'machine.calc',
	motionGet: 'machine.motion.get',
	shapingGet: 'machine.shaping.get',
	shapingTest: 'machine.shaping.test',
	try: 'machine.try',
	tryPending: 'machine.try.pending',
	configPlan: OPS2.configPlan
}

export const RUN_KINDS3 = { shapingTune: 'shaping.tune' }
export const CALCS = ['steps', 'skew', 'backlash', 'ringing']

// plan kinds -> gcode_kind of the trial (the closed list of machine.try)
export const TRY_KINDS = {
	'config.m92': 'M92', 'config.m906': 'M906', 'config.m913': 'M913', 'config.m917': 'M917', 'config.m203': 'M203', 'config.m201': 'M201',
	'config.m205': 'M205', 'config.m566': 'M566', 'config.m593': 'M593', 'config.m425': 'M425', 'config.m556': 'M556'
}

export const TRY_SECONDS = { min: 5, max: 600, default: 60 }

function obj(v) {
	return v && typeof v === 'object' && !Array.isArray(v) ? v : {}
}

function num(v) {
	return typeof v === 'number' && isFinite(v) ? v : null
}

function list(v) {
	return Array.isArray(v) ? v : []
}

// ---- motion parameters (machine.motion.get) ----

function normalizeRow(raw) {
	const r = obj(raw)
	return {
		kind: r.kind === 'extruder' ? 'extruder' : 'axis', index: num(r.index), letter: String(r.letter || ''), drivers: list(r.drivers).map(String),
		stepsPerMm: num(r.steps_per_mm), microstepping: num(r.microstepping), interpolated: r.interpolated === true, current: num(r.current_ma),
		currentPercent: num(r.current_percent), standstillPercent: num(r.standstill_percent), speed: num(r.speed), acceleration: num(r.acceleration),
		jerk: num(r.jerk), printingJerk: num(r.printing_jerk), backlash: num(r.backlash),
		mode: r.driver_mode ? String(r.driver_mode) : null, modeSource: r.driver_mode_source || null, direction: num(r.direction), unavailable: list(r.unavailable).map(String)
	}
}

// machine.motion.get -> {rows: [axes, then extruders], idle: {percent, timeoutS}, skew, backlashFactor, limits: {maxCurrent, ceiling}, configRead}
export function normalizeMotion(raw) {
	const r = obj(raw)
	const idle = obj(r.idle)
	const lim = obj(r.limits)
	return {
		rows: list(r.axes).concat(list(r.extruders)).map(normalizeRow).filter(x => x.letter),
		idle: { percent: num(idle.percent), timeoutS: num(idle.timeout_s) }, backlashFactor: num(r.backlash_factor), skew: obj(r.skew),
		limits: { maxCurrent: num(lim.max_current_ma), ceiling: num(lim.ceiling_ma) }, configRead: r.config_read !== false
	}
}

// ---- input shaping (machine.shaping.get) ----

// -> {available, current: {type, frequency, damping, minAcceleration}, types, minFrequency, accelerometer: {present, source, count}, definitions, warnings}
export function normalizeShaping(raw) {
	const r = obj(raw)
	const c = obj(r.current)
	const a = obj(r.accelerometer)
	return {
		available: r.available === true,
		current: { type: c.type ? String(c.type).toLowerCase() : null, frequency: num(c.frequency), damping: num(c.damping), minAcceleration: num(c.min_acceleration) },
		types: list(r.types).map(String), minFrequency: num(r.min_frequency_hz),
		accelerometer: { present: a.present === true, source: a.source || null, count: num(a.count) || 0 },
		definitions: list(r.definitions).map(d => ({ file: String(obj(d).file || ''), line: num(obj(d).line), text: String(obj(d).text || '') })), warnings: list(r.warnings).map(String)
	}
}

// machine.shaping.test -> {gcode, lines, notes}: text only, the service never sends it to the board
export function normalizeTest(raw) {
	const r = obj(raw)
	return { gcode: String(r.gcode || ''), lines: num(r.lines) || 0, notes: list(r.notes).map(String) }
}

// ---- machine.calc ----

// The inputs of the assistants in the page's names -> the values of machine.calc in the service's names
export function calcValues(calc, input) {
	const v = obj(input)
	if (calc === 'steps') {
		const out = { axis: v.axis, commanded: v.commanded, measured: v.measured }
		if (typeof v.old === 'number') out.old = v.old
		return out
	}
	if (calc === 'skew') return { pair: v.pair, side: v.side, diag_sum: v.diagSum, diag_diff: v.diagDiff }
	if (calc === 'backlash') return v.multiplier ? { axis: v.axis, samples: v.samples, multiplier: v.multiplier } : { axis: v.axis, samples: v.samples }
	return { feed: v.feed, ripples: v.ripples, distance: v.distance }
}

// -> {calc, warnings: [code], plan: {kind, values} | null, recordId, result}; `result` keeps the numbers of the calc as the service gave them
export function normalizeCalc(raw) {
	const r = obj(raw)
	const p = obj(r.plan)
	return {
		calc: String(r.calc || ''), warnings: list(r.warnings).map(String), plan: p.kind ? { kind: String(p.kind), values: obj(p.values) } : null,
		recordId: r.record_id || null, result: r
	}
}

// ---- trial (machine.try) ----

// one trial as machine.try answers it
export function normalizeTrial(raw) {
	const t = obj(raw)
	if (!t.try_id) return null
	return {
		id: String(t.try_id), gcodeKind: String(t.gcode_kind || ''), previous: obj(t.previous), applied: obj(t.applied), ts: num(t.ts),
		seconds: num(t.seconds), expiresAt: num(t.expires_at), user: String(t.user || '')
	}
}

// the answer of `keep`: {kept, persist: {kind, values} | null}; `persist` is what machine.config.plan takes to make the trial permanent
export function normalizeKept(raw) {
	const r = obj(raw)
	const p = obj(r.persist)
	return { kept: r.kept !== false, persist: p.kind ? { kind: String(p.kind), values: obj(p.values) } : null }
}

// result of the run `shaping.tune`: the service only COLLECTS the samples, it does not analyse them
export function normalizeTuning(raw) {
	const r = obj(raw)
	return {
		outcome: String(r.outcome || ''), axis: String(r.axis || ''), accelerometer: num(r.accelerometer), samples: num(r.samples), folder: String(r.folder || ''),
		moves: num(r.moves), report: String(r.report || '')
	}
}

export function createPhase3Api(call) {
	return {
		get: async () => normalizeMotion(await call(OPS3.motionGet, {})),
		shaping: async () => normalizeShaping(await call(OPS3.shapingGet, {})),
		// pure arithmetic on the service; nothing is sent to the board. `save` stores a record
		calc: async (name, input, save) => normalizeCalc(await call(OPS3.calc, save ? { calc: name, values: calcValues(name, input), save: true } : { calc: name, values: calcValues(name, input) })),
		// the ringing test G-code (text only)
		test: async options => {
			const o = obj(options)
			const args = {}
			;['axes'].forEach(k => { if (o[k]) args[k] = o[k] })
			;['size', 'feed', 'repeats'].forEach(k => { if (num(o[k]) !== null) args[k] = o[k] })
			if (list(o.accels).length) args.accels = o.accels
			return normalizeTest(await call(OPS3.shapingTest, args))
		},
		// the plan of any phase 3 kind (values already in the service's names); the apply is api.config.apply (phase 2)
		plan: async (kind, values) => normalizePlan(await call(OPS3.configPlan, { kind, values: obj(values) })),
		trial: {
			// the service asks the confirmation itself (confirm_required): api() shows the dialog and repeats the call
			start: async (kind, values, seconds) => normalizeTrial(await call(OPS3.try, { gcode_kind: kind, action: 'start', values: obj(values), seconds })),
			keep: async (kind, id) => normalizeKept(await call(OPS3.try, { gcode_kind: kind, action: 'keep', try_id: id })),
			revert: async (kind, id) => obj(await call(OPS3.try, { gcode_kind: kind, action: 'revert', try_id: id })),
			// machine.try.pending (service addendum of the contract): asked after a reload to find the trial that is waiting
			pending: async () => list(obj(await call(OPS3.tryPending, {})).pending).map(normalizeTrial).filter(t => t)
		}
	}
}
