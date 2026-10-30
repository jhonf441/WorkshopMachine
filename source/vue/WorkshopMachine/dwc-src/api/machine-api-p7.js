'use strict'

// Phase 7 part of the Machine api (named point sets of the bed view, shared by Mesh and Level). Like the other machine-api*.js, this is the
// ONLY place that knows the operation names, the store name and the shape of the answers.
//
// Contract: WorkshopService docs/MACHINE-POINTSETS-CONTRACT.md (branch m7-service): an ordinary settings store `machine-pointsets`.
//   settings.get {name} -> {value, rev}                  operator and above; value is null (rev "0") until the first save
//   settings.set {name, value, base_rev} -> {rev, changed}   technician and above; a changed file answers the error code 'conflict'
// ASSUMED (read from vue/_shared/settings.js, not from a live service): the conflict reaches us as an error with code 'conflict' and
// `body.error.current = {value, rev}`; a service without the store name answers 'invalid_args' (unknown name), an older one 'unknown_op'.
// Not run against a real machine.

import { normalizeSets, valueOf, saveSet, deleteSet } from '../lib/point-sets.js'

export const OPS7 = { get: 'settings.get', set: 'settings.set' }
export const STORE = 'machine-pointsets'
export const NOT_THERE = ['unknown_op', 'service_outdated', 'invalid_args'] // the store (or the settings operations) is not in this service

function obj(v) {
	return v && typeof v === 'object' && !Array.isArray(v) ? v : {}
}

export function createPhase7Api(call, now) {
	const clock = now || (() => Date.now() / 1000)

	async function read() {
		const r = obj(await call(OPS7.get, { name: STORE }))
		return { sets: normalizeSets(r.value), rev: String(r.rev === undefined || r.rev === null ? '0' : r.rev) }
	}

	// one attempt of a change over `base`: {done: result} when written, {current: base} when somebody else saved first
	async function attempt(change, base) {
		const result = change(base.sets)
		if (!result.ok) return { done: result }
		try {
			const r = obj(await call(OPS7.set, { name: STORE, value: valueOf(result.sets), base_rev: base.rev }))
			return { done: Object.assign({}, result, { rev: String(r.rev) }) }
		} catch (e) {
			const cur = e && e.code === 'conflict' && e.body && e.body.error ? obj(e.body.error.current) : null
			if (!cur) throw e
			return { current: { sets: normalizeSets(cur.value), rev: String(cur.rev) } }
		}
	}

	// read, change, write with the rev read; on a conflict change again over what the service answers and try once more
	async function write(change) {
		const first = await attempt(change, await read())
		if (first.done) return first.done
		const second = await attempt(change, first.current)
		if (second.done) return second.done
		const err = new Error('conflict')
		err.code = 'conflict'
		throw err
	}

	return {
		// -> {sets: [{id, name, points, ts, user}], rev}
		list: read,
		// -> {ok, sets, replaced, errorKey, rev?}; a bad name or points answers ok false and writes nothing
		save: (name, points, who) => write(sets => saveSet(sets, name, points, who, clock())),
		remove: id => write(sets => ({ ok: true, sets: deleteSet(sets, id) }))
	}
}
