'use strict'

// Explicit state of the named point sets of a page (Mesh, Level): what the store holds, whether it is there at all, a write in progress
// and the last notice / error as KEYS (the page translates them). Plain functions that take the state and the api (api.pointsets, see
// api/machine-api-p7.js); they never throw.
//
// status: 'idle' | 'loading' | 'ready' | 'off' (the service has no such store, or it cannot be read: the card says why)

import { NOT_THERE } from '../api/machine-api-p7.js'
import { refusalOf } from '../api/machine-api.js'
import { refusalKey } from '../lib/runs.js'

export const OFF_REASONS = ['no_store', 'error'] // bed.sets_off_<reason>

export function createPointSets() {
	return { status: 'idle', reason: '', sets: [], busy: false, noticeKey: '', noticeParams: {}, errorKey: '', errorDetail: '' }
}

function failure(st, e) {
	st.noticeKey = ''
	if (e && e.code === 'conflict') st.errorKey = 'bed.set_err_conflict'
	else st.errorKey = refusalKey(refusalOf(e))
	st.errorDetail = e && e.message && e.code !== 'conflict' ? String(e.message) : ''
}

export async function loadSets(st, api) {
	if (st.status === 'idle') st.status = 'loading'
	try {
		st.sets = (await api.pointsets.list()).sets
		st.status = 'ready'
		st.reason = ''
	} catch (e) {
		st.status = 'off'
		st.reason = e && NOT_THERE.indexOf(e.code) >= 0 ? 'no_store' : 'error'
	}
	return st.status
}

async function write(st, call, doneKey) {
	st.busy = true
	st.noticeKey = ''
	st.errorKey = ''
	st.errorDetail = ''
	try {
		const r = await call()
		if (!r.ok) {
			st.errorKey = r.errorKey
			return false
		}
		st.sets = r.sets
		st.noticeKey = r.replaced ? 'bed.sets_replaced' : doneKey
		return true
	} catch (e) {
		failure(st, e)
		return false
	} finally {
		st.busy = false
	}
}

export function saveSetAs(st, api, name, points, who) {
	return write(st, () => api.pointsets.save(name, points, who), 'bed.sets_saved')
}

export function removeSetById(st, api, id) {
	return write(st, () => api.pointsets.remove(id), 'bed.sets_deleted')
}

// what the card shows; `canWrite` is the page's right to write (technician and above) and the store must be there
export function viewOf(st, canWrite) {
	return { available: st.status === 'ready' || st.status === 'loading', reason: st.reason || 'error', sets: st.sets, canWrite: !!canWrite && st.status === 'ready', busy: st.busy || st.status === 'loading' }
}
