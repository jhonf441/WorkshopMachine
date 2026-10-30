'use strict'

// Phase 6 part of the Machine api (the layout of the machine for the bed views of Mesh, Level and Probe). Like the other
// machine-api*.js, this is the ONLY place that knows the operation name, the argument names and the shape of the answer.
//
// Contract: WorkshopService docs/MACHINE-LAYOUT-CONTRACT.md (branch m6-service, read-only operation, role operator).
//   machine.layout {mode: 'mesh' | 'level', probe?, x0 x1 y0 y1 nx ny (mesh), points: [{x, y}] (level), margin?}
//   -> {v, mode, bed, bed_reason, probe, probe_reason, reach, reach_reason, leadscrews, leadscrews_reason, kinematics, mesh | level, last}
// Statuses of a point: 'in' | 'out_of_reach' | 'clipped' | 'duplicate' | null (null = cannot be judged); the plugin names them
// 'measure' | 'outside_reach' | 'clipped' | 'duplicate' | 'unknown'. Every datum the service does not know is null with a *_reason.
// Not run against a real machine.

export const OPS6 = { layout: 'machine.layout' }
export const STATUSES = ['measure', 'outside_reach', 'clipped', 'duplicate', 'unknown']
const STATUS_OF = { in: 'measure', out_of_reach: 'outside_reach', clipped: 'clipped', duplicate: 'duplicate' }

function obj(v) {
	return v && typeof v === 'object' && !Array.isArray(v) ? v : {}
}

function num(v) {
	return typeof v === 'number' && isFinite(v) ? v : null
}

function list(v) {
	return Array.isArray(v) ? v : []
}

// {x_min, x_max, y_min, y_max} -> {xmin, xmax, ymin, ymax} | null
function rect(raw) {
	const r = obj(raw)
	const x0 = num(r.x_min)
	const x1 = num(r.x_max)
	const y0 = num(r.y_min)
	const y1 = num(r.y_max)
	return x0 !== null && x1 !== null && y0 !== null && y1 !== null && x1 > x0 && y1 > y0 ? { xmin: x0, xmax: x1, ymin: y0, ymax: y1 } : null
}

// {x0, x1, y0, y1} (the region of a mesh) -> {xmin, xmax, ymin, ymax} | null
function region(raw) {
	const r = obj(raw)
	const x0 = num(r.x0)
	const x1 = num(r.x1)
	const y0 = num(r.y0)
	const y1 = num(r.y1)
	return x0 !== null && x1 !== null && y0 !== null && y1 !== null && x1 > x0 && y1 > y0 ? { xmin: x0, xmax: x1, ymin: y0, ymax: y1 } : null
}

function statusOf(raw) {
	return STATUS_OF[raw] || 'unknown'
}

function meshBlock(raw) {
	const m = obj(raw)
	if (!raw) return null
	return {
		points: list(m.points).map(p => ({ i: num(obj(p).i), j: num(obj(p).j), x: num(obj(p).x), y: num(obj(p).y), status: statusOf(obj(p).status), reason: String(obj(p).reason || '') })).filter(p => p.x !== null && p.y !== null),
		grid: [num(obj(m.grid).nx), num(obj(m.grid).ny)], clippedRegion: region(m.clipped_region), clippedReason: m.clipped_reason ? String(m.clipped_reason) : '',
		tooMany: !!m.too_many_points, margin: num(m.margin), seconds: num(m.estimated_seconds)
	}
}

function levelBlock(raw) {
	const l = obj(raw)
	if (!raw) return null
	const d = obj(l.descent)
	return {
		points: list(l.points).map(p => {
			const near = obj(obj(p).near_leadscrew)
			return { index: num(obj(p).index), x: num(obj(p).x), y: num(obj(p).y), status: statusOf(obj(p).status), reason: String(obj(p).reason || ''), near: num(near.index) !== null ? { index: near.index, distance: num(near.distance) } : null }
		}).filter(p => p.x !== null && p.y !== null),
		suggested: !!l.suggested, errors: list(l.errors).map(e => ({ code: String(obj(e).code || ''), point: num(obj(e).point) })), leadscrewCount: num(l.leadscrew_count),
		descent: { bound: num(d.bound), limit: num(d.limit), ok: typeof d.ok === 'boolean' ? d.ok : null }
	}
}

// the grid shape of lib/mesh-grid.js normalizeGrid, rebuilt from the points {i, j, x, y, z} of last.mesh
function lastMesh(raw) {
	const m = obj(raw)
	const g = obj(m.grid)
	const nx = num(g.nx)
	const ny = num(g.ny)
	if (!raw || !nx || !ny || num(g.min_x) === null || num(g.max_x) === null || num(g.min_y) === null || num(g.max_y) === null) return null
	const z = []
	for (let j = 0; j < ny; j++) z.push(new Array(nx).fill(null))
	list(m.points).forEach(p => {
		const i = num(obj(p).i)
		const j = num(obj(p).j)
		if (i !== null && j !== null && i >= 0 && i < nx && j >= 0 && j < ny) z[j][i] = num(obj(p).z)
	})
	return { id: String(m.id || ''), name: String(m.name || m.id || ''), x: { min: g.min_x, max: g.max_x, n: nx }, y: { min: g.min_y, max: g.max_y, n: ny }, z, ts: num(m.ts), user: String(m.user || '') }
}

// the measured heights of a levelling result [{x, y, dz}] from points {x, y, z, deviation}; dz = z - mean, + = the bed is higher there
export function normalizeHeights(raw) {
	return list(obj(raw).points).map(p => ({ x: num(obj(p).x), y: num(obj(p).y), dz: num(obj(p).deviation) })).filter(p => p.x !== null && p.y !== null && p.dz !== null)
}

// the passes of a RUN result of the existing level flow: {n, before, after, adjustments: [{motor, mm}]} (not part of machine.layout)
export function normalizePasses(raw) {
	return list(obj(raw).passes).map((p, k) => {
		const o = obj(p)
		const dev = v => (num(obj(v).deviation) !== null ? v.deviation : num(v))
		return {
			n: num(o.n) || k + 1, before: dev(o.before), after: dev(o.after),
			adjustments: list(o.adjustments).map(a => ({ motor: num(obj(a).motor), mm: num(obj(a).mm) })).filter(a => a.motor !== null && a.mm !== null)
		}
	})
}

// why a part is missing, as codes with a text 'bed.missing_<code>' (the service reasons, plus unsupported kinematics)
function missingOf(r) {
	const out = []
	const add = c => { if (c && out.indexOf(c) < 0) out.push(c) }
	if (!rect(r.bed)) add('no_bed')
	if (!r.probe || r.probe_reason === 'no_probe') add('no_probe')
	if (r.reach_reason === 'empty_reach' || r.reach_reason === 'unsupported_kinematics') add(r.reach_reason)
	else if (!rect(r.reach) && rect(r.bed) && r.probe) add('no_reach')
	if (obj(r.kinematics).supported === false) add('unsupported_kinematics')
	if (r.leadscrews_reason === 'no_m671' || r.leadscrews_reason === 'm671_unreadable') add(r.leadscrews_reason)
	return out
}

// -> {mode, bed, kinematics, probe: {present, index, offset: {x, y} | null, triggerHeight}, reach, screws[], mesh, level, lastMesh (a raw grid), lastLevel, missing[]}
export function normalizeLayout(raw) {
	const r = obj(raw)
	const probe = obj(r.probe)
	const ox = num(probe.offset_x)
	const oy = num(probe.offset_y)
	const last = obj(r.last)
	const ll = obj(last.level)
	return {
		mode: String(r.mode || ''), bed: rect(r.bed), kinematics: obj(r.kinematics).name ? String(r.kinematics.name) : null,
		probe: { present: !!r.probe && r.probe_reason !== 'no_probe', index: num(probe.index), offset: ox !== null && oy !== null && r.probe ? { x: ox, y: oy } : null, triggerHeight: num(probe.trigger_height) },
		reach: rect(r.reach), screws: list(r.leadscrews).map(s => ({ index: num(obj(s).index), x: num(obj(s).x), y: num(obj(s).y) })).filter(s => s.index !== null && s.x !== null && s.y !== null),
		mesh: meshBlock(r.mesh), level: levelBlock(r.level), lastMesh: lastMesh(last.mesh),
		lastLevel: last.level ? { ts: num(ll.ts), user: String(ll.user || ''), kind: String(ll.kind || ''), outcome: ll.outcome ? String(ll.outcome) : '', deviation: num(ll.deviation), mean: num(ll.mean), points: normalizeHeights(ll) } : null,
		missing: missingOf(r)
	}
}

// the arguments of a draft: mesh {region: {xmin..ymax} | null, points: [nx, ny], probe?} or level {points: [{x, y}]}
export function layoutArgs(mode, draft) {
	const d = obj(draft)
	if (mode === 'level') return Array.isArray(d.points) && d.points.length ? { mode, points: d.points.map(p => ({ x: p.x, y: p.y })) } : { mode }
	const a = { mode: 'mesh' }
	if (Array.isArray(d.points)) { a.nx = d.points[0]; a.ny = d.points[1] }
	if (d.region) Object.assign(a, { x0: d.region.xmin, x1: d.region.xmax, y0: d.region.ymin, y1: d.region.ymax })
	if (typeof d.probe === 'number') a.probe = d.probe
	return a
}

export function createPhase6Api(call) {
	return {
		// the answer overrides every local guess of the page
		get: async (mode, draft) => normalizeLayout(await call(OPS6.layout, layoutArgs(mode, draft)))
	}
}
