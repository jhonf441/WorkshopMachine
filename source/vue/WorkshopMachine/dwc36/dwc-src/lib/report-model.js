'use strict'

// The printable report (design 2.11) as DATA: header, one section per calibration record (value tables, figures, drawings as SVG strings),
// and for the full machine report the limits, the offsets, the compensation and the safety check, then the signature line. ReportView.vue
// only draws it. Pure: texts come as keys; the few words inside the drawings come in `labels` (already translated by the caller).
// Built from the normalized answer of machine.report (api/machine-api-p2.js normalizeReport); the service draws nothing.

import { kindKey, stateView } from './history.js'
import { formatDate, formatNumber, formatValue } from './format.js'
import { normalizeGrid, gridStats, bedOf } from './mesh-grid.js'
import { meshSvg, residualSvg } from './report-svg.js'
import { checkRows } from './safety.js'
import { limitRows, travel } from './limits.js'
import { axesOf, setLabel } from './offsets.js'

export const LABELS = { pass: '', tolerance: '', legend: '', meshMap: '', residual: '' }

const MESH_STATS = ['points', 'missing', 'min', 'max', 'range', 'mean', 'rms', 'stdev']
const TABLE_KEY = { inputs: 'report.table_inputs', results: 'report.table_results' }

function fig(labelKey, value, whole) {
	return { labelKey, text: typeof value === 'number' && !whole ? formatNumber(value, 4) : formatValue(value) }
}

function levelPart(level, ctx) {
	if (!level) return {}
	const rows = level.passes.map(p => ({ n: p.n, before: p.before, after: p.after }))
	return {
		verdictKey: level.light ? 'report.level_' + level.light : null,
		passes: rows.map(p => ({ n: p.n, before: formatNumber(p.before, 4), after: formatNumber(p.after, 4) })),
		figures: [fig('report.residual', level.residual), fig('report.tolerance', level.tolerance)],
		drawings: rows.length ? [{ captionKey: 'report.drawing_residual', svg: residualSvg(rows, level.tolerance, { label: ctx.labels.residual, passLabel: ctx.labels.pass, toleranceLabel: ctx.labels.tolerance }) }] : []
	}
}

function meshPart(mesh, ctx) {
	const grid = mesh ? normalizeGrid(mesh.grid) : null
	if (!grid) return {}
	const s = Object.assign({ points: gridStats(grid).n }, gridStats(grid))
	return {
		figures: MESH_STATS.map(k => fig('mesh.stat_' + k, s[k], k === 'points' || k === 'missing')),
		drawings: [{ captionKey: 'report.drawing_mesh', svg: meshSvg(grid, ctx.bed || bedOf(null, grid), { label: ctx.labels.meshMap, legendLabel: ctx.labels.legend, symmetric: mesh.symmetric }) }]
	}
}

export function sectionOf(section, ctx) {
	const rec = section.record
	return Object.assign({
		id: rec.id, kind: rec.kind, titleKey: kindKey(rec.kind), dateText: formatDate(rec.ts), user: rec.user, role: rec.role, state: stateView(rec.state), notes: rec.notes,
		applied: section.applied ? section.applied.map(f => f.path) : [], verdictKey: null, figures: [], passes: null, drawings: [],
		tables: section.tables.filter(t => t.rows.length).map(t => ({ id: t.id, titleKey: TABLE_KEY[t.id] || 'report.table_results', rows: t.rows.map(r => ({ key: r.key, text: formatValue(r.value) })) }))
	}, levelPart(section.level, ctx), meshPart(section.mesh, ctx))
}

// the tables of offsets as {titleKey, axes, rows: [{label, cells}]}
function offsetTable(titleKey, sets) {
	const axes = axesOf(sets)
	return { titleKey, axes, rows: sets.map(s => ({ label: setLabel(s), cells: axes.map(a => formatNumber(s.offsets[a], 3)) })) }
}

function fullParts(report) {
	return {
		limits: report.limits ? limitRows(report.limits.axes).map(r => ({ axis: r.letter, min: formatNumber(r.min, 3), max: formatNumber(r.max, 3), travel: formatNumber(travel(r), 3) })) : [],
		offsets: report.offsets ? [offsetTable('report.offsets_tools', report.offsets.tools), offsetTable('report.offsets_work', report.offsets.workplaces)].filter(t => t.rows.length) : [],
		compensation: report.compensation ? { type: report.compensation.type, file: report.compensation.file || '-', fade: report.compensation.fadeHeight === null ? '-' : formatNumber(report.compensation.fadeHeight, 1) } : null,
		checkRows: report.safety ? checkRows(report.safety) : [], hasCheck: !!report.safety
	}
}

// report = normalizeReport(...); input {labels, bed}
export function buildReport(report, input) {
	const full = report.kind === 'machine'
	const ctx = { bed: (input && input.bed) || null, labels: Object.assign({}, LABELS, input && input.labels) }
	const m = report.machine
	return Object.assign({
		mode: full ? 'full' : 'record', titleKey: full ? 'report.title_full' : 'report.title_record',
		header: { name: m.name, board: m.board || '', firmware: m.firmware || '', kinematics: m.kinematics || '', person: report.signature.person || report.generatedBy, dateText: formatDate(report.generatedAt) },
		sections: report.sections.map(s => sectionOf(s, ctx)), signature: true, signedDateText: formatDate(report.signature.date),
		limits: [], offsets: [], compensation: null, checkRows: [], hasCheck: false
	}, full ? fullParts(report) : {})
}
