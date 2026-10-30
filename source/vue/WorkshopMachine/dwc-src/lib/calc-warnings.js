'use strict'

// The warnings machine.calc answers (codes, contract "machine.calc"): each has a text calibration.warn_<code>. A code the page does not know
// shows the generic text. fixed_backlash_only and microstepping_note come with every backlash / steps result and are shown as notes.

export const WARNING_CODES = [
	'large_correction', 'microstepping_note', 'fixed_backlash_only', 'inconsistent', 'big_backlash', 'per_motor', 'zero', 'not_in_g32',
	'below_minimum', 'very_high'
]

// codes that are always there (a note, not a problem)
export const NOTE_CODES = ['microstepping_note', 'fixed_backlash_only', 'not_in_g32', 'per_motor']

export function warningKey(code) {
	return 'calibration.warn_' + (WARNING_CODES.indexOf(code) >= 0 ? code : 'other')
}

// [{code, textKey, note}] for the list under a result
export function warningRows(codes) {
	return (codes || []).map(code => ({ code, textKey: warningKey(code), note: NOTE_CODES.indexOf(code) >= 0 }))
}
