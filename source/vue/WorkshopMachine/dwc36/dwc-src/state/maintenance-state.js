'use strict'

// The explicit state of the Maintenance module: plain object + plain functions, no Vue, no network.
//   status    'idle' | 'loading' | 'ready' | 'error'
//   data      machine.maintenance.get as the api normalized it, or null
//   error     {key, detail}
//   marking   id of the item whose "done" is being sent, or ''
//   editing   true while the plan is edited; `drafts` is the plan being edited (lib/maintenance-plan.js), `notify` the opt-in phone notice
//   original  the drafts and notify at the start of the edit (to know whether anything changed)
//   saving    true while the plan is sent;  planErrors  [{row, code}] of the last check

import { draftFromItem, newDraft, draftErrors, itemsFromDrafts, isChanged, MAX_ITEMS } from '../lib/maintenance-plan.js'

export function createMaintenanceState() {
	return { status: 'idle', data: null, error: null, marking: '', editing: false, drafts: [], notify: false, original: null, saving: false, planErrors: [] }
}

export function loadBegin(state) {
	state.status = 'loading'
	state.error = null
	return state
}

export function loaded(state, data) {
	state.data = data
	state.status = 'ready'
	return state
}

export function loadFailed(state, key, detail) {
	state.status = 'error'
	state.error = { key, detail: detail || '' }
	return state
}

export function markBegin(state, id) {
	state.marking = id
	return state
}

// the answer of "done" ({item}): the item (counters at zero, status ok, who and when) replaces the old one; the summary is read again by the module
export function markDone(state, answer) {
	state.marking = ''
	if (state.data && answer && answer.item) {
		state.data.items = state.data.items.map(i => (i.id === answer.item.id ? answer.item : i))
	}
	return state
}

export function markFailed(state) {
	state.marking = ''
	return state
}

// `labelOf(item)`: the translated name of an item that has none of its own
export function editBegin(state, labelOf) {
	state.drafts = state.data ? state.data.items.map(i => draftFromItem(i, labelOf ? labelOf(i) : '')) : []
	state.notify = !!(state.data && state.data.notify)
	state.original = JSON.stringify({ drafts: state.drafts, notify: state.notify })
	state.planErrors = []
	state.editing = true
	return state
}

export function editCancel(state) {
	state.editing = false
	state.drafts = []
	state.original = null
	state.planErrors = []
	return state
}

export function addDraft(state) {
	if (state.drafts.length < MAX_ITEMS) state.drafts.push(newDraft())
	return state
}

export function removeDraft(state, row) {
	state.drafts.splice(row, 1)
	return state
}

export function canSave(state) {
	return state.editing && !state.saving && state.original !== null && isChanged(JSON.stringify({ drafts: state.drafts, notify: state.notify }), state.original)
}

// the items to send, or null (with planErrors set) when the check fails
export function checkedItems(state) {
	state.planErrors = draftErrors(state.drafts)
	return state.planErrors.length ? null : itemsFromDrafts(state.drafts)
}

export function saveBegin(state) {
	state.saving = true
	return state
}

export function saveDone(state) {
	state.saving = false
	state.editing = false
	state.drafts = []
	state.original = null
	return state
}

export function saveFailed(state) {
	state.saving = false
	return state
}
