'use strict'

// Mesh module data (design 2.4): the height-map grid as the service sends it, its statistics and quality, and the parameters of the
// mesh run, taper and save. Pure.
//
// Grid from machine.mesh.get (ASSUMED until the service implements it):
//   {id, name, x: {min, max, n}, y: {min, max, n}, z: [[...]]}     z has `y.n` rows (by Y, ascending) of `x.n` heights in mm; null = not probed
// Run result of mesh.probe: {mesh_id?, points: [nx, ny], grid?: <same grid>, errors?: n}

export const POINTS = { min: 2, max: 21 } // the old module limit (21 x 21)
export const TAPER = { min: 0, max: 50 } // mm of the M376 fade height; 0 = no taper (a guess for the upper limit: tune with use)
export const DEFAULT_QUALITY = { warnRange: 0.1, badRange: 0.25 } // peak-to-valley in mm (a guess, the profile mesh.quality overrides)
export const NAME_RX = /^[A-Za-z0-9][A-Za-z0-9_-]{0,31}$/

function axisValues(a) {
	const n = a && typeof a.n === 'number' ? Math.floor(a.n) : 0
	if (n < 1 || typeof a.min !== 'number' || typeof a.max !== 'number') return null
	if (n === 1) return [a.min]
	const out = []
	for (let k = 0; k < n; k++) out.push(a.min + ((a.max - a.min) * k) / (n - 1))
	return out
}

// -> {id, name, nx, ny, xs, ys, z: [j][i] (number | null), bounds} or null when it cannot be drawn
export function normalizeGrid(raw) {
	if (!raw || typeof raw !== 'object') return null
	const xs = axisValues(raw.x)
	const ys = axisValues(raw.y)
	if (!xs || !ys || !Array.isArray(raw.z) || raw.z.length !== ys.length) return null
	const z = raw.z.map(row => (Array.isArray(row) && row.length === xs.length ? row.map(v => (typeof v === 'number' && isFinite(v) ? v : null)) : null))
	if (z.some(r => r === null)) return null
	return { id: String(raw.id || ''), name: String(raw.name || raw.id || ''), nx: xs.length, ny: ys.length, xs, ys, z, bounds: { xmin: xs[0], xmax: xs[xs.length - 1], ymin: ys[0], ymax: ys[ys.length - 1] } }
}

export function gridValues(grid) {
	const out = []
	grid.z.forEach(row => row.forEach(v => { if (v !== null) out.push(v) }))
	return out
}

export function gridStats(grid) {
	const v = gridValues(grid)
	const total = grid.nx * grid.ny
	if (!v.length) return { n: 0, missing: total, min: null, max: null, range: null, mean: null, rms: null, stdev: null }
	const mean = v.reduce((a, b) => a + b, 0) / v.length
	const rms = Math.sqrt(v.reduce((a, b) => a + b * b, 0) / v.length)
	const stdev = v.length > 1 ? Math.sqrt(v.reduce((a, b) => a + (b - mean) * (b - mean), 0) / (v.length - 1)) : 0
	const min = Math.min.apply(null, v)
	const max = Math.max.apply(null, v)
	return { n: v.length, missing: total - v.length, min, max, range: max - min, mean, rms, stdev }
}

export function qualityThresholds(profile) {
	const p = profile || {}
	const warn = typeof p.warn_range_mm === 'number' && p.warn_range_mm > 0 ? p.warn_range_mm : DEFAULT_QUALITY.warnRange
	const bad = typeof p.bad_range_mm === 'number' && p.bad_range_mm > warn ? p.bad_range_mm : Math.max(DEFAULT_QUALITY.badRange, warn * 2)
	return { warnRange: warn, badRange: bad }
}

// 'good' | 'warn' | 'bad' | 'partial' | 'unknown' (a mesh with unprobed points is "partial" and is not offered for loading)
export function qualityOf(stats, th) {
	if (!stats || stats.n === 0 || stats.range === null) return 'unknown'
	if (stats.missing > 0) return 'partial'
	if (stats.range > th.badRange) return 'bad'
	return stats.range > th.warnRange ? 'warn' : 'good'
}

const QUALITY_VIEW = {
	good: { color: 'success', icon: 'mdi-check-circle' },
	warn: { color: 'warning', icon: 'mdi-alert' },
	bad: { color: 'error', icon: 'mdi-close-octagon' },
	partial: { color: 'error', icon: 'mdi-grid-off' },
	unknown: { color: 'grey', icon: 'mdi-help-circle-outline' }
}

export function qualityView(stats, th) {
	const q = qualityOf(stats, th)
	return Object.assign({ quality: q, textKey: 'mesh.quality_' + q }, QUALITY_VIEW[q])
}

// bed rectangle {xmin, xmax, ymin, ymax} from DWC's move.axes (letters X and Y with min / max), else from the grid, else null
export function bedOf(axes, grid) {
	const find = letter => (Array.isArray(axes) ? axes.find(a => a && a.letter === letter && typeof a.min === 'number' && typeof a.max === 'number' && a.max > a.min) : null)
	const x = find('X')
	const y = find('Y')
	if (x && y) return { xmin: x.min, xmax: x.max, ymin: y.min, ymax: y.max }
	return grid ? Object.assign({}, grid.bounds) : null
}

function wholeIn(v, lo, hi) {
	const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v
	return typeof n === 'number' && isFinite(n) && Math.floor(n) === n && n >= lo && n <= hi ? n : null
}

function numberOf(v) {
	const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v
	return typeof n === 'number' && isFinite(n) ? n : null
}

// inputs {mode: 'bed' | 'region', nx, ny, probe, region: {xmin, xmax, ymin, ymax}} -> {params, errors, ok}
export function probeParams(inputs, bed) {
	const i = inputs || {}
	const errors = {}
	const nx = wholeIn(i.nx === undefined || i.nx === '' ? 5 : i.nx, POINTS.min, POINTS.max)
	const ny = wholeIn(i.ny === undefined || i.ny === '' ? 5 : i.ny, POINTS.min, POINTS.max)
	const probe = wholeIn(i.probe === undefined || i.probe === '' ? 0 : i.probe, 0, 15)
	if (nx === null) errors.nx = 'mesh.err_points'
	if (ny === null) errors.ny = 'mesh.err_points'
	if (probe === null) errors.probe = 'mesh.err_probe'
	const params = { mode: i.mode === 'region' ? 'region' : 'bed', points: [nx || 5, ny || 5], probe: probe || 0 }
	if (params.mode === 'region') {
		const r = i.region || {}
		const reg = { xmin: numberOf(r.xmin), xmax: numberOf(r.xmax), ymin: numberOf(r.ymin), ymax: numberOf(r.ymax) }
		const ordered = reg.xmin !== null && reg.ymin !== null && reg.xmax > reg.xmin && reg.ymax > reg.ymin
		const inside = !bed || (ordered && reg.xmin >= bed.xmin && reg.xmax <= bed.xmax && reg.ymin >= bed.ymin && reg.ymax <= bed.ymax)
		if (!ordered || !inside) errors.region = 'mesh.err_region'
		params.region = reg
	}
	return { params, errors, ok: !Object.keys(errors).length }
}

export function taperParams(value) {
	const h = wholeIn(value === undefined || value === '' ? 0 : value, TAPER.min, TAPER.max)
	return h === null ? { ok: false, errorKey: 'mesh.err_taper', height: 0 } : { ok: true, errorKey: null, height: h }
}

export function saveName(value) {
	const name = String(value || '').trim()
	return NAME_RX.test(name) ? { ok: true, name, errorKey: null } : { ok: false, name, errorKey: 'mesh.err_name' }
}

// a mesh can be loaded when it is a complete grid; the library row says which one is active
export function canLoad(row, grid) {
	return !!row && !row.active && (!grid || gridStats(grid).missing === 0)
}
