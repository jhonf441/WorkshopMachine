'use strict'

// Laser <-> pointer assistant (design 2.7). Shown only when the machine declares a laser tool AND a pointer tool and the board reports a
// laser. The SERVICE does the work (machine.mark_cross: <= 10 % power, Laser mode, X and Y homed, interlocks closed, one mark at a time):
//   1. mark     the laser burns a 4 mm cross where the head is; the service remembers the head position
//   2. the person brings the pointer to the centre of the cross with the Jog
//   3. capture  the service reads the head and answers the correction (head when marking - head now); with `save` it stores it
// This module only validates the power, decides when the assistant is offered and shapes the answers. Pure.

export const MAX_POWER = 10 // percent, the cap of the service's laser guard
export const MIN_POWER = 1
export const DEFAULT_POWER = 3

// {available, laserTool, pointerTool}: the profile declares the pair (machine.state profile.secondary_tool_pair) and the board reports a laser
export function pairOf(toolPair, laserPresent) {
	const ok = !!toolPair && typeof toolPair.laserTool === 'number' && typeof toolPair.pointerTool === 'number' && toolPair.laserTool !== toolPair.pointerTool && laserPresent !== false
	return { available: ok, laserTool: ok ? toolPair.laserTool : null, pointerTool: ok ? toolPair.pointerTool : null }
}

// the text of the power field -> number between 1 and 10, or null
export function parsePower(text) {
	const s = String(text === undefined || text === null ? '' : text).trim().replace(',', '.')
	if (s === '' || !/^(\d+\.?\d*|\.\d+)$/.test(s)) return null
	const n = Number(s)
	return n >= MIN_POWER && n <= MAX_POWER ? n : null
}

// refusal reasons of mark_cross / capture with their own text (offsets.cross_<reason>)
export const CROSS_REASONS = ['bad_power', 'no_model', 'not_laser_mode', 'no_laser', 'not_homed', 'interlock_open', 'busy_run', 'busy_mark', 'no_mark', 'no_position', 'forbidden']

export function crossReasonKey(reason) {
	return 'offsets.cross_' + (CROSS_REASONS.indexOf(reason) >= 0 ? reason : 'other')
}

// the correction as the person reads it: "X 0.30  Y -0.12" in mm with the sign the service computed
export function correctionText(correction) {
	if (!correction || typeof correction.x !== 'number' || typeof correction.y !== 'number') return ''
	const f = v => (Math.round(v * 1000) / 1000).toFixed(3)
	return 'X ' + f(correction.x) + '  Y ' + f(correction.y)
}
