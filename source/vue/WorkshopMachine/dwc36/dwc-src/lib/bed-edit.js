'use strict'

// Edit the heater and the sensor of a bed the board already has (plan kind config.bed_edit, WorkshopService dsf/machine_bed_edit.py): the draft of the form, the spec
// the service takes ({bed, heater?, sensor?}: only what changed) and the checks the page makes before asking. The service checks everything again (the new number must
// be the bed's own or one nothing uses, inside the limits of the board); this only saves a round trip and says what is wrong in the person's words. Pure.

import { boardLimits } from './beds-spec.js'

export const HEATERS_CEILING = 20 // RRF heaters when the board does not report limits.heaters
export const SENSORS_CEILING = 100 // sensor numbers the service accepts when the board does not report limits.sensors
// the codes of a check that is SHOWN under a field (texts beds.edit_err_<code>; the test of the texts keeps them); role, busy and no_line only block (the button says why)
export const EDIT_ERROR_CODES = ['heater', 'sensor', 'same']

const whole = v => (/^\d+$/.test(String(v === null || v === undefined ? '' : v).trim()) ? parseInt(String(v).trim(), 10) : null)

// {heaters, sensors}: how many numbers of each the board holds (the limits of the object model, else the ceilings)
export function editLimits(model) {
	const l = (model && model.limits) || {}
	return { heaters: boardLimits(model).heaters || HEATERS_CEILING, sensors: Number.isInteger(l.sensors) && l.sensors > 0 ? l.sensors : SENSORS_CEILING }
}

// `row` = one of definedRows(): the form starts with the numbers the bed has now
export function editDraft(row) {
	return { heater: row.heater === null || row.heater === undefined ? '' : String(row.heater), sensor: row.fileSensor === null || row.fileSensor === undefined ? '' : String(row.fileSensor) }
}

// the sensor can only change when the heater's line names it (T of its M950): the service refuses otherwise
export function sensorEditable(row) {
	return row.fileSensor !== null && row.fileSensor !== undefined
}

// {bed, heater?, sensor?}: only the numbers that differ from the bed's own
export function toEditSpec(row, draft) {
	const spec = { bed: row.bed }
	const heater = whole(draft.heater)
	const sensor = whole(draft.sensor)
	if (heater !== null && heater !== row.heater) spec.heater = heater
	if (sensorEditable(row) && sensor !== null && sensor !== row.fileSensor) spec.sensor = sensor
	return spec
}

export function specKeyEdit(row, draft) {
	return JSON.stringify(toEditSpec(row, draft))
}

// [{field, code, params?}]: what stops the plan. ctx = {limits: editLimits(model), canWrite, busy}
export function editIssues(row, draft, ctx) {
	const out = []
	if (!row.editable) out.push({ field: 'bed', code: 'no_line' })
	if (!ctx.canWrite) out.push({ field: 'role', code: 'role' })
	if (ctx.busy) out.push({ field: 'busy', code: 'busy' })
	const heater = whole(draft.heater)
	if (heater === null || heater >= ctx.limits.heaters) out.push({ field: 'heater', code: 'heater', params: { max: ctx.limits.heaters - 1 } })
	if (sensorEditable(row)) {
		const sensor = whole(draft.sensor)
		if (sensor === null || sensor >= ctx.limits.sensors) out.push({ field: 'sensor', code: 'sensor', params: { max: ctx.limits.sensors - 1 } })
	}
	if (!out.length && Object.keys(toEditSpec(row, draft)).length === 1) out.push({ field: 'draft', code: 'same' })
	return out
}
