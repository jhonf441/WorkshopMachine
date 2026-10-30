'use strict'

// Height calibration of the tool: what the Height page decides without touching the browser or the service. Pure; the module draws and
// calls `api.height` (api/machine-api-p8.js). Numbers and limits are the ones of the service (machine_height.py), which is the one that enforces them.

export const ADJUST_MAX = 3
export const PAPER_MAX = 3
export const MARK_HEIGHT = 5 // mm above the surface after marking with the paper (the macro's default)
export const JOG_STEPS = [-5, -1, -0.1, -0.05, 0.05, 0.1, 1, 5]
export const NUDGE = 0.05
export const ASK_KEY = 'workshopHeightPoint' // one-shot: the Workbench leaves {x, y} here when it sends the person to this page
const MACROS_OF = { k0: ['goto', 'mark', 'probe'], paper: ['goto', 'mark'], szp: ['szp'] } // the macros of the SD each assistant needs
export const METHODS = ['bltouch', 'paper', 'szp'] // height.method_<m> and height.note_<m>
export const BLOCK_REASONS = ['loading', 'not_current', 'macro_missing', 'not_homed', 'no_probe', 'no_szp'] // height.block_<reason>
export const WIZARD_STEPS = { k0: ['goto', 'lower', 'measure', 'save'], paper: ['goto', 'lower'] }

export function round3(v) {
	return Math.round(v * 1000) / 1000
}

// the data of one mode of the page: what is saved plus what the machine says now
export function modeView(h, mode) {
	const data = (h && h.data && h.data.modes[mode]) || { method: 'bltouch', setting: 0, k0: null, szp: null }
	const current = !!h && h.mode === mode
	return {
		mode, data, current,
		methods: mode === 'FFF' ? ['bltouch', 'paper', 'szp'] : ['bltouch', 'paper'],
		probe: current && h ? h.probes.find(p => p.index === 0) || null : null,
		szpProbe: current && mode === 'FFF' && h ? h.probes.find(p => p.index === 1) || null : null
	}
}

// the first reason an assistant of `kind` ('k0' BLTouch, 'paper', 'szp') cannot start now ('' = it can): a key of height.block_<reason>
export function blockReason(h, view, kind) {
	if (!h) return 'loading'
	if (!view.current) return 'not_current'
	if (!MACROS_OF[kind].every(k => h.macros[k])) return 'macro_missing'
	if (!(h.homed.X && h.homed.Y && h.homed.Z)) return 'not_homed'
	if (kind === 'k0' && !view.probe) return 'no_probe'
	if (kind === 'szp' && !view.szpProbe) return 'no_szp'
	return ''
}

// the point of the assistants: the one the Workbench asked for, else the middle of the reach, else 0 0; always inside the reach
export function clampPoint(point, reach) {
	const p = { x: Number(point.x), y: Number(point.y) }
	if (!isFinite(p.x) || !isFinite(p.y)) return { x: 0, y: 0, clamped: true }
	if (!reach) return { x: round3(p.x), y: round3(p.y), clamped: false }
	const x = Math.min(reach.xMax, Math.max(reach.xMin, p.x))
	const y = Math.min(reach.yMax, Math.max(reach.yMin, p.y))
	return { x: round3(x), y: round3(y), clamped: x !== p.x || y !== p.y }
}

export function defaultPoint(h, asked) {
	const reach = h && h.reach
	if (asked) return clampPoint(asked, reach)
	if (reach) return clampPoint({ x: (reach.xMin + reach.xMax) / 2, y: (reach.yMin + reach.yMax) / 2 }, reach)
	return { x: 0, y: 0, clamped: false }
}

// {x, y} left by the Workbench (a string of the storage), or null
export function askedPoint(text) {
	try {
		const v = JSON.parse(text)
		return v && isFinite(v.x) && isFinite(v.y) ? { x: Number(v.x), y: Number(v.y) } : null
	} catch (e) {
		return null
	}
}

// a typed number: {ok, value} or {ok: false, errorKey}
export function parseAdjust(text) {
	const v = Number(String(text).replace(',', '.'))
	if (String(text).trim() === '' || !isFinite(v) || Math.abs(v) > ADJUST_MAX) return { ok: false, errorKey: 'height.err_adjust' }
	return { ok: true, value: round3(v) }
}

export function parsePaper(text) {
	const v = Number(String(text).replace(',', '.'))
	if (String(text).trim() === '' || !isFinite(v) || v < 0 || v > PAPER_MAX) return { ok: false, errorKey: 'height.err_paper' }
	return { ok: true, value: round3(v) }
}

export function nudged(text, step) {
	const v = Number(String(text).replace(',', '.'))
	return String(round3((isFinite(v) ? v : 0) + step))
}

// the record of a BLTouch calibration: the G31 K0 of the mode with the trigger height measured
export function k0Record(measured, probe, today) {
	return { p: probe && probe.threshold !== null ? Math.round(probe.threshold) : 500, x: probe ? probe.offsetX : 0, y: probe ? probe.offsetY : 0, z: round3(measured), date: today }
}

// how far the new trigger height is from the one in use: more than a millimetre deserves a second look at the paper
export function triggerShift(measured, probe) {
	if (!probe || probe.triggerHeight === null) return { diff: null, suspicious: false }
	const diff = round3(Math.abs(measured - probe.triggerHeight))
	return { diff, suspicious: diff > 1 }
}

export function szpRecord(s, r, today) {
	const si = Number(s)
	const ri = Number(r)
	if (!(Number.isInteger(si) && si >= 1 && si <= 31) || !Number.isInteger(ri)) return null
	return { s: si, r: ri, date: today }
}

// the S and R the macro printed (any text with "S <n>" and "R <n>")
export function parseSzpOutput(text) {
	const m = /S\s*[=:]?\s*(\d+)[^\d]+R\s*[=:]?\s*(-?\d+)/i.exec(String(text || '')) || /drive level[^\d]*(\d+)[^\d]+(?:offset|reading)[^\d-]*(-?\d+)/i.exec(String(text || ''))
	return m ? { s: parseInt(m[1], 10), r: parseInt(m[2], 10) } : null
}

// the modes whose file does not load the calibration yet
export function hookMissing(h) {
	return h ? ['Laser', 'CNC', 'FFF'].filter(m => h.hooks[m] === false) : []
}

export function changeOf(mode, patch, extra) {
	return Object.assign({ modes: { [mode]: patch } }, extra || {})
}

export function todayText(now) {
	const d = now || new Date()
	const p = n => (n < 10 ? '0' : '') + n
	return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate())
}
