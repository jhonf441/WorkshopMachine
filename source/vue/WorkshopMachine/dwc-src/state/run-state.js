'use strict'

// The explicit state of a module that runs procedures (design 3.6): plain object + plain functions, no Vue, no network.
//   status   'idle' | 'starting' | 'active' | 'stopping' | 'done' | 'error' | 'aborted'
//   inputs   what the person typed (draft)
//   run      the run being followed (normalized), also after it finished, until another one starts
//   result   run.result of the run followed
//   error    {key, params} of a refusal at start (not of a run that ended in error: that one is in run.errorCode)
//   foreign  the active run of another module, or null
// The page never keeps the truth of a sequence: after a reload adoptRuns() takes it again from machine.runs.

import { pickRun, foreignRun, statusOf, isActive } from '../lib/runs.js'

export function createRunState(kinds, inputs) {
	return { kinds: kinds.slice(), status: 'idle', inputs: Object.assign({}, inputs), run: null, result: null, error: null, foreign: null, stopAsked: false }
}

// takes a machine.runs answer (normalizeRuns) into the state
export function adoptRuns(state, view) {
	state.foreign = foreignRun(view, state.kinds)
	const picked = pickRun(view, state.kinds)
	if (state.status === 'starting' && !picked.run) return state
	state.run = picked.run
	state.result = picked.run ? picked.run.result : null
	state.status = statusOf(picked.run)
	if (!isActive(picked.run)) state.stopAsked = false
	if (picked.run) state.error = null
	return state
}

export function beginStart(state) {
	state.status = 'starting'
	state.error = null
	state.stopAsked = false
	return state
}

export function startFailed(state, key, params) {
	state.status = state.run ? statusOf(state.run) : 'idle'
	state.error = { key, params: params || {} }
	return state
}

export function stopAsked(state) {
	state.stopAsked = true
	if (state.status === 'active') state.status = 'stopping'
	return state
}

export function isBusy(state) {
	return state.status === 'starting' || state.status === 'active' || state.status === 'stopping'
}

// a module may start a run only when nothing is running anywhere and the role/machine allow it
export function canStart(state, allowed) {
	return !!allowed && !isBusy(state) && !state.foreign
}
