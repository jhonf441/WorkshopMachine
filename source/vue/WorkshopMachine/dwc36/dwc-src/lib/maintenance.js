'use strict'

// Maintenance module logic (design 2.10): due markers of the plan, the counters table, the overview light. Pure.
// The service decides the status of each item (ok | due_soon | due | overdue: machine_maintenance.py, from 0.9, 1.0 and 1.25 of the
// interval); the page only shows it. If an old service sends no status, the ratio is read with the same thresholds.

export const STATES = ['ok', 'due_soon', 'due', 'overdue']
export const SOON_AT = 0.9
export const OVERDUE_AT = 1.25
// the items the service ships as defaults have their own texts (label_key machine_maint_item_<id>); the plugin translates them
export const DEFAULT_ITEMS = ['z_screws', 'belts', 'lens', 'z_couplers']

const VIEWS = {
	ok: { color: 'success', icon: 'mdi-check-circle' },
	due_soon: { color: 'info', icon: 'mdi-clock-outline' },
	due: { color: 'warning', icon: 'mdi-alert' },
	overdue: { color: 'error', icon: 'mdi-alert-octagon' },
	unknown: { color: 'grey', icon: 'mdi-help-circle-outline' }
}

// colour is never the only signal: icon and text key change with the state too
export function dueView(state) {
	const s = VIEWS[state] ? state : 'unknown'
	return Object.assign({ state: s, textKey: 'maintenance.state_' + s }, VIEWS[s])
}

export function stateOfRatio(ratio) {
	if (ratio === null || ratio === undefined || !isFinite(ratio)) return 'unknown'
	if (ratio >= OVERDUE_AT) return 'overdue'
	if (ratio >= 1) return 'due'
	return ratio >= SOON_AT ? 'due_soon' : 'ok'
}

// the text key of an item's name when it is one of the defaults and the owner gave no text; null otherwise
export function defaultLabelKey(item) {
	return !item.label && DEFAULT_ITEMS.indexOf(item.id) >= 0 ? 'maintenance.item_' + item.id : null
}

// one row per plan item: {id, label, labelKey, axis, interval, used, remaining, ratio, view, lastDone}
export function planRows(data) {
	if (!data) return []
	return data.items.map(item => {
		const state = item.status && VIEWS[item.status] ? item.status : stateOfRatio(item.ratio)
		return {
			id: item.id, label: item.label, labelKey: defaultLabelKey(item), axis: item.axis, interval: item.interval, used: item.used, remaining: item.remaining,
			ratio: item.ratio, view: dueView(state), lastDone: item.lastDone
		}
	})
}

// the light of the overview card: from machine.overview `maintenance` ({worst, due, dueSoon}); null when the service does not send it
export function overviewLight(overview) {
	const m = overview && overview.maintenance
	if (!m) return null
	return Object.assign({ due: m.due || 0, dueSoon: m.dueSoon || 0 }, dueView(m.worst))
}

// rows of the counters table: the whole machine first, then the axes in machine order; a missing number stays null (shown as "-")
export function counterRows(data) {
	if (!data) return []
	const order = 'XYZUVWABC'
	const axes = data.counters.axes.slice().sort((a, b) => order.indexOf(a.axis) - order.indexOf(b.axis) || a.axis.localeCompare(b.axis))
	return [Object.assign({ axis: '', whole: true }, data.counters.board)].concat(axes.map(a => Object.assign({ whole: false }, a)))
}

// the last-done marks, newest first: {id, label, labelKey, ts, user, role}
export function historyRows(data) {
	if (!data) return []
	return planRows(data).filter(r => r.lastDone && r.lastDone.ts).map(r => Object.assign({ id: r.id, label: r.label, labelKey: r.labelKey }, r.lastDone))
		.sort((a, b) => (b.ts || 0) - (a.ts || 0))
}

// "the job path the service integrated against the planned path": a ratio far from 1 means the sampling or the file disagree
export function crosscheckView(crosscheck) {
	if (!crosscheck || crosscheck.ratio === null) return null
	return { ratio: crosscheck.ratio, textKey: crosscheck.ratio < 0.5 ? 'maintenance.cross_low' : crosscheck.ratio > 1.5 ? 'maintenance.cross_high' : 'maintenance.cross_ok' }
}
