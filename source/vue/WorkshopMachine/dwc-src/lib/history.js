'use strict'

// History module logic (design 2.11): the kinds of record, the filters of the list, one row of the list. Pure.
// The service filters (machine.history.list); applyFilters repeats the same rules on the rows so the list never shows something the
// person excluded, whatever an older service answers.

import { dayToEpoch } from './format.js'

// every kind a record can have (WorkshopService dsf/machine_store.py KINDS); each has its own text kinds.<kind with the dot as _>
export const KNOWN_KINDS = [
	'probe.read', 'probe.repeat', 'probe.accuracy', 'probe.trigger', 'probe.offset', 'level.g32', 'level.g30', 'level.measure', 'mesh.probe',
	'homing.verify', 'homing.repeat', 'offsets.verify',
	'config.g31', 'config.m671', 'config.bed', 'config.g10', 'config.m557', 'config.m593', 'config.m425', 'config.m556', 'config.m376',
	'config.workplaces', 'config.m208', 'config.m92', 'config.m906', 'config.m913', 'config.m917', 'config.m569', 'config.m584',
	'safety.check', 'offsets.snapshot', 'laser.pointer'
]

export const STATES = ['done', 'partial', 'stopped', 'error']
export const PAGE_SIZE = 50

// the text key of a kind, or null for a kind this page does not know (the row then shows the raw kind)
export function kindKey(kind) {
	return KNOWN_KINDS.indexOf(kind) >= 0 ? 'kinds.' + kind.replace('.', '_') : null
}

const STATE_VIEW = {
	done: { color: 'success', icon: 'mdi-check-circle' },
	partial: { color: 'warning', icon: 'mdi-alert' },
	stopped: { color: 'warning', icon: 'mdi-stop-circle-outline' },
	error: { color: 'error', icon: 'mdi-close-octagon' }
}

export function stateView(state) {
	const s = STATE_VIEW[state] ? state : 'error'
	return Object.assign({ state: s, textKey: 'history.state_' + s }, STATE_VIEW[s])
}

// the form {kind, user, state, fromDay, toDay} -> the arguments of machine.history.list
export function listArgs(filters, offset) {
	const f = filters || {}
	const args = { limit: PAGE_SIZE }
	if (f.kind) args.kind = f.kind
	if (f.user && String(f.user).trim()) args.user = String(f.user).trim()
	if (f.state) args.state = f.state
	const since = dayToEpoch(f.fromDay, false)
	const until = dayToEpoch(f.toDay, true)
	if (since !== null) args.since = since
	if (until !== null) args.until = until
	if (offset) args.offset = offset
	return args
}

export function applyFilters(records, filters) {
	const a = listArgs(filters)
	return (records || []).filter(r => (!a.kind || r.kind === a.kind) && (!a.user || r.user === a.user) && (!a.state || r.state === a.state)
		&& (a.since === undefined || (r.ts !== null && r.ts >= a.since)) && (a.until === undefined || (r.ts !== null && r.ts <= a.until)))
}

// newest first
export function sortRecords(records) {
	return (records || []).slice().sort((x, y) => (y.ts || 0) - (x.ts || 0))
}

// the distinct kinds / users of the rows, for the filter menus
export function distinct(records, field) {
	return Array.from(new Set((records || []).map(r => r[field]).filter(Boolean))).sort()
}

// why a record cannot be restored (history.get restore.reason); an unknown one has its own fallback text
export const RESTORE_REASONS = ['not_restorable', 'not_applied', 'no_value']

export function restoreReasonKey(reason) {
	return 'history.reason_' + (RESTORE_REASONS.indexOf(reason) >= 0 ? reason : 'other')
}

// the row of the list says whether the service can restore it (the service decides, from the kind and what the record kept)
export function canRestore(record) {
	return !!record && record.restorable === true
}

// two records can be compared when they are of the same kind and not the same record
export function canCompare(a, b) {
	return !!a && !!b && a.id !== b.id && a.kind === b.kind
}
