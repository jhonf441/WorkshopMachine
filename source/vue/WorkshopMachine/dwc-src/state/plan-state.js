'use strict'

// The explicit state of a "plan, review, apply" flow (restore, offsets persistence, limits): plain object + plain functions.
//   status        'idle' | 'planning' | 'review' | 'conflict' | 'applying' | 'done' | 'error'
//   plan          normalized plan (api/machine-api-p2.js) shown for review, or null
//   conflict      {threeWay, files} when files changed on the SD since the record: the person must compare and accept (restore only), or null
//   acceptCurrent the explicit tick "I accept the current state of the SD"
//   result        what apply answered ({snapshot, recordId, restartNeeded})
//   error         {key, detail} of the last failure
// The service decides and enforces; this state only keeps the page honest about what step it is on.

import { hasChanges } from '../lib/plan-diff.js'

export function createPlanState() {
	return { status: 'idle', plan: null, conflict: null, acceptCurrent: false, result: null, error: null }
}

export function planBegin(state) {
	state.status = 'planning'
	state.plan = null
	state.conflict = null
	state.result = null
	state.error = null
	return state
}

// {plan, conflict}: a conflict without a plan = the files changed, the person has to accept first
export function planLoaded(state, answer) {
	state.plan = answer.plan || null
	state.conflict = answer.conflict || null
	state.status = state.plan ? 'review' : state.conflict ? 'conflict' : 'error'
	if (state.status === 'error') state.error = { key: 'plan.err_other', detail: '' }
	return state
}

export function planFailed(state, key, detail) {
	state.status = 'error'
	state.plan = null
	state.error = { key, detail: detail || '' }
	return state
}

export function setAccept(state, value) {
	state.acceptCurrent = !!value
	return state
}

// a conflict can be re-planned only after the explicit tick
export function canAccept(state) {
	return state.status === 'conflict' && !!state.conflict && state.acceptCurrent
}

// applying needs a plan that changes something, the role, and no other apply in progress
export function canApply(state, roleOk) {
	return !!roleOk && state.status === 'review' && hasChanges(state.plan)
}

export function applyBegin(state) {
	state.status = 'applying'
	state.error = null
	return state
}

export function applyDone(state, result) {
	state.status = 'done'
	state.result = result
	return state
}

// the person cancelled the confirmation dialog: back to the review, nothing happened
export function applyCancelled(state) {
	state.status = 'review'
	return state
}

export function applyFailed(state, key, detail) {
	state.status = 'error'
	state.error = { key, detail: detail || '' }
	return state
}

export function planReset(state) {
	return Object.assign(state, createPlanState())
}

export function isWorking(state) {
	return state.status === 'planning' || state.status === 'applying'
}
