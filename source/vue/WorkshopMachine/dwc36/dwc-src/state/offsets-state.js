'use strict'

// The explicit state of the Offsets module: plain object + plain functions, no Vue, no network.
//   status     'idle' | 'loading' | 'ready' | 'error'
//   data       normalizeOffsets(...): {tools, workplaces, current, axes, lastSnapshot}
//   drafts     {tools: {key: {axis: text}}, work: {...}} what the person is typing
//   target     where the work offsets are written: 'macro' (workshop-offsets.g) or 'config' (the file that has the G10 L2 lines)
//   snapshots  Briefs of the snapshots (newest first);  pick {a, b}  ids chosen to compare;  comparison  the last compare answer or null
//   error      {key, detail}
//   pointer    the laser <-> pointer assistant: {inputs: {power}, mark: {head, powerPct} | null, captured: capture answer | null}

import { axesOf, draftOf, changedSets, KIND_TOOLS, KIND_WORK } from '../lib/offsets.js'
import { DEFAULT_POWER } from '../lib/laser-pointer.js'

function freshPointer() {
	return { inputs: { power: String(DEFAULT_POWER) }, mark: null, captured: null }
}

export function createOffsetsState() {
	return { status: 'idle', data: null, drafts: { tools: {}, work: {} }, target: 'macro', snapshots: [], pick: { a: '', b: '' }, comparison: null, error: null, pointer: freshPointer() }
}

export function loadBegin(state) {
	state.status = 'loading'
	state.error = null
	return state
}

export function loaded(state, data) {
	state.data = data
	state.status = 'ready'
	resetDrafts(state)
	return state
}

export function loadFailed(state, key, detail) {
	state.status = 'error'
	state.error = { key, detail: detail || '' }
	return state
}

export function setsOf(state, which) {
	return state.data ? (which === 'tools' ? state.data.tools : state.data.workplaces) : []
}

export function axesFor(state, which) {
	return axesOf(setsOf(state, which))
}

export function resetDrafts(state) {
	const d = state.data || { tools: [], workplaces: [] }
	state.drafts = { tools: draftOf(d.tools, axesOf(d.tools)), work: draftOf(d.workplaces, axesOf(d.workplaces)) }
	return state
}

// what the person changed in one table: [{key, set, offsets, errors}]
export function changesFor(state, which) {
	const sets = setsOf(state, which)
	return changedSets(sets, which === 'tools' ? state.drafts.tools : state.drafts.work, axesOf(sets))
}

export function kindFor(which) {
	return which === 'tools' ? KIND_TOOLS : KIND_WORK
}

// two different snapshots chosen to compare, older first by the order the person chose them
export function pickedPair(state) {
	return state.pick.a && state.pick.b && state.pick.a !== state.pick.b ? [state.pick.a, state.pick.b] : null
}

export function pointerMarked(state, mark) {
	state.pointer.mark = mark
	state.pointer.captured = null
	return state
}

export function pointerCaptured(state, captured) {
	state.pointer.captured = captured
	return state
}

export function pointerReset(state) {
	state.pointer = freshPointer()
	return state
}
