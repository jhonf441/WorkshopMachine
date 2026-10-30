'use strict'

// Safety diagnosis module logic (design 2.9): the severity of each item of the safety.check result, the order of the table, the text of
// each item and of its fix action. The check is read only and never moves anything. Pure.
//
// Result of the run (docs/MACHINE-PHASE2-CONTRACT.md): {generatedAt, verdict, counts, items: [{id, severity, action, values}]}

// the items the service reports, in its order; an id this page does not know is shown by its name (safety.item_other)
export const CHECK_IDS = [
	'kinematics', 'homed', 'z_motors', 'probe', 'probe_offsets', 'reach', 'endstops', 'heaters', 'sensors', 'status', 'reset_reason', 'supply',
	'job', 'interlocks', 'config_guard'
]

// the keys of the action an item asks for (items with severity warn or bad); each has its own text safety.action_<key>
export const ACTIONS = [
	'home_axes', 'open_levelling', 'check_probe', 'check_probe_offsets', 'check_limits', 'check_endstops', 'see_heaters', 'see_sensors', 'reset_board',
	'fix_startup_error', 'check_supply', 'close_interlocks', 'declare_interlocks', 'check_config_guard', 'kinematics_unsupported'
]

// the module of this page where the action can be done (ids of lib/gating.js MODULES)
const GOTO = { open_levelling: 'level', check_probe: 'probe', check_probe_offsets: 'probe', check_limits: 'limits', check_endstops: 'limits' }

export const SEVERITIES = ['ok', 'info', 'warn', 'bad', 'unavailable']
export const VERDICTS = ['ok', 'warn', 'bad']

const RANK = { bad: 4, warn: 3, unavailable: 2, info: 1, ok: 0 }
const VIEW = {
	ok: { color: 'success', icon: 'mdi-check-circle' },
	info: { color: 'info', icon: 'mdi-information-outline' },
	warn: { color: 'warning', icon: 'mdi-alert' },
	bad: { color: 'error', icon: 'mdi-close-octagon' },
	unavailable: { color: 'grey', icon: 'mdi-help-circle-outline' }
}

// colour is never the only signal: the icon and the word change with the severity
export function severityView(severity) {
	const s = VIEW[severity] ? severity : 'info'
	return Object.assign({ severity: s, rank: RANK[s], textKey: 'safety.sev_' + s }, VIEW[s])
}

// worst first, the order of CHECK_IDS inside the same severity
export function sortItems(items) {
	const pos = id => (CHECK_IDS.indexOf(id) >= 0 ? CHECK_IDS.indexOf(id) : CHECK_IDS.length)
	return (items || []).slice().sort((a, b) => severityView(b.severity).rank - severityView(a.severity).rank || pos(a.id) - pos(b.id))
}

// {ok, info, warn, bad, unavailable, worst, total}
export function summaryOf(items) {
	const out = { ok: 0, info: 0, warn: 0, bad: 0, unavailable: 0, worst: 'ok', total: 0 }
	;(items || []).forEach(i => {
		const s = severityView(i.severity).severity
		out[s]++
		out.total++
		if (RANK[s] > RANK[out.worst]) out.worst = s
	})
	return out
}

// the small numbers and codes of an item as text: "axes: X, Y; vin: 24.1"
export function valuesText(values) {
	const part = v => (Array.isArray(v) ? v.map(part).join(', ') : v && typeof v === 'object' ? JSON.stringify(v) : typeof v === 'number' ? String(Math.round(v * 1000) / 1000) : String(v))
	return Object.keys(values || {}).map(k => k + ': ' + part(values[k])).join('; ')
}

// The same numbers and codes as parts of a sentence: [{key, params, raw}]. `key` is a text of this page (safety.d_* / safety.reason_*);
// a param is a plain value or {group, value}, a word the page says as safety.<group>_<value> (the raw value when there is no text for it).
const rounded = v => (typeof v === 'number' && isFinite(v) ? Math.round(v * 1000) / 1000 : null)
const listOf = v => (Array.isArray(v) ? v.join(', ') : '')
const word = (group, value) => ({ group, value })

export function detailParts(item) {
	const v = item.values || {}
	const out = []
	const add = (key, params) => out.push({ key: 'safety.d_' + key, params })
	if (v.reason) out.push({ key: 'safety.reason_' + v.reason, params: {}, raw: String(v.reason) })
	switch (item.id) {
		case 'kinematics':
			if (v.name) add('kinematics', { name: word('kin', v.name) })
			break
		case 'homed':
			if (listOf(v.axes)) add('homed_pending', { axes: listOf(v.axes) })
			break
		case 'z_motors':
			if (v.z_motors !== undefined && v.z_motors !== null) add('z_motors', { z_motors: v.z_motors, entries: v.m671_entries || 0, mode: word('levelling', v.mode) })
			break
		case 'probe':
			if (v.probe !== undefined && v.probe !== null) add('probe', { probe: v.probe, type: word('probe_type', v.type) })
			if (rounded(v.value) !== null) add('probe_value', { value: rounded(v.value) })
			if (rounded(v.trigger_height) !== null) add('probe_trigger', { height: rounded(v.trigger_height) })
			break
		case 'probe_offsets':
			if (rounded(v.x) !== null && rounded(v.y) !== null) add('offset_xy', { x: rounded(v.x), y: rounded(v.y) })
			if (rounded(v.bed_x) !== null && rounded(v.bed_y) !== null) add('bed_size', { bed_x: rounded(v.bed_x), bed_y: rounded(v.bed_y) })
			break
		case 'reach':
			if ([v.xmin, v.xmax, v.ymin, v.ymax].every(n => rounded(n) !== null)) add('reach', { xmin: rounded(v.xmin), xmax: rounded(v.xmax), ymin: rounded(v.ymin), ymax: rounded(v.ymax) })
			break
		case 'endstops':
			if (listOf(v.triggered_away_from_home)) add('endstop_away', { axes: listOf(v.triggered_away_from_home) })
			if (listOf(v.without_endstop)) add('endstop_missing', { axes: listOf(v.without_endstop) })
			break
		case 'heaters':
			if (v.count) add('heaters_count', { count: v.count })
			if (listOf(v.fault)) add('heaters_fault', { list: listOf(v.fault) })
			if (listOf(v.offline)) add('heaters_offline', { list: listOf(v.offline) })
			break
		case 'sensors':
			;(v.sensors || []).forEach(s => add('sensor', { name: s.name || '-', index: s.index, state: word('sensor_state', s.state) }))
			break
		case 'status':
			if (v.status) add('status', { status: word('status', v.status) })
			break
		case 'job':
			add(v.status ? 'status' : 'job_none', v.status ? { status: word('status', v.status) } : {})
			break
		case 'supply':
			if (rounded(v.vin) !== null) add('supply_now', { vin: rounded(v.vin) })
			if (rounded(v.min) !== null && rounded(v.max) !== null) add('supply_range', { min: rounded(v.min), max: rounded(v.max) })
			break
		case 'interlocks':
			if (v.count) add('interlock_count', { count: v.count })
			;(v.interlocks || []).forEach(i => add('interlock', { name: i.name, state: word('interlock', i.state) }))
			break
		case 'config_guard':
			if (rounded(v.remaining_s) !== null) add('guard_remaining', { s: rounded(v.remaining_s) })
			if (v.failure) add('guard_failure', { failure: typeof v.failure === 'string' ? v.failure : JSON.stringify(v.failure) })
			break
		default:
			break
	}
	return out
}

// The sentence(s) of an item for the page, in its language. `t` is the page's translator (key -> text; a missing key answers
// 'plugins.WorkshopMachine.<key>'). Nothing is left in English: a code without text is shown as it is, but every known one has its own.
export function detailText(parts, t) {
	const text = (key, params) => {
		const s = t(key, params)
		return s === 'plugins.WorkshopMachine.' + key ? null : s
	}
	return (parts || []).map(p => {
		const params = {}
		Object.keys(p.params || {}).forEach(k => {
			const x = p.params[k]
			if (x && typeof x === 'object') {
				const w = text('safety.' + x.group + '_' + x.value)
				params[k] = w === null ? String(x.value) : w
			} else params[k] = x
		})
		const s = text(p.key, params)
		return s === null ? p.raw || '' : s
	}).filter(Boolean).join('; ')
}

// the table row of one item: {id, severity, severityKey, color, icon, textKey, actionKey, detail (raw), parts (see detailParts), goto}
export function itemView(item) {
	const known = CHECK_IDS.indexOf(item.id) >= 0
	const sev = severityView(item.severity)
	const action = ACTIONS.indexOf(item.action) >= 0 ? item.action : null
	return {
		id: item.id, severity: sev.severity, severityKey: sev.textKey, color: sev.color, icon: sev.icon,
		textKey: 'safety.item_' + (known ? item.id : 'other'), name: item.id, known,
		actionKey: action && sev.rank >= RANK.warn ? 'safety.action_' + action : null, detail: valuesText(item.values), parts: detailParts(item),
		goto: action && GOTO[action] ? GOTO[action] : null
	}
}

export function checkRows(result) {
	return sortItems(result ? result.items : []).map(itemView)
}
