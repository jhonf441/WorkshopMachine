'use strict'

// The explicit state of the Offsets module: plain object + plain functions, no Vue, no network.
//   status     'idle' | 'loading' | 'ready' | 'error'
//   data       normalizeOffsets(...): {tools, workplaces, current, axes, lastSnapshot}
//   drafts     {tools: {key: {axis: text}}} what the person is typing (the work systems are read only here: they are edited in the Workbench)
//   snapshots  Briefs of the snapshots (newest first);  pick {a, b}  ids chosen to compare;  comparison  the last compare answer or null
//   error      {key, detail}
//   pointer    the laser <-> pointer assistant: {inputs: {power}, mark: {head, powerPct} | null, captured: capture answer | null}

import { axesOf, draftOf, changedSets } from '../lib/offsets.js'
import { DEFAULT_POWER } from '../lib/laser-pointer.js'

function freshPointer() {
	return { inputs: { power: String(DEFAULT_POWER) }, mark: null, captured: null }
}

export function createOffsetsState() {
	return { status: 'idle', data: null, drafts: { tools: {} }, snapshots: [], pick: { a: '', b: '' }, comparison: null, error: null, pointer: freshPointer() }
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
	const tools = state.data ? state.data.tools : []
	state.drafts = { tools: draftOf(tools, axesOf(tools)) }
	return state
}

// what the person changed in the tools table: [{key, set, offsets, errors}]
export function changesFor(state) {
	const sets = setsOf(state, 'tools')
	return changedSets(sets, state.drafts.tools, axesOf(sets))
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
