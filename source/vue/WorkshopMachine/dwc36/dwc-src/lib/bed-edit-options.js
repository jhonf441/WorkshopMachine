'use strict'

// The lists the Edit form of a zone offers (selects of the heater and of the sensor). One entry per number the board can hold, built from the live object model:
// what exists (name, state / current reading), the numbers still free and, for a number another zone already has, that zone (it is disabled: the service refuses it).
// The zone's own current number is always offered and never disabled. Pure; the texts are made by the card from these fields.
// `zones` = definedRows() of the page (this zone included). Without the model every number up to the ceilings of lib/bed-edit.js is "free".

import { editLimits } from './bed-edit.js'

const named = v => (v && v.name ? String(v.name) : '')

// the other zone (its bed number) whose `field` is `number`, or null
function zoneOf(zones, row, number, field) {
	const z = (zones || []).find(x => x.bed !== row.bed && x[field] === number)
	return z ? z.bed : null
}

// [{value, exists, name, state, usedBy, own, disabled}] by heater number
export function heaterOptions(model, row, zones) {
	const heaters = ((model && model.heat) || {}).heaters || []
	const count = Math.max(editLimits(model).heaters, Number.isInteger(row.heater) ? row.heater + 1 : 0)
	const out = []
	for (let n = 0; n < count; n++) {
		const h = heaters[n] || null
		const own = n === row.heater
		const usedBy = own ? null : zoneOf(zones, row, n, 'heater')
		out.push({ value: n, exists: !!h, name: named(h), state: h && h.state ? String(h.state) : '', usedBy, own, disabled: usedBy !== null })
	}
	return out
}

// [{value, exists, name, reading, usedBy, own, disabled}] by sensor number: the sensor a zone uses is the one its heater names (fileSensor, else the model's)
export function sensorOptions(model, row, zones) {
	const analog = ((model && model.sensors) || {}).analog || []
	const count = Math.max(editLimits(model).sensors, Number.isInteger(row.fileSensor) ? row.fileSensor + 1 : 0)
	const withSensor = (zones || []).map(z => Object.assign({}, z, { sensorNumber: Number.isInteger(z.fileSensor) ? z.fileSensor : z.sensor }))
	const out = []
	for (let n = 0; n < count; n++) {
		const s = analog[n] || null
		const own = n === row.fileSensor
		const usedBy = own ? null : zoneOf(withSensor, row, n, 'sensorNumber')
		const reading = s && Number.isFinite(s.lastReading) ? Math.round(s.lastReading * 10) / 10 : null
		out.push({ value: n, exists: !!s, name: named(s), reading, usedBy, own, disabled: usedBy !== null })
	}
	return out
}
