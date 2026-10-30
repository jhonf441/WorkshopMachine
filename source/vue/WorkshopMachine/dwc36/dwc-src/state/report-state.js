'use strict'

// The explicit state of the Report module: plain object + plain functions, no Vue, no network.
//   status    'idle' | 'loading' | 'ready' | 'error'
//   mode      'full' (the machine status report) | 'record' (one calibration)
//   recordId  the record of the one-calibration report
//   data      machine.report as the api normalized it, or null
//   error     {key, detail}

export function createReportState() {
	return { status: 'idle', mode: 'full', recordId: '', data: null, error: null }
}

export function setTarget(state, mode, recordId) {
	state.mode = mode === 'record' && recordId ? 'record' : 'full'
	state.recordId = state.mode === 'record' ? recordId : ''
	return state
}

export function loadBegin(state) {
	state.status = 'loading'
	state.error = null
	return state
}

export function loadDone(state, data) {
	state.data = data
	state.status = 'ready'
	return state
}

export function loadFailed(state, key, detail) {
	state.status = 'error'
	state.error = { key, detail: detail || '' }
	return state
}

// the argument of api.history.report: the whole machine, or one record
export function targetOf(state) {
	return state.mode === 'record' ? { id: state.recordId } : { full: true }
}
