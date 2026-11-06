'use strict'

// "Bed heaters" assistant (DWC 3.6): the draft of the form, the spec the service takes (machine.beds.preview and the plan config.bed_heaters, WorkshopService
// dsf/machine_beds.py) and the checks the page makes before asking. The service checks everything again (pins the board has, free numbers, the files), this only
// saves a round trip and says what is missing in the person's words. The pins are NEVER guessed: the person picks them from the free ones. Pure.

export const PRESETS = ['thermistor', 'pt1000', 'thermocouple', 'pt100']
// what the pin of each sensor type needs (machine.tool.pins capabilities): a thermistor and a PT1000 read a dedicated temperature input (temp0..temp3, with its
// pull-up resistor; an io input cannot read them without an external circuit), a K thermocouple (MAX31855) and a PT100 (MAX31865) are SPI chips (a chip select pin)
export const SENSOR_NEEDS = { thermistor: 'temp', pt1000: 'temp', thermocouple: 'spi', pt100: 'spi' }
// the thermistor kinds the person picks: the common one is the default; the other two send T (ohm at 25 C) and B (beta) to the service
export const THERMISTOR_KINDS = ['ntc3950', 'semitec', 'custom']
export const THERMISTOR_VALUES = { ntc3950: { t: 100000, b: 3950 }, semitec: { t: 100000, b: 4267 } }
export const THERMISTOR_T_RANGE = [1000, 10000000]
export const THERMISTOR_B_RANGE = [1000, 10000]
export const OUTPUT_KINDS = ['ssr', 'ssrdc', 'relay']
// what the pin of each use needs (machine.tool.pins capabilities): a heater output of a solid-state relay is PWM, a relay output only switches
export const OUTPUT_NEED = { ssr: 'pwm', ssrdc: 'pwm', relay: 'digital' }
export const sensorNeed = preset => SENSOR_NEEDS[preset] || 'temp'
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
export const ERROR_CODES = ['no_beds', 'bed_missing', 'bed_defined', 'bed_exists', 'bed_repeated', 'name', 'tool_name', 'max_temp', 'pin_missing', 'pin_used', 'pin_unknown', 'pin_capability', 'pin_duplicate', 'therm_t', 'therm_b', 'values', 'numbers', 'role', 'busy']

export function emptyBed(bed) {
	return { bed: bed === null || bed === undefined || bed === '' ? '' : String(bed), name: '', sensorPreset: 'thermistor', thermistorKind: 'ntc3950', thermT: '100000', thermB: '3950', sensorPin: '', outputKind: 'ssr', outputPin: '', maxTemp: String(DEFAULT_MAX_TEMP) }
}

// `beds` = the bed numbers to define (from the 3D printing page, or the first free number); at least one row so the form is never empty
export function createDraft(beds, firstFree) {
	const list = (Array.isArray(beds) ? beds : []).filter((n, i, a) => Number.isInteger(n) && a.indexOf(n) === i)
	return { beds: (list.length ? list : [firstFree === undefined ? null : firstFree]).map(emptyBed) }
}

const whole = v => (/^\d+$/.test(String(v === null || v === undefined ? '' : v).trim()) ? parseInt(String(v).trim(), 10) : null)

function number(v) {
	const t = String(v === null || v === undefined ? '' : v).trim().replace(',', '.')
	return /^-?\d+(\.\d+)?$/.test(t) ? parseFloat(t) : null
}

// the sensor of a row: a thermistor that is not the default carries its T and B (the service writes them in the M308 line)
function sensorOf(b) {
	const sensor = { preset: b.sensorPreset, pin: b.sensorPin }
	if (b.sensorPreset !== 'thermistor') return sensor
	const known = THERMISTOR_VALUES[b.thermistorKind]
	if (known && b.thermistorKind !== 'ntc3950') Object.assign(sensor, known)
	else if (b.thermistorKind === 'custom') Object.assign(sensor, { t: number(b.thermT), b: number(b.thermB) })
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
		if (b.sensorPreset === 'thermistor' && b.thermistorKind === 'custom') {
			const rt = number(b.thermT)
			const rb = number(b.thermB)
			if (rt === null || rt < THERMISTOR_T_RANGE[0] || rt > THERMISTOR_T_RANGE[1]) out.push({ field: f('thermT'), code: 'therm_t', params: { min: THERMISTOR_T_RANGE[0], max: THERMISTOR_T_RANGE[1] } })
			if (rb === null || rb < THERMISTOR_B_RANGE[0] || rb > THERMISTOR_B_RANGE[1]) out.push({ field: f('thermB'), code: 'therm_b', params: { min: THERMISTOR_B_RANGE[0], max: THERMISTOR_B_RANGE[1] } })
		}
		;[['sensorPin', sensorNeed(b.sensorPreset)], ['outputPin', OUTPUT_NEED[b.outputKind] || 'pwm']].forEach(([key, need]) => {
			const pin = pinName(b[key])
			if (!pin) { out.push({ field: f(key), code: 'pin_missing' }); return }
			const used = pins.used.find(u => u.pin === pin)
			const free = pins.free.find(p => p.pin === pin)
			if (used) out.push({ field: f(key), code: 'pin_used', params: { by: used.by } })
			else if (!free) out.push({ field: f(key), code: 'pin_unknown' })
			else if (free.capabilities.indexOf(need) < 0) out.push({ field: f(key), code: 'pin_capability' })
			else if (seenPins.indexOf(pin) >= 0) out.push({ field: f(key), code: 'pin_duplicate' })
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
	const key = { 'bed': 'bed', 'name': 'name', 'max_temp': 'maxTemp', 'sensor.pin': 'sensorPin', 'sensor.preset': 'sensorPreset', 'sensor.t': 'thermT', 'sensor.b': 'thermB', 'output.pin': 'outputPin', 'output.kind': 'outputKind' }[m[2]] || m[2]
	return 'beds.' + m[1] + '.' + key
}
