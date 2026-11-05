'use strict'

// A refusal of the service because of who the person is (HTTP 401 / 403: code login_required / forbidden) is told by its cause, once,
// in one sentence, never as the key text plus the raw message (owner rule 2026-11-04, AWS-console style). Pure.
//
//   lockKey(e)        'lock.signed_out' (needs signing in) | 'lock.role' (the role is too low) | '' (not a refusal of this kind)
//   lockKeyOf(reason) the same from the reason / code string that refusalOf() returns
//   detailOf(e)       the raw message of the error, '' for a refusal of this kind (the sentence already says it)
//   messageOf(e, t)   one line for a person: the lock sentence, else the message of the error; t = this.t of a component

const KEYS = { login_required: 'lock.signed_out', forbidden: 'lock.role' }

export function lockKeyOf(reason) {
	return KEYS[reason] || ''
}

export function lockKey(e) {
	return lockKeyOf(e && e.code)
}

export function detailOf(e) {
	if (lockKey(e)) return ''
	return e && e.message ? String(e.message) : ''
}

export function messageOf(e, t) {
	const key = lockKey(e)
	if (key) return t(key)
	return String((e && e.message) || e)
}
