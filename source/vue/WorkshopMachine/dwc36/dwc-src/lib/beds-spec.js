'use strict'

// "Bed heaters" assistant (DWC 3.6): the draft of the form, the spec the service takes (machine.beds.preview and the plan config.bed_heaters, WorkshopService
// dsf/machine_beds.py) and the checks the page makes before asking. The service checks everything again (pins the board has, free numbers, the files), this only
// saves a round trip and says what is missing in the person's words. The pins are NEVER guessed: the person picks them from the free ones. Pure.

import { KIND_DIRECT, RELAY_KINDS, kindIssue } from './bed-output.js'

// The sensor types of a zone (RRF 3.x M308; the service takes them in machine_sensors.py). The ids use underscores (they are part of text keys); the service ids are
// in PRESET_SERVICE. Syntax and ranges: Duet3D GCode dictionary M308 and the pages Connecting thermistors / PT100 / thermocouples.
export const PRESETS = ['thermistor', 'pt1000', 'pt100', 'thermocouple', 'tc_max31856', 'linear_analog']
export const PRESET_SERVICE = { tc_max31856: 'tc-max31856', linear_analog: 'linear-analog' }
// how the select groups them (the text of each group: beds.group_<id>)
export const PRESET_GROUPS = [{ id: 'thermistors', presets: ['thermistor'] }, { id: 'rtd', presets: ['pt1000', 'pt100'] }, { id: 'thermocouples', presets: ['thermocouple', 'tc_max31856'] }, { id: 'other', presets: ['linear_analog'] }]
// what the pin of each sensor type needs (machine.tool.pins capabilities): a thermistor and a PT1000 read a dedicated temperature input (temp0..temp3, with its
// pull-up resistor; an io input cannot read them without an external circuit), the thermocouple chips (MAX31855, MAX31856) and the PT100 chip (MAX31865) are SPI chips
// (a chip select pin), a linear analog sensor only needs a pin that reads a voltage (a temperature input or an io input)
export const SENSOR_NEEDS = { thermistor: 'temp', pt1000: 'temp', pt100: 'spi', thermocouple: 'spi', tc_max31856: 'spi', linear_analog: 'adc' }
// the thermistor kinds the person picks: the common one is the default; the others send T (ohm at 25 C), B (beta) and, when the table has one, C (Steinhart-Hart)
// to the service. Values from the Duet3D table "Typical parameter values" (epcos, honeywell, e3d); semitec is the one the page always had.
export const THERMISTOR_KINDS = ['ntc3950', 'semitec', 'epcos', 'honeywell', 'e3d', 'custom']
export const THERMISTOR_VALUES = { ntc3950: { t: 100000, b: 3950 }, semitec: { t: 100000, b: 4267 }, epcos: { t: 10000, b: 3988 }, honeywell: { t: 100000, b: 4138 }, e3d: { t: 100000, b: 4725, c: 7.06e-8 } }
export const THERMISTOR_T_RANGE = [1000, 10000000]
export const THERMISTOR_B_RANGE = [1000, 10000]
export const THERMISTOR_C_RANGE = [-1e-6, 1e-6] // our sanity bound (the docs only say default 0): a wrong exponent is a wrong temperature
// MAX31856: the thermocouple type letters (the alloys are the international notation, shown next to the letter) and the mains frequency of the filter
export const TC_TYPES = { B: 'Pt30Rh/Pt6Rh', E: 'NiCr/CuNi', J: 'Fe/CuNi', K: 'NiCr/NiAl', N: 'NiCrSi/NiSi', R: 'Pt13Rh/Pt', S: 'Pt10Rh/Pt', T: 'Cu/CuNi' }
export const MAINS_HZ = [50, 60]
// MAX31865 PT100: wires and reference resistor (100 to 600 ohm: ours, the firmware keeps hundredths of ohm in 16 bits; blank = the firmware default, 400)
export const RTD_WIRES = [2, 3, 4]
export const RTD_REF_RANGE = [100, 600]
// linear analog: the value at 0 V and at full scale (no default: an invented range reads a wrong temperature)
export const ANALOG_RANGE = [-273, 1500]
// the output: straight to a bed / heater MOSFET of the board ('dc', deduced from the pin: lib/bed-output.js) or through a relay (the person says which)
export const OUTPUT_KINDS = [KIND_DIRECT].concat(RELAY_KINDS)
// what the pin of each use needs (machine.tool.pins capabilities): a MOSFET of the board and a solid-state relay take PWM, a mechanical relay only switches
export const OUTPUT_NEED = { dc: 'pwm', ssr: 'pwm', ssrdc: 'pwm', relay: 'digital' }
// what the output pin list offers: every output of the board (PWM: out* and io*.out); an input never switches a heater, whatever the relay
export const OUTPUT_LIST_NEED = 'pwm'
export const sensorNeed = preset => SENSOR_NEEDS[preset] || 'temp'
const isTempPin = pin => /^temp\d+$/.test(String(pin || '').trim().replace(/^[!^]+/, ''))
export const MAX_BED = 31 // the highest bed number the board could ever hold when it does not tell (RRF bed numbers fit in 5 bits); `limits.bedHeaters` of the board wins
export const MAX_TEMP_RANGE = [50, 280]
export const DEFAULT_MAX_TEMP = 120

// What THIS board supports (object model `limits`, RRF 3.4+): how many beds (limits.bedHeaters) and heaters (limits.heaters) it can hold. null = the board did not say.
// There is no fixed number: a board that does not report its limits keeps the old ceilings only as the last resort (MAX_BED).
export function boardLimits(model) {
	const l = (model && model.limits) || {}
	const pos = v => (Number.isInteger(v) && v > 0 ? v : null)
	return { beds: pos(l.bedHeaters), heaters: pos(l.heaters) }
}

// The beds the board has or the files define, with what the object model knows of each (heater, sensor, name, limit, state): the page shows them, never hides them.
// `info` = normalizeBeds(machine.beds.get), `model` = the live object model. Sorted by bed number.
export function definedRows(info, model) {
	const heat = (model && model.heat) || {}
	const heaters = heat.heaters || []
	const analog = ((model && model.sensors) || {}).analog || []
	const rows = ((info && info.defined) || []).map(d => {
		const h = d.heater === null || d.heater === undefined ? null : heaters[d.heater] || null
		const sensor = h && Number.isInteger(h.sensor) ? h.sensor : null
		const s = sensor === null ? null : analog[sensor] || null
		return {
			bed: d.bed, heater: d.heater, loaded: true, editable: d.editable === true, fileSensor: d.sensor === undefined ? null : d.sensor, sensor, sensorName: s && s.name ? String(s.name) : '',
			max: h && Number.isFinite(h.max) ? h.max : null, state: h && h.state ? String(h.state) : ''
		}
	})
	;((info && info.inFiles) || []).forEach(bed => rows.push({ bed, heater: null, loaded: false, editable: false, fileSensor: null, sensor: null, sensorName: '', max: null, state: '' }))
	return rows.sort((a, b) => a.bed - b.bed)
}

// A draft row for a bed that is already defined is a mistake of the seed (the page asked for it before it knew): it is dropped; the defined bed is shown in its own card.
export function dropDefined(draft, definedBeds) {
	const kept = draft.beds.filter(b => { const n = whole(b.bed); return n === null || definedBeds.indexOf(n) < 0 })
	return { beds: kept }
}

const NAME_RE = /^[^";\r\n{}]{0,32}$/
// every code of a check of the page or of an error of the service this page shows (texts beds.err_<code>; the test of the texts keeps them)
export const ERROR_CODES = ['no_beds', 'bed_missing', 'bed_defined', 'bed_exists', 'bed_repeated', 'name', 'tool_name', 'max_temp', 'pin_missing', 'pin_used', 'pin_unknown', 'pin_capability', 'pin_duplicate', 'pin_not_mosfet', 'kind_unsupported', 'therm_t', 'therm_b', 'therm_c', 'tc_type', 'mains', 'wires', 'rtd_ref', 'analog_range', 'analog_filter', 'values', 'numbers', 'role', 'busy']

export function emptyBed(bed) {
	return { bed: bed === null || bed === undefined || bed === '' ? '' : String(bed), name: '', sensorPreset: 'thermistor', thermistorKind: 'ntc3950', thermT: '100000', thermB: '3950', thermC: '', tcType: 'K', mains: '50', wires: '4', rtdRef: '', analogLow: '', analogHigh: '', analogFiltered: true, sensorPin: '', outputKind: 'ssr', outputPin: '', maxTemp: String(DEFAULT_MAX_TEMP) }
}

// `beds` = the zone numbers to define (asked by the 3D printing page). Nothing asked = NO row: a zone row appears only when the person presses Add zone
// (a row that was always there looked like a zone that was already being created). `firstFree` is kept for the callers; it no longer makes a row.
export function createDraft(beds, firstFree) { // eslint-disable-line no-unused-vars
	const list = (Array.isArray(beds) ? beds : []).filter((n, i, a) => Number.isInteger(n) && a.indexOf(n) === i)
	return { beds: list.map(emptyBed) }
}

const whole = v => (/^\d+$/.test(String(v === null || v === undefined ? '' : v).trim()) ? parseInt(String(v).trim(), 10) : null)

function number(v) {
	const t = String(v === null || v === undefined ? '' : v).trim().replace(',', '.')
	return /^-?\d+(\.\d+)?$/.test(t) ? parseFloat(t) : null
}

// a number that may be written in scientific notation (the Steinhart-Hart C is 7.06e-8), or null
function scientific(v) {
	const t = String(v === null || v === undefined ? '' : v).trim().replace(',', '.')
	return /^-?\d+(\.\d+)?([eE][-+]?\d+)?$/.test(t) ? parseFloat(t) : null
}

const blank = v => String(v === null || v === undefined ? '' : v).trim() === ''

// the sensor of a row: what the service writes in the M308 line. Only the fields of the chosen type go (a thermistor that is not the default carries its T and B,
// a MAX31856 its type letter and mains frequency, a MAX31865 its wires, mains frequency and, if the person wrote one, its reference resistor, a linear sensor its range)
function sensorOf(b) {
	const sensor = { preset: PRESET_SERVICE[b.sensorPreset] || b.sensorPreset, pin: b.sensorPin }
	if (b.sensorPreset === 'thermistor') {
		const known = THERMISTOR_VALUES[b.thermistorKind]
		if (known && b.thermistorKind !== 'ntc3950') Object.assign(sensor, known)
		else if (b.thermistorKind === 'custom') {
			Object.assign(sensor, { t: number(b.thermT), b: number(b.thermB) })
			if (!blank(b.thermC)) sensor.c = scientific(b.thermC)
		}
	} else if (b.sensorPreset === 'tc_max31856') {
		Object.assign(sensor, { type: b.tcType, mains: whole(b.mains) })
	} else if (b.sensorPreset === 'pt100') {
		Object.assign(sensor, { wires: whole(b.wires), mains: whole(b.mains) })
		if (!blank(b.rtdRef)) sensor.ref = number(b.rtdRef)
	} else if (b.sensorPreset === 'linear_analog') {
		Object.assign(sensor, { low: number(b.analogLow), high: number(b.analogHigh), filtered: b.analogFiltered === true })
	}
	return sensor
}

// {beds: [{bed, name?, sensor: {preset, pin, t?, b?}, output: {kind, pin}, max_temp}]}: what the service takes
export function toSpec(draft) {
	return {
		beds: draft.beds.map(b => {
			const out = {
				bed: whole(b.bed), sensor: sensorOf(b), output: { kind: b.outputKind, pin: b.outputPin }, max_temp: number(b.maxTemp)
			}
			if (String(b.name || '').trim()) out.name = String(b.name).trim()
			return out
		})
	}
}

// the same draft always gives the same text: a change of it makes the preview and the plan under review stale
export function specKey(draft) {
	return JSON.stringify(toSpec(draft))
}

const pinName = raw => String(raw || '').trim().replace(/^[!^]+/, '')

// the free pins that fit a use and that no other pin of the draft already has (`slot` = the pin of this use now, which stays in the list)
export function pinChoices(pins, need, draft, slot) {
	const taken = []
	draft.beds.forEach(b => { [b.sensorPin, b.outputPin].forEach(p => { if (p && p !== slot) taken.push(pinName(p)) }) })
	return pins.free.filter(p => p.capabilities.indexOf(need) >= 0 && taken.indexOf(p.pin) < 0)
}

// the checks of the fields of the sensor type of a row: [{key, code, params?}] (the same ones the service makes, with the same ranges)
function sensorIssues(b) {
	const out = []
	const range = (v, r, key, code, params) => { const n = number(v); if (n === null || n < r[0] || n > r[1]) out.push({ key, code, params }) }
	if (b.sensorPreset === 'thermistor' && b.thermistorKind === 'custom') {
		range(b.thermT, THERMISTOR_T_RANGE, 'thermT', 'therm_t', { min: THERMISTOR_T_RANGE[0], max: THERMISTOR_T_RANGE[1] })
		range(b.thermB, THERMISTOR_B_RANGE, 'thermB', 'therm_b', { min: THERMISTOR_B_RANGE[0], max: THERMISTOR_B_RANGE[1] })
		const c = scientific(b.thermC)
		if (!blank(b.thermC) && (c === null || c < THERMISTOR_C_RANGE[0] || c > THERMISTOR_C_RANGE[1])) out.push({ key: 'thermC', code: 'therm_c', params: { min: '-0.000001', max: '0.000001' } })
	} else if (b.sensorPreset === 'tc_max31856') {
		if (!Object.prototype.hasOwnProperty.call(TC_TYPES, b.tcType)) out.push({ key: 'tcType', code: 'tc_type' })
		if (MAINS_HZ.indexOf(whole(b.mains)) < 0) out.push({ key: 'mains', code: 'mains' })
	} else if (b.sensorPreset === 'pt100') {
		if (RTD_WIRES.indexOf(whole(b.wires)) < 0) out.push({ key: 'wires', code: 'wires' })
		if (MAINS_HZ.indexOf(whole(b.mains)) < 0) out.push({ key: 'mains', code: 'mains' })
		if (!blank(b.rtdRef)) range(b.rtdRef, RTD_REF_RANGE, 'rtdRef', 'rtd_ref', { min: RTD_REF_RANGE[0], max: RTD_REF_RANGE[1] })
	} else if (b.sensorPreset === 'linear_analog') {
		const low = number(b.analogLow)
		const high = number(b.analogHigh)
		const p = { min: ANALOG_RANGE[0], max: ANALOG_RANGE[1] }
		if (low === null || low < ANALOG_RANGE[0] || low > ANALOG_RANGE[1]) out.push({ key: 'analogLow', code: 'analog_range', params: p })
		if (high === null || high < ANALOG_RANGE[0] || high > ANALOG_RANGE[1] || (low !== null && high <= low)) out.push({ key: 'analogHigh', code: 'analog_range', params: p })
		// the firmware filters (F1) only on a port made for thermistors: with an io input the filter has to be off
		if (b.analogFiltered === true && pinName(b.sensorPin) && !isTempPin(b.sensorPin)) out.push({ key: 'analogFiltered', code: 'analog_filter' })
	}
	return out
}

// the checks of the form: [{field, code, params?}]; `ctx` = {definedBeds: [numbers the board or a file already has], pins: {free, used}, canWrite, busy, maxBeds?: the beds the board supports (bed numbers are below it)}
export function bedIssues(draft, ctx) {
	const out = []
	const c = ctx || {}
	const pins = c.pins || { free: [], used: [] }
	const defined = c.definedBeds || []
	if (!draft.beds.length) out.push({ field: 'beds', code: 'no_beds' })
	const seenBeds = []
	const seenPins = []
	draft.beds.forEach((b, i) => {
		const f = k => 'beds.' + i + '.' + k
		const n = whole(b.bed)
		if (n === null || n > MAX_BED || (c.maxBeds && n >= c.maxBeds)) out.push({ field: f('bed'), code: 'bed_missing' })
		else if (defined.indexOf(n) >= 0) out.push({ field: f('bed'), code: 'bed_defined' })
		else if (seenBeds.indexOf(n) >= 0) out.push({ field: f('bed'), code: 'bed_repeated' })
		if (n !== null) seenBeds.push(n)
		if (!NAME_RE.test(String(b.name || ''))) out.push({ field: f('name'), code: 'name' })
		const t = number(b.maxTemp)
		if (t === null || t < MAX_TEMP_RANGE[0] || t > MAX_TEMP_RANGE[1]) out.push({ field: f('maxTemp'), code: 'max_temp', params: { min: MAX_TEMP_RANGE[0], max: MAX_TEMP_RANGE[1] } })
		sensorIssues(b).forEach(i => out.push({ field: f(i.key), code: i.code, params: i.params }))
		;[['sensorPin', sensorNeed(b.sensorPreset)], ['outputPin', OUTPUT_NEED[b.outputKind] || 'pwm']].forEach(([key, need]) => {
			const pin = pinName(b[key])
			if (!pin) { out.push({ field: f(key), code: 'pin_missing' }); return }
			const used = pins.used.find(u => u.pin === pin)
			const free = pins.free.find(p => p.pin === pin)
			if (used) out.push({ field: f(key), code: 'pin_used', params: { by: used.by } })
			else if (!free) out.push({ field: f(key), code: 'pin_unknown' })
			else if (free.capabilities.indexOf(need) < 0) out.push({ field: f(key), code: 'pin_capability' })
			else if (seenPins.indexOf(pin) >= 0) out.push({ field: f(key), code: 'pin_duplicate' })
			else if (key === 'outputPin' && kindIssue(b.outputKind, pin)) out.push({ field: f(key), code: kindIssue(b.outputKind, pin) })
			seenPins.push(pin)
		})
	})
	if (c.canWrite === false) out.push({ field: 'plan', code: 'role' })
	if (c.busy) out.push({ field: 'plan', code: 'busy' })
	return out
}

// the issues that are about the form (not the role or the busy machine: those only stop the plan, the person can still fill the form)
export function formIssues(issues) {
	return issues.filter(i => i.code !== 'role' && i.code !== 'busy')
}

// the step the page sends the person back to for an error of the service: always the form (one page), the field says which row
export function fieldOfError(error) {
	const m = /^beds\[(\d+)\]\.(.+)$/.exec(String(error && error.field || ''))
	if (!m) return String(error && error.field || '')
	const key = { 'bed': 'bed', 'name': 'name', 'max_temp': 'maxTemp', 'sensor.pin': 'sensorPin', 'sensor.preset': 'sensorPreset', 'sensor.t': 'thermT', 'sensor.b': 'thermB', 'sensor.c': 'thermC', 'sensor.type': 'tcType', 'sensor.mains': 'mains', 'sensor.wires': 'wires', 'sensor.ref': 'rtdRef', 'sensor.low': 'analogLow', 'sensor.high': 'analogHigh', 'sensor.filtered': 'analogFiltered', 'output.pin': 'outputPin', 'output.kind': 'outputKind' }[m[2]] || m[2]
	return 'beds.' + m[1] + '.' + key
}
