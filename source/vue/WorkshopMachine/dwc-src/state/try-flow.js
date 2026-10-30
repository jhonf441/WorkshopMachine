'use strict'

// Drives a try state: start, keep, revert, find the pending trial after a reload, and settle when the countdown is over. No Vue, no
// network of its own: `api` is createMachineApi(...).motion.trial. The confirmation dialog of level 3 is opened by the shared client when the
// service answers confirm_required; a cancelled dialog leaves things as they were.
//
// After a reload the service is asked which trial waits (api.pending, ASSUMED: the contract has no such question yet). While it does not
// answer, `options.store` ({load(), save(trial | null)}, a per-viewer convenience such as localStorage) gives back the trial this browser
// started, and it is kept or reverted by its try_id. The service reverts by itself when the time is over, with or without the page.

import { createTryState, tryBegin, tryPending, tryFinishing, tryEnded, tryFailed, tryReset, isOver } from './try-state.js'
import { planErrorKey } from '../lib/plan-diff.js'
import { refusalOf } from '../api/machine-api.js'

// reasons of machine.try that have their own text (try.err_<reason>)
export const TRY_REASONS = ['try_pending', 'busy_run', 'no_previous', 'board_error', 'not_found', 'revert_failed', 'job_running']

export function tryErrorKey(reason) {
	return TRY_REASONS.indexOf(reason) >= 0 ? 'try.err_' + reason : planErrorKey(reason)
}

const NO_STORE = { load: () => null, save: () => {} }

function cancelled(e) {
	return refusalOf(e) === 'cancelled' || (e && e.code === 'cancelled')
}

// what a flow works on: the state, the api, the store of this browser and the change callback
function context(options) {
	return { state: options.state || createTryState(), api: options.api, store: options.store || NO_STORE, changed: options.onChange || (() => {}) }
}

function ended(ctx, outcome, persist) {
	tryEnded(ctx.state, outcome, persist)
	ctx.store.save(null)
}

async function start(ctx, gcodeKind, values, seconds) {
	tryBegin(ctx.state)
	ctx.changed(ctx.state)
	try {
		const trial = await ctx.api.start(gcodeKind, values, seconds)
		if (trial) {
			tryPending(ctx.state, trial)
			ctx.store.save(trial)
		} else tryFailed(ctx.state, 'try.err_other', '')
	} catch (e) {
		if (cancelled(e)) tryReset(ctx.state)
		else tryFailed(ctx.state, tryErrorKey(refusalOf(e)), e && e.message ? String(e.message) : '')
	}
	ctx.changed(ctx.state)
	return ctx.state
}

// action: 'keep' | 'revert'
async function finish(ctx, action) {
	const trial = ctx.state.trial
	if (!trial) return ctx.state
	tryFinishing(ctx.state)
	ctx.changed(ctx.state)
	try {
		const answer = await ctx.api[action](trial.gcodeKind, trial.id)
		ended(ctx, action === 'keep' ? 'kept' : 'reverted', action === 'keep' && answer ? answer.persist : null)
	} catch (e) {
		if (cancelled(e)) tryPending(ctx.state, trial)
		else if (refusalOf(e) === 'not_found') ended(ctx, 'expired') // it ended by itself in the meantime
		else tryFailed(ctx.state, tryErrorKey(refusalOf(e)), e && e.message ? String(e.message) : '')
	}
	ctx.changed(ctx.state)
	return ctx.state
}

// after a reload (`now` in epoch seconds): the trial that waits, from the service or, if it cannot say, from this browser
async function restore(ctx, now) {
	let list = null
	try {
		list = await ctx.api.pending()
	} catch (e) {
		list = null // the service does not answer or does not know the question
	}
	if (list !== null) {
		if (list.length) tryPending(ctx.state, list[0])
		else ctx.store.save(null)
	} else {
		const saved = ctx.store.load()
		if (saved && typeof saved.expiresAt === 'number' && saved.expiresAt > now) tryPending(ctx.state, saved)
		else if (saved) ended(ctx, 'expired') // the time is over: the service put the value back
	}
	ctx.changed(ctx.state)
	return ctx.state
}

// the countdown reached zero on the page: ask the service whether the trial is gone (it reverts by itself)
async function settle(ctx, now) {
	try {
		const list = await ctx.api.pending()
		const mine = list.find(t => ctx.state.trial && t.id === ctx.state.trial.id)
		if (mine) tryPending(ctx.state, mine) // not over yet: the clocks differ
		else ended(ctx, 'expired')
	} catch (e) {
		ended(ctx, 'expired') // the service reverts by itself; the page cannot confirm it
	}
	ctx.changed(ctx.state)
	return ctx.state
}

export function createTryFlow(options) {
	const ctx = context(options)
	let settling = false
	return {
		state: ctx.state,
		start: (gcodeKind, values, seconds) => start(ctx, gcodeKind, values, seconds),
		keep: () => finish(ctx, 'keep'),
		revert: () => finish(ctx, 'revert'),
		restore: now => restore(ctx, now),
		async settle(now) {
			if (settling || !isOver(ctx.state, now)) return ctx.state
			settling = true
			try {
				return await settle(ctx, now)
			} finally {
				settling = false
			}
		},
		reset() {
			tryReset(ctx.state)
			ctx.changed(ctx.state)
		}
	}
}
