'use strict'

// The explicit state of a "try now" (machine.try): a volatile value is applied for a limited time and the service puts the previous one back
// by itself unless the person presses keep. Plain object + plain functions; the clock is a number of seconds given by the caller.
//   status   'idle' | 'starting' | 'pending' | 'finishing' | 'done' | 'error'
//   trial    {id, gcodeKind, previous, applied, seconds, expiresAt, user} while a trial waits, else null
//   outcome  'kept' | 'reverted' | 'expired' | null (how the last trial ended)
//   persist  {kind, values} the service gives when a trial is kept: what machine.config.plan takes to make it permanent, or null
//   error    {key, detail} of the last failure

export function createTryState() {
	return { status: 'idle', trial: null, outcome: null, persist: null, error: null }
}

export function tryBegin(state) {
	state.status = 'starting'
	state.outcome = null
	state.persist = null
	state.error = null
	return state
}

// a trial started (or was found after a reload): it waits for keep / revert
export function tryPending(state, trial) {
	state.trial = trial
	state.status = 'pending'
	state.error = null
	return state
}

export function tryFinishing(state) {
	state.status = 'finishing'
	return state
}

// outcome: 'kept' | 'reverted' | 'expired'; `persist` only for 'kept'
export function tryEnded(state, outcome, persist) {
	state.status = 'done'
	state.outcome = outcome
	state.persist = persist || null
	state.trial = null
	return state
}

export function tryFailed(state, key, detail) {
	state.status = state.trial ? 'pending' : 'error' // a failed keep / revert leaves the trial waiting: it is still running on the machine
	state.error = { key, detail: detail || '' }
	return state
}

export function tryReset(state) {
	return Object.assign(state, createTryState())
}

// seconds left (0 when over); null without a trial or without an expiry
export function remainingSeconds(state, now) {
	const t = state.trial
	if (!t || typeof t.expiresAt !== 'number') return null
	return Math.max(0, Math.ceil(t.expiresAt - now))
}

// the countdown ended on the page: the service reverts by itself, the page confirms by asking
export function isOver(state, now) {
	return state.status === 'pending' && remainingSeconds(state, now) === 0
}

export function canKeep(state, roleOk) {
	return !!roleOk && state.status === 'pending'
}

export function canStart(state, roleOk, hasValues) {
	return !!roleOk && !!hasValues && (state.status === 'idle' || state.status === 'done' || state.status === 'error')
}

// 0..1 of the time left, for the bar (1 = just started)
export function remainingFraction(state, now) {
	const t = state.trial
	const left = remainingSeconds(state, now)
	if (!t || left === null || !(t.seconds > 0)) return null
	return Math.max(0, Math.min(1, left / t.seconds))
}
