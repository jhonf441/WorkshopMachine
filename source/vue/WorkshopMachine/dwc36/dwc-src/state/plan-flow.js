'use strict'

// Drives a plan state: propose (the api builds a plan, never writes), accept a conflict, apply (the api writes through config.commit
// after the service's own confirmation dialog) and reset. No Vue, no network of its own: `options.apply(plan)` is a function that
// calls the api. The confirmation dialog of level 3 is opened by the shared client when the service answers confirm_required; a
// cancelled dialog (error reason 'cancelled') leaves the plan under review.

import { createPlanState, planBegin, planLoaded, planFailed, setAccept, canAccept, canApply, applyBegin, applyDone, applyCancelled, applyFailed, planReset } from './plan-state.js'
import { planErrorKey } from '../lib/plan-diff.js'
import { refusalOf } from '../api/machine-api.js'

export function createPlanFlow(options) {
	const state = createPlanState()
	const changed = options.onChange || (() => {})
	let again = null // how to ask for the same plan again, accepting the current state of the files

	function fail(fn, e) {
		fn(state, planErrorKey(refusalOf(e)), e && e.message ? String(e.message) : '')
	}

	return {
		state,
		// `ask(acceptCurrent)` -> {plan, conflict}; proposeAccepted() asks the same question again with the explicit acceptance
		async propose(ask) {
			again = ask
			planBegin(state)
			changed(state)
			try {
				planLoaded(state, await ask(false))
			} catch (e) {
				fail(planFailed, e)
			}
			changed(state)
			return state
		},
		accept(value) {
			setAccept(state, value)
			changed(state)
		},
		async proposeAccepted() {
			if (!canAccept(state) || !again) return state
			const ask = again
			state.acceptCurrent = false
			planBegin(state)
			changed(state)
			try {
				planLoaded(state, await ask(true))
			} catch (e) {
				fail(planFailed, e)
			}
			changed(state)
			return state
		},
		async apply(roleOk) {
			if (!canApply(state, roleOk)) return state
			applyBegin(state)
			changed(state)
			try {
				applyDone(state, await options.apply(state.plan))
			} catch (e) {
				if (refusalOf(e) === 'cancelled' || (e && e.code === 'cancelled')) applyCancelled(state)
				else fail(applyFailed, e)
			}
			changed(state)
			return state
		},
		reset() {
			again = null
			planReset(state)
			changed(state)
		}
	}
}
