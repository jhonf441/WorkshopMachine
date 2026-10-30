'use strict'

// Phase 2 part of the Machine api (history, restore, report, limits, offsets, laser <-> pointer, configuration plans). Like
// machine-api.js, this is the ONLY place that knows the operation names, the argument names and the shape of the answers of these
// operations; the rest of the plugin works with the normalized values returned here.
//
// Contract: WorkshopService docs/MACHINE-PHASE2-CONTRACT.md (branch m2-service, commit bc2a64e). Not run against a real machine.
// ASSUMED (marked ASSUMED below, nothing else is):
//   - capabilities.get {capabilities: {laser: {present}}}: used to show the laser <-> pointer assistant (profile.secondary_tool_pair
//     comes in machine.state profile; it is read by normalizeState in machine-api.js).
//   - the answer of a `machine.run` of kind safety.check / homing.verify is followed with machine.runs: the module reads run.result.
//   - MeshFigure / MeshDiff `grid` is {min0, max0, min1, max1, num0, num1}, the same grid object as machine.mesh.get.

export const OPS2 = {
	historyList: 'machine.history.list',
	historyGet: 'machine.history.get',
	historyCompare: 'machine.history.compare',
	historyRestore: 'machine.history.restore',
	report: 'machine.report',
	limitsGet: 'machine.limits.get',
	offsetsGet: 'machine.offsets.get',
	offsetsSnapshot: 'machine.offsets.snapshot',
	markCross: 'machine.mark_cross',
	capabilities: 'capabilities.get',
	configPlan: 'machine.config.plan',
	configApply: 'machine.config.apply'
}

export const RUN_KINDS2 = { homingVerify: 'homing.verify', safetyCheck: 'safety.check' }

function obj(v) {
	return v && typeof v === 'object' && !Array.isArray(v) ? v : {}
}

function num(v) {
	return typeof v === 'number' && isFinite(v) ? v : null
}

function list(v) {
	return Array.isArray(v) ? v : []
}

function text(v) {
	return v === null || v === undefined ? '' : String(v)
}

// ---- records ----

// a row of the history list (Brief)
export function normalizeBrief(raw) {
	const r = obj(raw)
	return {
		id: text(r.id), kind: text(r.kind), ts: num(r.ts), user: text(r.user), role: text(r.role), device: text(r.device), state: text(r.state) || 'done',
		runId: r.run_id || null, notes: text(r.notes), outcome: r.outcome === undefined ? null : r.outcome, light: r.light || null,
		applied: !!r.applied, restorable: !!r.restorable
	}
}

// one record, complete (schema 1)
export function normalizeRecord(raw) {
	const r = obj(raw)
	const files = r.applied && typeof r.applied === 'object' ? list(r.applied.files).map(f => ({
		path: text(obj(f).path), shaBefore: obj(f).sha_before || null, shaAfter: obj(f).sha_after || null, snapshotId: obj(f).snapshot_id || null
	})) : null
	const m = obj(r.machine)
	return {
		id: text(r.id), kind: text(r.kind), ts: num(r.ts), user: text(r.user), role: text(r.role), device: text(r.device), runId: r.run_id || null,
		state: text(r.state) || 'done', notes: text(r.notes), inputs: obj(r.inputs), results: obj(r.results), applied: files,
		machine: { name: text(m.name), board: m.board || null, firmware: m.firmware || null, kinematics: m.kinematics || null }
	}
}

export function normalizeFileStates(raw) {
	return list(raw).map(f => ({ path: text(obj(f).path), shaNow: obj(f).sha_now || null, shaBefore: obj(f).sha_before || null, shaAfter: obj(f).sha_after || null, state: text(obj(f).state) || 'clean' }))
}

// what restoring a record needs: {restorable, reason, which: ['before'|'after'], roleNeeded, files}
export function normalizeRestoreInfo(raw) {
	const r = obj(raw)
	return { restorable: !!r.restorable, reason: r.reason || null, which: list(r.which).map(String), roleNeeded: text(r.role_needed) || 'technician', files: normalizeFileStates(r.files) }
}

// ---- comparison ----

export function normalizeDiff(raw) {
	const d = obj(raw)
	return {
		rows: list(d.rows).map(r => ({ key: text(obj(r).key), a: obj(r).a === undefined ? null : obj(r).a, b: obj(r).b === undefined ? null : obj(r).b, delta: num(obj(r).delta), changed: !!obj(r).changed })),
		changed: num(d.changed) || 0, cut: !!d.cut
	}
}

// a height map of the service (MeshFigure or the grid of a MeshDiff) in the shape lib/mesh-grid.js normalizeGrid takes. grid ASSUMED as machine.mesh.get.
export function figureToGrid(raw, name) {
	const f = obj(raw)
	const g = obj(f.grid)
	if (!f.grid || !Array.isArray(f.rows)) return null
	return { id: text(f.id) || 'figure', name: name || text(f.id), x: { min: g.min0, max: g.max0, n: g.num0 }, y: { min: g.min1, max: g.max1, n: g.num1 }, z: f.rows }
}

export function normalizeMeshDiff(raw) {
	if (!raw || typeof raw !== 'object') return null
	const m = obj(raw)
	return { ok: m.ok === true, reason: m.reason || null, ids: list(m.ids).map(text), grid: m.ok === true ? figureToGrid(m, 'B - A') : null, stats: obj(m.stats) }
}

export function normalizeCompare(raw) {
	const c = obj(raw)
	return { kind: text(c.kind), a: normalizeBrief(c.a), b: normalizeBrief(c.b), results: normalizeDiff(c.results), inputs: normalizeDiff(c.inputs), mesh: normalizeMeshDiff(c.mesh) }
}

// ---- plans ----

// a plan as machine.config.plan answers it, also the plan machine.history.restore builds (with `restore`)
export function normalizePlan(raw) {
	const p = obj(raw)
	const r = obj(p.restore)
	return {
		id: text(p.plan_id), kind: text(p.kind), roleNeeded: text(p.role_needed) || 'technician', expires: num(p.expires),
		warnings: list(p.warnings), canApplyNow: !!p.can_apply_now, line: p.line || null,
		files: list(p.files).map(f => ({
			path: text(obj(f).path), changed: obj(f).changed !== false, exists: obj(f).exists !== false,
			diff: list(obj(f).diff).map(String), diffCut: !!obj(f).diff_cut
		})),
		restore: p.restore ? { of: text(r.of), which: text(r.which), dirty: !!r.dirty, acceptedCurrent: !!r.accepted_current, threeWay: normalizeThreeWay(r.three_way), files: normalizeFileStates(r.files) } : null
	}
}

export function normalizeThreeWay(raw) {
	return list(raw).map(r => ({ key: text(obj(r).key), before: obj(r).before === undefined ? null : obj(r).before, after: obj(r).after === undefined ? null : obj(r).after, now: obj(r).now === undefined ? null : obj(r).now }))
}

// The values of a plan in the names of the service. The page's own names (letters, numbers) are mapped here:
//   config.m208 {limits: [{letter, min, max}]}            -> {axes: {X: {min, max}}}
//   config.g10 {tools: [{number, offsets}]} (ONE tool)    -> {tool, offsets}
//   config.workplaces {workplaces: [{index, offsets}], target?} -> {systems: {"1": {X: v}}, target}
export function serviceValues(kind, values) {
	const v = obj(values)
	if (kind === 'config.m208') {
		const axes = {}
		list(v.limits).forEach(l => { axes[l.letter] = { min: l.min, max: l.max } })
		return { axes }
	}
	if (kind === 'config.g10') {
		const t = list(v.tools)[0] || {}
		return { tool: t.number, offsets: obj(t.offsets) }
	}
	if (kind === 'config.workplaces') {
		const systems = {}
		list(v.workplaces).forEach(w => { systems[String(w.index)] = obj(w.offsets) })
		return v.target ? { systems, target: v.target } : { systems }
	}
	return v
}

// ---- safety check and endstop verification (results of machine.run) ----

// safety.check result: {generatedAt, verdict, counts, items: [{id, severity, action, values}]}
export function normalizeSafety(raw) {
	const r = obj(raw)
	const c = obj(r.counts)
	return {
		generatedAt: num(r.generated_at), verdict: ['ok', 'warn', 'bad'].indexOf(r.verdict) >= 0 ? r.verdict : 'ok',
		counts: { ok: num(c.ok) || 0, info: num(c.info) || 0, warn: num(c.warn) || 0, bad: num(c.bad) || 0, unavailable: num(c.unavailable) || 0 },
		items: list(r.items).map(i => ({ id: text(obj(i).id), severity: text(obj(i).severity) || 'info', action: obj(i).action || null, values: obj(obj(i).values) }))
	}
}

function endstopState(raw) {
	const s = obj(raw)
	return { triggered: s.triggered === true ? true : s.triggered === false ? false : null, position: num(s.position), homed: s.homed === true }
}

// homing.verify result -> {outcome, tolerance, axes: [row]}
export function normalizeVerify(raw) {
	const r = obj(raw)
	return {
		outcome: ['ok', 'warn', 'failed'].indexOf(r.outcome) >= 0 ? r.outcome : null, tolerance: num(r.tolerance),
		axes: list(r.axes).map(a => {
			const x = obj(a)
			const e = obj(x.endstop)
			const c = obj(x.checks)
			const flag = k => (c[k] === true ? true : c[k] === false ? false : null)
			return {
				axis: text(x.axis), type: text(e.type), homeAt: text(x.home_at), declared: num(x.declared), before: endstopState(x.before), after: endstopState(x.after), delta: num(x.delta),
				checks: { endstopPresent: flag('endstop_present'), notPressedBefore: flag('not_pressed_before'), positionMatches: flag('position_matches'), triggeredAfter: flag('triggered_after') },
				ok: x.ok === true ? true : x.ok === false ? false : null
			}
		})
	}
}

// ---- limits and offsets ----

export function normalizeLimits(raw) {
	const r = obj(raw)
	return {
		axes: list(r.axes).map(a => ({
			index: num(obj(a).index), letter: text(obj(a).letter), min: num(obj(a).min), max: num(obj(a).max), minProbed: !!obj(a).min_probed, maxProbed: !!obj(a).max_probed,
			homed: obj(a).homed === true ? true : obj(a).homed === false ? false : null, visible: obj(a).visible !== false, position: num(obj(a).position)
		})),
		endstops: list(r.endstops).map(e => ({ index: num(obj(e).index), axis: text(obj(e).axis), type: text(obj(e).type), highEnd: obj(e).high_end === true, triggered: obj(e).triggered === true, probe: obj(e).probe === true })),
		definitions: list(r.definitions).map(d => ({ file: text(obj(d).file), line: num(obj(d).line), text: text(obj(d).text) })),
		warnings: list(r.warnings).map(w => ({ code: text(obj(w).code), axis: text(obj(w).axis) })),
		configRead: r.config_read !== false
	}
}

function offsetValues(raw) {
	const o = obj(raw)
	const out = {}
	Object.keys(o).forEach(axis => { out[axis] = num(o[axis]) })
	return out
}

function toolList(raw) {
	const t = obj(raw)
	return Object.keys(t).map(k => ({ number: Number(k), name: text(obj(t[k]).name), offsets: offsetValues(obj(t[k]).offsets), probed: list(obj(t[k]).probed).map(String) })).sort((a, b) => a.number - b.number)
}

function workList(raw) {
	const w = obj(raw)
	return Object.keys(w).map(k => ({ index: Number(k), name: text(obj(w[k]).code), offsets: offsetValues(obj(w[k]).offsets) })).sort((a, b) => a.index - b.index)
}

// {tools: [{number, name, offsets, probed}], workplaces: [{index, name: 'G54', offsets}], current: 'G54' | '', axes, lastSnapshot}
export function normalizeOffsets(raw) {
	const v = obj(raw)
	const workplaces = workList(v.work)
	const cur = workplaces.find(w => w.index === v.current)
	const last = obj(v.last_snapshot)
	return {
		tools: toolList(v.tools), workplaces, current: cur ? cur.name : '', axes: list(v.axes).map(String),
		lastSnapshot: v.last_snapshot ? { id: text(last.id), ts: num(last.ts), user: text(last.user) } : null
	}
}

export function normalizeSnapshot(raw) {
	const v = obj(raw)
	const prev = obj(v.previous)
	return { recordId: v.record_id || null, previous: v.previous ? { id: text(prev.id), ts: num(prev.ts), user: text(prev.user) } : null, changed: num(v.changed), diff: v.diff ? normalizeDiff({ rows: v.diff }) : null }
}

// machine.mark_cross: mark -> {head, powerPct}; capture -> {mark, head, correction, previous, saved, recordId}; clear -> {cleared}
export function normalizeCross(raw) {
	const v = obj(raw)
	const xy = p => (p && typeof p === 'object' ? { x: num(p.x), y: num(p.y) } : null)
	const prev = obj(v.previous)
	return {
		action: text(v.action), head: xy(v.head), mark: xy(v.mark), correction: xy(v.correction), powerPct: num(v.power_pct),
		previous: v.previous ? { x: num(prev.x), y: num(prev.y), date: prev.date || null } : null, saved: !!v.saved, recordId: v.record_id || null, cleared: !!v.cleared
	}
}

// ---- report data ----

function normalizeSection(raw) {
	const s = obj(raw)
	const rec = obj(s.record)
	const lv = s.level && typeof s.level === 'object' ? s.level : null
	return {
		record: { id: text(rec.id), kind: text(rec.kind), ts: num(rec.ts), user: text(rec.user), role: text(rec.role), state: text(rec.state) || 'done', notes: text(rec.notes) },
		tables: list(s.tables).map(t => ({ id: text(obj(t).id), rows: list(obj(t).rows).map(r => ({ key: text(obj(r).key), value: obj(r).value === undefined ? null : obj(r).value })) })),
		applied: s.applied ? list(s.applied).map(f => ({ path: text(obj(f).path) })) : null,
		mesh: s.mesh ? { grid: figureToGrid(s.mesh, text(obj(s.mesh).id)), stats: obj(obj(s.mesh).stats), symmetric: obj(obj(s.mesh).scale).symmetric === true } : null,
		level: lv ? {
			tolerance: num(lv.tolerance), residual: num(lv.residual), light: lv.light || null,
			passes: list(lv.passes).map(p => ({ n: num(obj(p).n), before: num(obj(p).before), after: num(obj(p).after) }))
		} : null
	}
}

// machine.report -> {kind: 'calibration' | 'machine', generatedAt, generatedBy, machine, signature, sections: [section], limits, offsets, compensation, safety}
export function normalizeReport(raw) {
	const r = obj(raw)
	const m = obj(r.machine)
	const sig = obj(r.signature)
	const sections = r.kind === 'machine' ? list(r.records).map(normalizeSection) : r.record ? [normalizeSection(r)] : []
	const comp = obj(r.compensation)
	return {
		kind: r.kind === 'machine' ? 'machine' : 'calibration', generatedAt: num(r.generated_at), generatedBy: text(r.generated_by),
		machine: { name: text(m.name), board: m.board || null, firmware: m.firmware || null, kinematics: m.kinematics || null },
		signature: { person: text(sig.person), date: num(sig.date) }, sections,
		limits: r.limits ? normalizeLimits(r.limits) : null,
		offsets: r.offsets ? { tools: toolList(obj(r.offsets).tools), workplaces: workList(obj(r.offsets).work) } : null,
		compensation: r.compensation ? { type: text(comp.type) || 'none', file: comp.file || null, fadeHeight: num(comp.fade_height) } : null,
		safety: r.safety ? normalizeSafety(r.safety) : null
	}
}

export function createPhase2Api(call, refusalOf) {
	return {
		config: {
			plan: async (kind, values) => normalizePlan(await call(OPS2.configPlan, { kind, values: serviceValues(kind, values) })),
			// the service asks for the confirmation itself (confirm_required): api() shows the dialog and repeats the call
			apply: async (planId, kind, applyNow) => {
				const r = obj(await call(OPS2.configApply, applyNow ? { plan_id: planId, kind, apply_now: true } : { plan_id: planId, kind }))
				return { applied: !!r.applied, snapshot: r.snapshot || null, recordId: r.record_id || null, restartNeeded: !!r.restart_needed }
			}
		},
		history: {
			async list(filters) {
				const f = obj(filters)
				const args = {}
				;['kind', 'user', 'state'].forEach(k => { if (f[k]) args[k] = f[k] })
				;['since', 'until', 'limit', 'offset'].forEach(k => { if (num(f[k]) !== null) args[k] = f[k] })
				const r = obj(await call(OPS2.historyList, args))
				const records = list(r.records).map(normalizeBrief)
				return { records, total: num(r.total) === null ? records.length : r.total }
			},
			async get(id) {
				const r = obj(await call(OPS2.historyGet, { id }))
				return { record: normalizeRecord(r.record), restore: normalizeRestoreInfo(r.restore) }
			},
			compare: async (a, b) => normalizeCompare(await call(OPS2.historyCompare, { a, b })),
			// {plan, conflict}: with a conflict the plan is null until the person accepts the current files (acceptCurrent). `kind` is the
			// kind of the record: the registry asks for the administrator role from it.
			async restore(id, which, kind, acceptCurrent) {
				const args = { id, which, kind }
				if (acceptCurrent) args.accept_current = true
				try {
					return { plan: normalizePlan(await call(OPS2.historyRestore, args)), conflict: null }
				} catch (e) {
					if (refusalOf(e) !== 'file_changed') throw e
					const body = e && e.body && e.body.error ? e.body.error : {}
					return { plan: null, conflict: { threeWay: normalizeThreeWay(body.three_way), files: normalizeFileStates(body.files) } }
				}
			},
			async report(target) {
				return normalizeReport(await call(OPS2.report, target && target.full ? { full: true } : { id: target.id }))
			}
		},
		limits: { get: async () => normalizeLimits(await call(OPS2.limitsGet, {})) },
		offsets: {
			get: async () => normalizeOffsets(await call(OPS2.offsetsGet, {})),
			snapshot: async note => normalizeSnapshot(await call(OPS2.offsetsSnapshot, note ? { note } : {}))
		},
		pointer: {
			mark: async power => normalizeCross(await call(OPS2.markCross, { action: 'mark', power })),
			capture: async save => normalizeCross(await call(OPS2.markCross, save ? { action: 'capture', save: true } : { action: 'capture' })),
			clear: async () => normalizeCross(await call(OPS2.markCross, { action: 'clear' }))
		},
		// ASSUMED: capabilities.get {capabilities: {laser: {present}}}
		capabilities: async () => ({ laser: !!obj(obj(obj(await call(OPS2.capabilities, {})).capabilities).laser).present })
	}
}
