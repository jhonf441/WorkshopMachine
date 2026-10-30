'use strict'

// The explicit state of the History module: plain object + plain functions, no Vue, no network.
//   status    'idle' | 'loading' | 'ready' | 'error'
//   filters   {kind, user, fromDay, toDay}
//   records   the rows of the list (normalized Briefs), newest first;  total  rows the service has for the filters
//   selected  ids ticked for the comparison (at most two, in the order ticked)
//   detail    {record, restore} of the record being looked at (history.get), or null
//   error     {key, detail}

import { sortRecords, applyFilters, canCompare } from '../lib/history.js'

export const MAX_SELECTED = 2

export function createHistoryState() {
	return { status: 'idle', filters: { kind: '', user: '', state: '', fromDay: '', toDay: '' }, records: [], total: 0, selected: [], detail: null, error: null }
}

export function loadBegin(state) {
	state.status = 'loading'
	state.error = null
	return state
}

export function loaded(state, answer) {
	state.records = sortRecords(applyFilters(answer.records, state.filters))
	state.total = answer.total
	state.selected = state.selected.filter(id => state.records.some(r => r.id === id))
	state.status = 'ready'
	return state
}

export function loadFailed(state, key, detail) {
	state.status = 'error'
	state.error = { key, detail: detail || '' }
	return state
}

// ticking a third row drops the oldest tick, so two are always the last two the person chose
export function toggleSelected(state, id) {
	const at = state.selected.indexOf(id)
	if (at >= 0) state.selected.splice(at, 1)
	else {
		state.selected.push(id)
		if (state.selected.length > MAX_SELECTED) state.selected.shift()
	}
	return state
}

export function selectedRecords(state) {
	return state.selected.map(id => state.records.find(r => r.id === id)).filter(Boolean)
}

// the pair to compare, older first, when the two ticked rows can be compared
export function comparePair(state) {
	const rows = selectedRecords(state)
	if (rows.length !== MAX_SELECTED || !canCompare(rows[0], rows[1])) return null
	return rows.slice().sort((a, b) => (a.ts || 0) - (b.ts || 0))
}

export function openDetail(state, detail) {
	state.detail = detail
	return state
}

export function closeDetail(state) {
	state.detail = null
	return state
}
