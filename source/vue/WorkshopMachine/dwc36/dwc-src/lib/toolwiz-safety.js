'use strict'

// "New tool" assistant, safety gating. Blocking rules, each with a plain-language reason (toolwiz.block_<code>):
//   a heater is never created without a sensor, without its maximum temperature (M143) and without the person's commitment to run the autotune;
//   only a technician; only with the machine free; and the preview must be fresh and clean. Pure: the service enforces all of it again.

import { presetOf, toNumber, typeInfo, TOOL_RANGE } from './toolwiz-spec.js'

// the conditions of the apply step, in the order they are told (toolwiz.block_<id> says why one is not met, toolwiz.check_<id> that it is)
export const BLOCK_CODES = ['role', 'busy', 'preview_stale', 'preview_errors', 'heater_no_sensor', 'heater_no_max', 'heater_max_range', 'no_autotune', 'no_ack_off']

// per heater: the codes that block it (empty = fine)
export function heaterBlocks(draft) {
	return draft.heaters.map(h => {
		const out = []
		if (!presetOf(h.sensorPreset)) out.push('heater_no_sensor')
		const t = toNumber(h.maxTemp)
		if (t === null) out.push('heater_no_max')
		else if (t < TOOL_RANGE.tempMin || t > TOOL_RANGE.tempMax) out.push('heater_max_range')
		return out
	})
}

// ctx: {canWrite, busy, previewFresh, previewOk} -> the codes that block the apply button, in the order they are told
export function applyBlockers(draft, ctx) {
	const out = []
	if (!ctx.canWrite) out.push('role')
	if (ctx.busy) out.push('busy')
	if (!ctx.previewFresh) out.push('preview_stale')
	else if (!ctx.previewOk) out.push('preview_errors')
	heaterBlocks(draft).forEach(b => b.forEach(c => { if (out.indexOf(c) < 0) out.push(c) }))
	if (draft.heaters.length && !draft.ackAutotune) out.push('no_autotune')
	const info = typeInfo(draft.type)
	if (info && info.output && !draft.ackOff) out.push('no_ack_off')
	return out
}
