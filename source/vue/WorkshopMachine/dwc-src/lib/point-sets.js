'use strict'

// Named point sets ("corners", "centre and edges"), shared by Mesh and Level and kept per machine in the settings store
// `machine-pointsets` (WorkshopService docs/MACHINE-POINTSETS-CONTRACT.md). The page owns the shape, so everything read is checked here and a
// damaged file is read as far as it can be. Pure: api/machine-api-p7.js does the reading and writing.
//
// value: {schema: 1, sets: [{id, name, points: [{x, y}], ts, user}]}

export const SET_LIMITS = { sets: 40, points: 100, nameLength: 40 }
export const SET_ERRORS = ['empty', 'long', 'no_points', 'full'] // bed.set_err_<code>

const r3 = v => Math.round(v * 1000) / 1000

function num(v) {
	return typeof v === 'number' && isFinite(v) ? v : null
}

// a point list as stored: numbers only, at most SET_LIMITS.points, three decimals
function cleanPoints(list) {
	const out = []
	const src = Array.isArray(list) ? list : []
	src.forEach(p => {
		const x = num(p && p.x)
		const y = num(p && p.y)
		if (x !== null && y !== null && out.length < SET_LIMITS.points) out.push({ x: r3(x), y: r3(y) })
	})
	return out
}

// the store value (anything) -> [{id, name, points, ts, user}]; entries that cannot be read are left out
export function normalizeSets(value) {
	const raw = value && typeof value === 'object' && Array.isArray(value.sets) ? value.sets : []
	const seen = {}
	const out = []
	raw.forEach(s => {
		const name = s && typeof s.name === 'string' ? s.name.trim() : ''
		const points = cleanPoints(s && s.points)
		const id = s && typeof s.id === 'string' && s.id ? s.id : ''
		if (!name || !points.length || !id || seen[id]) return
		seen[id] = true
		out.push({ id, name: name.slice(0, SET_LIMITS.nameLength), points, ts: num(s.ts), user: typeof s.user === 'string' ? s.user : '' })
	})
	return out.slice(0, SET_LIMITS.sets)
}

export function valueOf(sets) {
	return { schema: 1, sets }
}

// -> {ok, name, errorKey}
export function checkName(name) {
	const n = String(name === undefined || name === null ? '' : name).trim()
	if (!n) return { ok: false, name: n, errorKey: 'bed.set_err_empty' }
	if (n.length > SET_LIMITS.nameLength) return { ok: false, name: n, errorKey: 'bed.set_err_long' }
	return { ok: true, name: n, errorKey: null }
}

const sameName = (a, b) => a.toLowerCase() === b.toLowerCase()

// Saves `points` under `name` over the current sets (the same name, any case, REPLACES that set). -> {ok, sets, replaced, errorKey}
export function saveSet(sets, name, points, who, now) {
	const nm = checkName(name)
	if (!nm.ok) return { ok: false, sets, replaced: false, errorKey: nm.errorKey }
	const list = cleanPoints(points)
	if (!list.length) return { ok: false, sets, replaced: false, errorKey: 'bed.set_err_no_points' }
	const at = sets.findIndex(s => sameName(s.name, nm.name))
	if (at < 0 && sets.length >= SET_LIMITS.sets) return { ok: false, sets, replaced: false, errorKey: 'bed.set_err_full' }
	const entry = { id: at >= 0 ? sets[at].id : 'ps-' + Math.round(now * 1000).toString(36), name: nm.name, points: list, ts: Math.round(now), user: who || '' }
	const next = sets.slice()
	if (at >= 0) next[at] = entry
	else next.push(entry)
	return { ok: true, sets: next, replaced: at >= 0, errorKey: null }
}

export function deleteSet(sets, id) {
	return sets.filter(s => s.id !== id)
}

// The points of a set for THIS machine: the ones outside the bed are left out and counted (the bed of another machine is another bed);
// the ones the probe cannot reach stay (the plan marks them). -> {points: [{x, y}], dropped}
export function pointsForBed(set, bed) {
	const inBed = p => !bed || (p.x >= bed.xmin && p.x <= bed.xmax && p.y >= bed.ymin && p.y <= bed.ymax)
	const points = set.points.filter(inBed)
	return { points, dropped: set.points.length - points.length }
}

// the sets as the list shows them; a set with more points than the tool takes (`max`, Level) is marked and not loadable
export function offered(sets, max) {
	return sets.map(s => ({ id: s.id, name: s.name, count: s.points.length, fits: !max || s.points.length <= max }))
}
