'use strict'

// Phase 4 part of the Machine api (maintenance counters and plan, camera verification of the offsets). Like the other machine-api*.js, this
// is the ONLY place that knows the operation names, the argument names and the shape of the answers of these operations.
//
// Contract: WorkshopService docs/MACHINE-PHASE4-CONTRACT.md (branch m4-service, commit 8e59bee). Not run against a real machine.
// ASSUMED (marked ASSUMED below, nothing else is):
//   - machine.overview `maintenance` is the light the service builds in machine_maintenance.light(): {worst, due_soon, due, overdue}. The contract
//     only says "gains maintenance (the light)"; the shape is read from the service code (uncommitted at the time of writing).
//   - the history record of kind `offsets.verify` (machine.history.get) has, in `results`, the same fields as the run result of the contract.
//   - the plan item `hours_basis` of machine.maintenance.plan.set is sent only for the hours interval ('power_on' | 'moving').

export const OPS4 = {
	maintenanceGet: 'machine.maintenance.get',
	maintenanceDone: 'machine.maintenance.done',
	planSet: 'machine.maintenance.plan.set'
}

const HISTORY_LIST = 'machine.history.list'; // OPS2 of machine-api-p2.js
const HISTORY_GET = 'machine.history.get';

export const RUN_KINDS4 = { offsetsVerify: 'offsets.verify' }

function obj(v) {
	return v && typeof v === 'object' && !Array.isArray(v) ? v : {}
}

function num(v) {
	return typeof v === 'number' && isFinite(v) ? v : null
}

function list(v) {
	return Array.isArray(v) ? v : []
}

function entry(raw) {
	const e = obj(raw)
	return { ts: num(e.ts), user: String(e.user || ''), role: String(e.role || '') }
}

function totals(raw) {
	const t = obj(raw)
	return { powerOnH: num(t.power_on_h), movingH: num(t.moving_h), distanceM: num(t.distance_m) }
}

// one plan item as machine.maintenance.get / .done answer it
export function normalizeItem(raw) {
	const i = obj(raw)
	const interval = obj(i.interval)
	return {
		id: String(i.id || ''), label: String(i.label || ''), labelKey: i.label_key ? String(i.label_key) : null, axis: i.axis ? String(i.axis) : null,
		interval: { unit: ['hours', 'km', 'days'].indexOf(interval.unit) >= 0 ? interval.unit : 'hours', value: num(interval.value) || 0, basis: interval.basis ? String(interval.basis) : null },
		used: num(i.used), remaining: num(i.remaining), ratio: num(i.ratio), status: i.status ? String(i.status) : null,
		lastDone: i.last_done ? entry(i.last_done) : null
	}
}

// machine.maintenance.get -> {counters: {running, estimated, since, updated, gaps, jumps, board, axes: [{axis, powerOnH, movingH, distanceM}], crosscheck},
// items: [item], planEmpty, notify, summary: {worst, dueSoon, due, overdue}}
export function normalizeMaintenance(raw) {
	const r = obj(raw)
	const c = obj(r.counters)
	const axes = obj(c.axes)
	const s = obj(r.summary)
	const x = obj(c.crosscheck)
	return {
		counters: {
			running: c.running === true, estimated: c.estimated !== false, since: num(c.since), updated: num(c.updated), gaps: num(c.gaps) || 0, jumps: num(c.jumps) || 0,
			board: totals(c.board), axes: Object.keys(axes).map(axis => Object.assign({ axis }, totals(axes[axis]))),
			crosscheck: x.ratio === undefined ? null : { job: String(x.job || ''), estimatedMm: num(x.estimated_mm), plannedMm: num(x.planned_mm), ratio: num(x.ratio), ts: num(x.ts) }
		},
		items: list(r.items).map(normalizeItem).filter(i => i.id),
		planEmpty: r.plan_empty === true,
		notify: obj(r.notify).enabled === true,
		summary: { worst: String(s.worst || 'ok'), dueSoon: num(s.due_soon) || 0, due: num(s.due) || 0, overdue: num(s.overdue) || 0 }
	}
}

// the plan item in the service's names (machine.maintenance.plan.set `items`)
export function itemToService(item) {
	const out = { id: item.id, label: item.label, axis: item.axis || null }
	if (item.everyHours) {
		out.every_hours = item.everyHours
		if (item.hoursBasis === 'moving') out.hours_basis = 'moving'
	} else if (item.everyKm) out.every_km = item.everyKm
	else out.every_days = item.everyDays
	return out
}

// machine.overview maintenance (the light) -> {worst, due: items due or overdue, dueSoon} | null
export function normalizeMaintenanceLight(raw) {
	const m = obj(raw)
	if (!m.worst) return null
	return { worst: String(m.worst), due: (num(m.due) || 0) + (num(m.overdue) || 0), dueSoon: num(m.due_soon) || 0 }
}

// machine.state vision: {measure, checked_at}; `measure` null when the state does not say (an older service)
export function normalizeVision(raw) {
	const v = obj(raw)
	return { measure: typeof v.measure === 'boolean' ? v.measure : null, checkedAt: num(v.checked_at) }
}

// the result of the run `offsets.verify` (or its history record) -> one row of the verification table, or null
export function normalizeVerification(raw) {
	const r = obj(raw)
	const t = obj(r.target)
	const kind = t.kind === 'tool' ? 'tool' : t.kind === 'system' ? 'system' : ''
	if (!kind) return null
	const err = obj(r.error)
	return {
		targetKind: kind, number: num(kind === 'tool' ? t.tool : t.system), method: String(r.method || ''), outcome: String(r.outcome || 'inconclusive'),
		errorMm: num(err.dist), dxMm: num(err.dx), dyMm: num(err.dy), toleranceMm: num(r.tolerance), uncertaintyMm: num(r.uncertainty_mm),
		samples: list(r.samples).length || num(obj(r.measured).n)
	}
}

export function createPhase4Api(call) {
	return {
		get: async () => normalizeMaintenance(await call(OPS4.maintenanceGet, {})),
		// -> {id, done: {ts, user, role}, item}
		done: async (id, note) => {
			const r = obj(await call(OPS4.maintenanceDone, note ? { id, note } : { id }))
			return { id: String(r.id || id), done: entry(r.done), item: r.item ? normalizeItem(r.item) : null }
		},
		// the whole plan replaces the old one; `notify` is the opt-in phone notice; `defaults: true` puts the generic items back
		savePlan: (items, notify) => call(OPS4.planSet, { items: list(items).map(itemToService), notify: notify === true }),
		restoreDefaults: () => call(OPS4.planSet, { defaults: true }),
		verify: {
			// the newest verifications of the history, one row each (ASSUMED: record.results has the fields of the run result), newest first
			recent: async limit => {
				const brief = list(obj(await call(HISTORY_LIST, { kind: RUN_KINDS4.offsetsVerify, limit: limit || 10 })).records)
				const full = await Promise.all(brief.map(b => call(HISTORY_GET, { id: obj(b).id }).then(r => obj(r).record, () => null)))
				return full.map(rec => {
					const row = normalizeVerification(obj(obj(rec).results))
					return row ? Object.assign(row, { ts: num(obj(rec).ts) }) : null
				}).filter(Boolean)
			}
		}
	}
}
