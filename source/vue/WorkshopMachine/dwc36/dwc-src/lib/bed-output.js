'use strict'

// The OUTPUT of a bed heater: does it go straight to a MOSFET of the board, or through a relay? The page deduces it from the pin the person picks and never
// asks what the board already tells. The pins come from machine.tool.pins (WorkshopService dsf/machine_tool.py BOARD_PINS: the Duet 3 MB6HC main board), which
// gives capabilities (pwm, digital...) but not what each output can drive; that is written here, from the Duet3D hardware overview of the MB6HC:
//   out0            the bed heater output: a MOSFET up to 18 A (one on the board)
//   out1 .. out3    the heater outputs: a MOSFET up to 6 A each
//   out4 .. out6    the fan outputs (MOSFET for fans, not sized for a bed heater)
//   out7 .. out9    the low-current outputs (LEDs, small fans, a relay coil; not a heater)
//   ioN.out         logic level (3.3 V): it can only drive a relay (solid state or mechanical)
//   N.outM          an expansion board over CAN: what it can drive is not known here, so it is offered only through a relay
// A heater on a bed or heater MOSFET needs no relay ("dc": direct, the mark-less M950 of the 3D printing page); any other pin needs one. Pure.

export const KIND_DIRECT = 'dc'
export const RELAY_KINDS = ['ssr', 'ssrdc', 'relay']

const ROLES = {
	bed: { amps: 18, direct: true },
	heater: { amps: 6, direct: true },
	fan: { amps: null, direct: false },
	low: { amps: null, direct: false },
	logic: { amps: null, direct: false },
	unknown: { amps: null, direct: false }
}

const clean = raw => String(raw || '').trim().replace(/^[!^]+/, '').toLowerCase()

// {role, amps, direct}: what the output can drive. `direct` = a bed heater can hang from it without a relay.
export function outputRole(pin) {
	const name = clean(pin)
	let role = 'unknown'
	const m = /^out(\d+)$/.exec(name)
	if (m) {
		const n = parseInt(m[1], 10)
		role = n === 0 ? 'bed' : n <= 3 ? 'heater' : n <= 6 ? 'fan' : n <= 9 ? 'low' : 'unknown'
	} else if (/^io\d+\.out$/.test(name)) role = 'logic'
	return Object.assign({ role }, ROLES[role])
}

export const isDirectOutput = pin => outputRole(pin).direct

// the kind of output for a pin: a bed or heater MOSFET is always direct; any other pin keeps the relay kind the person had (or the AC solid-state relay, the common one)
export function kindForPin(pin, currentKind) {
	if (isDirectOutput(pin)) return KIND_DIRECT
	return RELAY_KINDS.indexOf(currentKind) >= 0 ? currentKind : RELAY_KINDS[0]
}

// {key, params}: the text of a pin in the output list ("out1 - heater MOSFET of the board, up to 6 A"); `fallbackKey` is the capability text of pin-kinds.js
export function outputOptionKey(pin, fallbackKey) {
	const r = outputRole(pin)
	if (r.role === 'unknown') return { key: fallbackKey || '', params: {} }
	return { key: 'beds.out_' + r.role, params: { amps: r.amps === null ? '' : r.amps } }
}

// the free pins that a bed heater can hang from without a relay, sorted by what they can carry (the bed MOSFET first)
export function directFree(pins) {
	return ((pins && pins.free) || []).filter(p => isDirectOutput(p.pin) && p.capabilities.indexOf('pwm') >= 0).sort((a, b) => outputRole(b.pin).amps - outputRole(a.pin).amps)
}

// the bed and heater MOSFETs the configuration already uses: [{pin, by, amps}], so the page can say why no direct output is left (and who has the 18 A one)
export function directTaken(pins) {
	return ((pins && pins.used) || []).filter(u => isDirectOutput(u.pin)).map(u => ({ pin: u.pin, by: u.by, amps: outputRole(u.pin).amps })).sort((a, b) => b.amps - a.amps)
}

// 'pin_not_mosfet' when the draft says direct but the pin cannot carry a heater (the service refuses it too); '' when the pair is consistent
export function kindIssue(kind, pin) {
	if (kind === KIND_DIRECT && pin && !isDirectOutput(pin)) return 'pin_not_mosfet'
	return ''
}

// the message of the service for a kind it does not know: an older WorkshopService (before the direct output) answers `values` on output.kind
export function serviceKindError(code, kind) {
	return code === 'values' && kind === KIND_DIRECT ? 'kind_unsupported' : code
}
