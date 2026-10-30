'use strict'

// The ONLY place that knows how the Machine page talks to WorkshopService: operation names, argument names and the shape of the
// answers. Everything else in the plugin works with the normalized values returned here. Contract: WorkshopService
// dsf/machine_ops.py + machine_procedures.py + docs/api/README.md ("Machine (calibration procedures)").
//
// REAL (service phase 0 and 1): machine.overview, state, runs, run, stop, mesh.* (list, get, load, clear, save, taper, delete) and the run kinds below.
//
// `call(op, args, opts)` is api() of vue/_shared/workshop-api.js (machine-client.js binds it); tests pass a fake.

import { createPhase2Api } from './machine-api-p2.js'
import { createPhase3Api } from './machine-api-p3.js'
import { createPhase4Api, normalizeMaintenanceLight, normalizeVision } from './machine-api-p4.js'
import { createPhase6Api } from './machine-api-p6.js'
import { createPhase7Api } from './machine-api-p7.js'
import { createPhase8Api } from './machine-api-p8.js'
import { createPhase9Api } from './machine-api-p9.js'

export const OPS = {
	overview: 'machine.overview',
	state: 'machine.state',
	runs: 'machine.runs',
	run: 'machine.run',
	stop: 'machine.stop',
	meshList: 'machine.mesh.list',
	meshGet: 'machine.mesh.get',
	meshLoad: 'machine.mesh.load',
	meshClear: 'machine.mesh.clear',
	meshSave: 'machine.mesh.save',
	meshTaper: 'machine.mesh.taper',
	meshDelete: 'machine.mesh.delete'
}

export const RUN_KINDS = {
	probeRepeat: 'probe.repeat',
	levelG32: 'level.g32',
	levelG30: 'level.g30',
	levelMeasure: 'level.measure',
	meshProbe: 'mesh.probe'
}

const ACTIVE = ['queued', 'running', 'stopping']

function obj(v) {
	return v && typeof v === 'object' && !Array.isArray(v) ? v : {}
}

function num(v) {
	return typeof v === 'number' && isFinite(v) ? v : null
}

// one run as machine.runs sends it (full) or as the published data `machine` sends it (summary)
export function normalizeRun(raw) {
	const r = obj(raw)
	const err = r.error
	return {
		id: String(r.id || ''),
		kind: String(r.kind || ''),
		state: String(r.state || 'queued'),
		user: String(r.user || ''),
		step: num(r.step) || 0,
		total: num(r.total) || 0,
		phase: String(r.phase || ''),
		created: num(r.created),
		started: num(r.started),
		finished: num(r.finished),
		recordId: r.record_id || null,
		params: obj(r.params),
		result: r.result && typeof r.result === 'object' ? r.result : null,
		errorCode: err && typeof err === 'object' ? String(err.code || '') : err ? String(err) : '',
		errorDetail: err && typeof err === 'object' ? String(err.detail || err.message || '') : ''
	}
}

export function isActiveRun(run) {
	return !!run && ACTIVE.indexOf(run.state) >= 0
}

// machine.runs {current, runs[]} and the published {current, runs[]} -> {current: run | null, runs: [run], active}
export function normalizeRuns(raw) {
	const v = obj(raw)
	const runs = (Array.isArray(v.runs) ? v.runs : []).map(normalizeRun)
	const current = runs.find(r => r.id === v.current) || null
	return { current, runs, active: current && isActiveRun(current) ? current : runs.find(isActiveRun) || null }
}

// machine.overview -> {kinds: {kind: {light, ageDays, ts}}, ready: {...}, run: {active, kind, state}, ageOldDays}
export function normalizeOverview(raw) {
	const v = obj(raw)
	const kinds = {}
	Object.keys(obj(v.kinds)).forEach(k => {
		const e = obj(v.kinds[k])
		kinds[k] = { light: ['never', 'ok', 'old'].indexOf(e.light) >= 0 ? e.light : 'never', ageDays: num(e.age_days), ts: num(e.ts) }
	})
	const ready = obj(v.ready)
	const run = obj(v.run)
	return {
		kinds,
		ready: {
			live: !!ready.live,
			homed: !!ready.homed,
			probe: !!ready.probe,
			meshActive: !!ready.mesh_active,
			kinematics: ready.kinematics || null,
			kinematicsSupported: ready.kinematics_supported !== false,
			levellingMode: ready.levelling_mode || 'unknown',
			zMotors: num(ready.z_motors) || 0
		},
		run: { active: !!run.active, kind: run.kind || null, state: run.state || null },
		ageOldDays: num(v.age_old_days),
		maintenance: normalizeMaintenanceLight(v.maintenance)
	}
}

// machine.state -> the overview plus {modules: {id: {available, reason}}, runs, records, profile}
export function normalizeState(raw) {
	const v = obj(raw)
	const modules = {}
	Object.keys(obj(v.modules)).forEach(id => {
		const m = obj(v.modules[id])
		modules[id] = { available: m.available !== false, reason: m.reason || null }
	})
	const profile = obj(v.profile)
	return Object.assign(normalizeOverview(v), {
		modules,
		vision: normalizeVision(v.vision),
		runs: normalizeRuns(v.runs),
		records: Array.isArray(v.records) ? v.records : [],
		thresholds: obj(profile.thresholds),
		meshQuality: obj(obj(profile.mesh).quality),
		levelling: obj(profile.levelling),
		// laser <-> pointer: {laser_tool, pointer_tool} the owner declared in the profile, or null
		toolPair: profile.secondary_tool_pair && typeof profile.secondary_tool_pair === 'object' ? { laserTool: num(profile.secondary_tool_pair.laser_tool), pointerTool: num(profile.secondary_tool_pair.pointer_tool) } : null
	})
}

// A refusal of the service: error.reason (no_probe, not_homed, busy_run...) or the code (motion_denied, confirm_required...)
export function refusalOf(e) {
	const body = e && e.body && e.body.error ? e.body.error : {}
	return String(body.reason || (e && e.reason) || (e && e.code) || 'failed')
}

// The forms keep their own names; the service takes these (dsf/machine_level.py, machine_mesh.py validate())
export function serviceParams(kind, params) {
	const p = Object.assign({}, obj(params))
	if (kind === RUN_KINDS.levelG32 || kind === RUN_KINDS.levelG30 || kind === RUN_KINDS.levelMeasure) {
		if ('max_passes' in p) { p.passes = p.max_passes; delete p.max_passes }
		if ('tolerance_mm' in p) { p.tolerance = p.tolerance_mm; delete p.tolerance_mm }
	}
	if (kind === RUN_KINDS.meshProbe) {
		if (Array.isArray(p.points)) { p.nx = p.points[0]; p.ny = p.points[1] }
		delete p.points
		if (p.mode === 'region' && p.region) p.region = { x0: p.region.xmin, x1: p.region.xmax, y0: p.region.ymin, y1: p.region.ymax }
		else delete p.region
		delete p.mode
	}
	return p
}

export function createMachineApi(call) {
	const mesh = {
		// machine.mesh.list -> {meshes: [{id, name, ts, user, active}]}
		async list() {
			const r = obj(await call(OPS.meshList, {}))
			return (Array.isArray(r.meshes) ? r.meshes : []).map(m => ({
				id: String(obj(m).id || ''), name: String(obj(m).name || obj(m).id || ''), ts: num(obj(m).ts), user: String(obj(m).user || ''),
				active: !!obj(m).active, validity: obj(obj(m).validity)
			}))
		},
		// machine.mesh.get {id} -> the grid, see lib/mesh-grid.js normalizeGrid (x: {min, max, n}, y: {...}, z: rows by Y)
		// the service answers {mesh, grid: {min0, max0, min1, max1, num0, num1}, rows[j][i], stats}: mapped to the grid of lib/mesh-grid.js
		get: async id => {
			const r = obj(await call(OPS.meshGet, { id }))
			const g = obj(r.grid)
			const m = obj(r.mesh)
			return {
				id: String(m.id || id), name: String(m.name || m.id || id),
				x: { min: g.min0, max: g.max0, n: g.num0 }, y: { min: g.min1, max: g.max1, n: g.num1 }, z: r.rows,
				validity: obj(m.validity), stats: obj(r.stats)
			}
		},
		// a map that no longer matches the machine is refused (reason stale_mesh) unless acceptStale
		load: (id, acceptStale) => call(OPS.meshLoad, acceptStale ? { id, accept_stale: true } : { id }),
		remove: id => call(OPS.meshDelete, { id }),
		clear: () => call(OPS.meshClear, {}),
		save: name => call(OPS.meshSave, { name }),
		taper: height => call(OPS.meshTaper, { height })
	}
	return Object.assign({
		overview: async () => normalizeOverview(await call(OPS.overview, {})),
		state: async () => normalizeState(await call(OPS.state, {})),
		runs: async runId => normalizeRuns(await call(OPS.runs, runId ? { run_id: runId } : {})),
		// the service asks for the confirmation itself (confirm_required): api() shows the dialog and repeats the call
		run: async (kind, params) => obj(await call(OPS.run, { kind, params: serviceParams(kind, params) })),
		stop: () => call(OPS.stop, {}, { noLogin: true }),
		mesh
	}, createPhase2Api(call, refusalOf), { motion: createPhase3Api(call), maintenance: createPhase4Api(call), layout: createPhase6Api(call), pointsets: createPhase7Api(call), height: createPhase8Api(call), workarea: createPhase9Api(call) })
}
