'use strict'

// "New tool" assistant: the draft the person fills in, what each tool type carries, and the checks of every step. Pure (no Vue, no network).
// The service decides (machine.tool.*, docs-internal/TOOL-WIZARD-CONTRACT.md); these checks only keep the person from walking into a refusal.
// Every check answers {field, code}; the text of a code is toolwiz.err_<code>.

export const TOOL_RANGE = { numberMin: 0, numberMax: 49, nameMax: 32, tempMin: 50, tempMax: 450, rpmMax: 100000, powerMax: 100, freqMin: 1, freqMax: 65535 }

// What each type may carry: the driver of an extruder, heaters, fans, temperature sensors, a PWM/digital output. `mode` is the machine mode it belongs to.
export const TOOL_TYPES = {
	fff_extruder: { mode: 'FFF', icon: 'mdi-printer-3d-nozzle-outline', drive: true, heaters: 2, fans: 2, sensors: 2, output: false },
	pellet_extruder: { mode: 'FFF', icon: 'mdi-screw-lag', drive: true, heaters: 3, fans: 2, sensors: 3, output: false },
	spindle: { mode: 'CNC', icon: 'mdi-saw-blade', drive: false, heaters: 0, fans: 1, sensors: 0, output: true },
	laser: { mode: 'Laser', icon: 'mdi-laser-pointer', drive: false, heaters: 0, fans: 1, sensors: 0, output: true },
	contact_probe: { mode: 'FFF', icon: 'mdi-target', drive: false, heaters: 0, fans: 0, sensors: 0, output: false },
	generic: { mode: 'FFF', icon: 'mdi-tools', drive: false, heaters: 1, fans: 1, sensors: 1, output: false }
}
// the four parts of the help of every row (toolwiz.h_<topic>_<part>)
export const HELP_PARTS = ['what', 'why', 'missing', 'how']

// the rows that have a help (toolwiz.h_<topic>_<part>) and the codes of the checks of the fields (toolwiz.err_<code>): the texts are looked up by these names
export const HELP_TOPICS = ['type', 'file', 'number', 'name', 'driver', 'output', 'rpm', 'power', 'sensor', 'maxtemp', 'fan', 'pin', 'pin_sensor', 'preview', 'checks', 'autotune', 'off', 'apply']
export const ERROR_CODES = ['type', 'name', 'tool_number', 'tool_exists', 'driver_unknown', 'driver_used', 'too_many', 'heater_no_sensor', 'heater_no_max', 'heater_max_range', 'sensor_preset', 'freq', 'rpm_range', 'power_range', 'laser_mode', 'pin_missing', 'pin_used', 'pin_unknown', 'pin_capability', 'pin_duplicate', 'preview_stale', 'preview_no_max', 'preview_activates', 'not_applied', 'values', 'other']

export const TYPE_IDS = Object.keys(TOOL_TYPES)

// Temperature sensor presets: what the person picks instead of typing M308 parameters. `need` is the pin capability the sensor takes
// (thermistors and PT1000 read an analogue input, the others a SPI chip).
export const SENSOR_PRESETS = [
	{ id: 'ntc100k_3950', need: 'adc', hint: 280 },
	{ id: 'ntc100k_semitec', need: 'adc', hint: 300 },
	{ id: 'pt1000', need: 'adc', hint: 450 },
	{ id: 'pt100_max31865', need: 'spi', hint: 450 },
	{ id: 'thermocouple_k_max31856', need: 'spi', hint: 450 }
]

export function presetOf(id) {
	return SENSOR_PRESETS.find(p => p.id === id) || null
}

export function emptyHeater() {
	return { pin: '', sensorPreset: '', sensorPin: '', maxTemp: '' }
}

export function emptyFan() {
	return { pin: '', freq: '250', inverted: false }
}

export function emptySensor() {
	return { preset: '', pin: '' }
}

export function newDraft(nextNumber) {
	return {
		type: '', number: nextNumber === undefined || nextNumber === null ? '' : String(nextNumber), name: '', driver: '', heaters: [], fans: [], sensors: [],
		output: { pin: '', freq: '5000', inverted: false }, rpmMax: '', powerMax: '', ackAutotune: false, ackOff: false
	}
}

export function typeInfo(type) {
	return TOOL_TYPES[type] || null
}

// text -> number (a comma is accepted) or null
export function toNumber(v) {
	const s = String(v === undefined || v === null ? '' : v).trim().replace(',', '.')
	if (s === '' || !/^-?\d+(\.\d+)?$/.test(s)) return null
	return Number(s)
}

export function whole(v) {
	const n = toNumber(v)
	return n !== null && Number.isInteger(n) ? n : null
}

// ---- checks per step ----

// ctx: {usedNumbers: [n], freeDrivers: [id] | null, laserMode: bool}
export function checkType(draft) {
	return typeInfo(draft.type) ? [] : [{ field: 'type', code: 'type' }]
}

export function checkName(draft, ctx) {
	const out = []
	const name = String(draft.name || '').trim()
	if (!name || name.length > TOOL_RANGE.nameMax || /["';]/.test(name)) out.push({ field: 'name', code: 'name' })
	const n = whole(draft.number)
	if (n === null || n < TOOL_RANGE.numberMin || n > TOOL_RANGE.numberMax) out.push({ field: 'number', code: 'tool_number' })
	else if (((ctx && ctx.usedNumbers) || []).indexOf(n) >= 0) out.push({ field: 'number', code: 'tool_exists' })
	return out
}

function freqOk(v) {
	const q = whole(v)
	return q !== null && q >= TOOL_RANGE.freqMin && q <= TOOL_RANGE.freqMax
}

export function checkCarries(draft, ctx) {
	const info = typeInfo(draft.type)
	if (!info) return [{ field: 'type', code: 'type' }]
	const out = []
	if (info.drive) {
		const free = ctx && ctx.freeDrivers
		if (!/^\d+(\.\d+)?$/.test(String(draft.driver || '').trim())) out.push({ field: 'driver', code: 'driver_unknown' })
		else if (free && free.indexOf(String(draft.driver).trim()) < 0) out.push({ field: 'driver', code: 'driver_used' })
	}
	if (draft.heaters.length > info.heaters) out.push({ field: 'heaters', code: 'too_many' })
	if (draft.fans.length > info.fans) out.push({ field: 'fans', code: 'too_many' })
	if (draft.sensors.length > info.sensors) out.push({ field: 'sensors', code: 'too_many' })
	draft.heaters.forEach((h, i) => {
		if (!presetOf(h.sensorPreset)) out.push({ field: 'heater.' + i + '.sensor', code: 'heater_no_sensor' })
		const t = toNumber(h.maxTemp)
		if (t === null) out.push({ field: 'heater.' + i + '.max', code: 'heater_no_max' })
		else if (t < TOOL_RANGE.tempMin || t > TOOL_RANGE.tempMax) out.push({ field: 'heater.' + i + '.max', code: 'heater_max_range' })
	})
	draft.sensors.forEach((s, i) => { if (!presetOf(s.preset)) out.push({ field: 'sensor.' + i + '.preset', code: 'sensor_preset' }) })
	draft.fans.forEach((f, i) => { if (!freqOk(f.freq)) out.push({ field: 'fan.' + i + '.freq', code: 'freq' }) })
	if (info.output && !freqOk(draft.output.freq)) out.push({ field: 'output.freq', code: 'freq' })
	if (draft.type === 'spindle') {
		const r = whole(draft.rpmMax)
		if (r === null || r < 1 || r > TOOL_RANGE.rpmMax) out.push({ field: 'rpm_max', code: 'rpm_range' })
	}
	if (draft.type === 'laser') {
		const p = toNumber(draft.powerMax)
		if (p === null || p < 1 || p > TOOL_RANGE.powerMax) out.push({ field: 'power_max', code: 'power_range' })
		else if (ctx && ctx.laserMode === false) out.push({ field: 'power_max', code: 'laser_mode' })
	}
	return out
}

// The service spec (contract section 3, extended with heaters, fans and sensors: the contract has to grow the same way). Numbers become numbers.
export function toSpec(draft) {
	const info = typeInfo(draft.type) || {}
	const spec = { type: draft.type, number: whole(draft.number), name: String(draft.name || '').trim() }
	if (info.output) spec.output = { pin: draft.output.pin, freq: whole(draft.output.freq), inverted: !!draft.output.inverted }
	if (info.drive) spec.drive = { driver: String(draft.driver || '').trim() }
	if (draft.heaters.length) spec.heaters = draft.heaters.map(h => ({ pin: h.pin, sensor: { preset: h.sensorPreset, pin: h.sensorPin }, max_temp: toNumber(h.maxTemp) }))
	if (draft.fans.length) spec.fans = draft.fans.map(f => ({ pin: f.pin, freq: whole(f.freq), inverted: !!f.inverted }))
	if (draft.sensors.length) spec.sensors = draft.sensors.map(s => ({ preset: s.preset, pin: s.pin }))
	if (draft.type === 'spindle') spec.rpm_max = whole(draft.rpmMax)
	if (draft.type === 'laser') spec.power_max = toNumber(draft.powerMax)
	return spec
}

export function specKey(draft) {
	return JSON.stringify(toSpec(draft))
}
