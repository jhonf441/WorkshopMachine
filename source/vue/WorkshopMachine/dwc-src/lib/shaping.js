'use strict'

// Input shaping module (design 2.8): the M593 settings, their validation and the plan values. Pure.
// Types settable on RRF 3.6 (machine.shaping.get `types`): none, zvd, zvdd, zvddd, mzv, ei2, ei3 ("custom" is shown, not edited). The
// plan kind takes {type, frequency, damping}; the minimum acceleration is shown (as the board reports it) but not edited here.

import { numOf } from './number-input.js'

export const KIND_SHAPING = 'config.m593'
export const TYPES = ['none', 'zvd', 'zvdd', 'zvddd', 'mzv', 'ei2', 'ei3']
export const FREQ_MIN = 4 // Hz: the service's min_frequency_hz
export const FREQ_MAX = 250
export const DEFAULT_DAMPING = 0.1

// the draft form of a state {type, frequency, damping} (null = nothing known)
export function draftOf(state) {
	const s = state || {}
	return {
		type: TYPES.indexOf(s.type) >= 0 ? s.type : 'none',
		frequency: typeof s.frequency === 'number' ? String(s.frequency) : '',
		damping: typeof s.damping === 'number' ? String(s.damping) : String(DEFAULT_DAMPING)
	}
}

// -> {values: {type, frequency, damping}, errors: [{field, key}], changed, none}
export function check(draft, current, minFrequency) {
	const d = draft || {}
	const errors = []
	const type = TYPES.indexOf(d.type) >= 0 ? d.type : null
	if (type === null) errors.push({ field: 'type', key: 'shaping.err_type' })
	const none = type === 'none'
	const frequency = numOf(d.frequency)
	const damping = numOf(d.damping)
	const floor = typeof minFrequency === 'number' ? minFrequency : FREQ_MIN
	if (!none) {
		if (frequency === null || frequency < floor || frequency > FREQ_MAX) errors.push({ field: 'frequency', key: 'shaping.err_frequency' })
		if (damping === null || damping < 0 || damping >= 1) errors.push({ field: 'damping', key: 'shaping.err_damping' })
	}
	const c = current || {}
	const values = none ? { type: 'none' } : { type, frequency, damping }
	const same = none ? c.type === 'none' || !c.type : c.type === type && c.frequency === frequency && c.damping === damping
	return { values, errors, changed: !same, none }
}

// the line that the plan writes, for the person to read before the review (M593 P"zvd" F40 S0.1)
export function lineOf(values) {
	if (!values || !values.type) return ''
	if (values.type === 'none') return 'M593 P"none"'
	return 'M593 P"' + values.type + '" F' + values.frequency + ' S' + values.damping
}

// the plan (and trial) values: already in the service's names
export function planValues(values) {
	return values.type === 'none' ? { type: 'none' } : { type: values.type, frequency: values.frequency, damping: values.damping }
}

// the state in words for the header: {active, textKey}
export function stateView(state) {
	const active = !!state && !!state.type && state.type !== 'none'
	return { active, textKey: active ? 'shaping.state_on' : 'shaping.state_off' }
}

// the codes of machine.shaping.get `warnings` that have a text (shaping.warn_<code>)
export const WARNING_CODES = ['retune_pressure_advance', 'custom_shaper']

export function warningKey(code) {
	return 'shaping.warn_' + (WARNING_CODES.indexOf(code) >= 0 ? code : 'other')
}
