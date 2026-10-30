'use strict'

// Follows the runs of a module: starts one, stops it, re-attaches to the one in progress after a page reload (machine.runs) and keeps the
// state up to date while a run lasts (the service also publishes the progress in the plugin data `machine`: onPublished() asks again at
// once when that data says something changed, and a slow poll covers the rest). Timers are injectable for the tests.

import { adoptRuns, beginStart, startFailed, stopAsked } from './run-state.js'
import { isActive, refusalKey } from '../lib/runs.js'
import { refusalOf } from '../api/machine-api.js'

export function createFollower(options) {
	const api = options.api
	const state = options.state
	const interval = options.intervalMs || 2000
	const setTimer = options.setTimer || ((fn, ms) => setTimeout(fn, ms))
	const clearTimer = options.clearTimer || (id => clearTimeout(id))
	const changed = options.onChange || (() => {})
	let timer = null
	let disposed = false
	let busyRefresh = false

	function arm() {
		if (timer !== null || disposed) return
		timer = setTimer(() => {
			timer = null
			refresh()
		}, interval)
	}

	async function refresh() {
		if (busyRefresh || disposed) return state
		busyRefresh = true
		try {
			adoptRuns(state, await api.runs())
		} catch (e) {
			state.error = { key: refusalKey(refusalOf(e)), params: {}, detail: e && e.message ? String(e.message) : '' }
		} finally {
			busyRefresh = false
		}
		changed(state)
		if (isActive(state.run) || state.status === 'starting') arm()
		return state
	}

	return {
		// call when the module opens: a run in progress is taken again (also one started from another browser)
		reattach: refresh,
		refresh,
		async start(kind, params) {
			beginStart(state)
			changed(state)
			try {
				await api.run(kind, params)
			} catch (e) {
				const reason = refusalOf(e)
				if (reason === 'cancelled') {
					startFailed(state, null)
					state.error = null
				} else {
					startFailed(state, refusalKey(reason), {})
					state.error.detail = e && e.message ? String(e.message) : ''
				}
				changed(state)
				return state
			}
			return refresh()
		},
		async stop() {
			stopAsked(state)
			changed(state)
			try {
				await api.stop()
			} catch (e) {
				state.error = { key: refusalKey(refusalOf(e)), params: {}, detail: e && e.message ? String(e.message) : '' }
			}
			return refresh()
		},
		// the published data `machine` (normalizeRuns) changed: ask again when it matters to this module
		onPublished(view) {
			if (!view) return
			const mine = state.run
			const pubActive = view.active
			const startedElsewhere = pubActive && (!mine || mine.id !== pubActive.id)
			const endedHere = mine && isActive(mine) && !(pubActive && pubActive.id === mine.id)
			const progressed = mine && pubActive && pubActive.id === mine.id && (pubActive.step !== mine.step || pubActive.state !== mine.state)
			if (startedElsewhere || endedHere || progressed) refresh()
		},
		dispose() {
			disposed = true
			if (timer !== null) clearTimer(timer)
			timer = null
		}
	}
}
