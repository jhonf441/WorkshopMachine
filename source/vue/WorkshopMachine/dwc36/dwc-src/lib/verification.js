'use strict'

// Camera verification of the offsets (design 2.7, 2.12): the result table (error in mm per system / tool) and the form of the run. Pure.
// The verification needs the capability `vision.measure` (machine.state vision.measure); without it the check is manual and the section says so.

export const TARGETS = ['system', 'tool']
export const METHODS = ['crosshair', 'laser', 'pen']
export const OUTCOMES = ['ok', 'out', 'inconclusive']
export const DEFAULT_TOLERANCE_MM = 0.5 // the service's default; the form starts with it
export const SYSTEMS = [1, 2, 3, 4, 5, 6, 7, 8, 9]

const VIEWS = {
	ok: { color: 'success', icon: 'mdi-check-circle' },
	out: { color: 'error', icon: 'mdi-alert-octagon' },
	inconclusive: { color: 'warning', icon: 'mdi-help-rhombus-outline' }
}

// colour is never the only signal: icon and text key change with the outcome too
export function outcomeView(outcome) {
	const o = VIEWS[outcome] ? outcome : 'inconclusive'
	return Object.assign({ outcome: o, textKey: 'verify.outcome_' + o }, VIEWS[o])
}

// system number -> its G-code name (1 = G54 ... 6 = G59, 7 = G59.1 ... 9 = G59.3)
export function systemName(n) {
	if (!(n >= 1 && n <= 9)) return '-'
	return n <= 6 ? 'G' + (53 + n) : 'G59.' + (n - 6)
}

// what the section shows: 'checking' (state not read yet), 'manual' (no vision.measure) or 'ready' (can run)
export function modeOf(measure) {
	if (measure === null || measure === undefined) return 'checking'
	return measure ? 'ready' : 'manual'
}

// the tolerance field -> number in the service's range 0.05-5, or null
export function parseTolerance(text) {
	const n = Number(String(text).replace(',', '.'))
	return String(text).trim() !== '' && isFinite(n) && n >= 0.05 && n <= 5 ? n : null
}

// the form -> params of the run `offsets.verify`, or null when a field is wrong (the system is left out when "current" is chosen)
export function runParams(form) {
	const tolerance = parseTolerance(form.tolerance)
	if (tolerance === null || TARGETS.indexOf(form.target) < 0 || METHODS.indexOf(form.method) < 0) return null
	const params = { target: form.target, method: form.method, tolerance }
	if (form.target === 'system' && form.system) params.system = Number(form.system)
	return params
}

export function rowKey(row) {
	return row.targetKind + ':' + row.number
}

// rows of the table: one per system / tool (the newest), systems first, each in number order, with the view of its outcome
export function tableRows(rows) {
	return rows.slice().sort((a, b) => (a.targetKind === b.targetKind ? 0 : a.targetKind === 'system' ? -1 : 1) || (a.number || 0) - (b.number || 0))
		.map(r => Object.assign({}, r, { key: rowKey(r), view: outcomeView(r.outcome) }))
}

// the largest error of the table (null when there is none)
export function worstError(rows) {
	const e = rows.map(r => r.errorMm).filter(v => typeof v === 'number')
	return e.length ? Math.max.apply(null, e) : null
}
