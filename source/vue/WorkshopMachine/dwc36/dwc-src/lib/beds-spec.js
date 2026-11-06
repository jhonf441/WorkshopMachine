'use strict'

// "Bed heaters" assistant (DWC 3.6): the draft of the form, the spec the service takes (machine.beds.preview and the plan config.bed_heaters, WorkshopService
// dsf/machine_beds.py) and the checks the page makes before asking. The service checks everything again (pins the board has, free numbers, the files), this only
// saves a round trip and says what is missing in the person's words. The pins are NEVER guessed: the person picks them from the free ones. Pure.

export const PRESETS = ['thermistor', 'pt1000']
export const OUTPUT_KINDS = ['ssr', 'ssrdc', 'relay']
// what the pin of each use needs (machine.tool.pins capabilities): a heater output of a solid-state relay is PWM, a relay output only switches
export const OUTPUT_NEED = { ssr: 'pwm', ssrdc: 'pwm', relay: 'digital' }
export const SENSOR_NEED = 'adc'
export const MAX_BED = 31
export const MAX_TEMP_RANGE = [50, 280]
export const DEFAULT_MAX_TEMP = 120
const NAME_RE = /^[^";\r\n{}]{0,32}$/
// every code of a check of the page or of an error of the service this page shows (texts beds.err_<code>; the test of the texts keeps them)
export const ERROR_CODES = ['no_beds', 'bed_missing', 'bed_defined', 'bed_exists', 'bed_repeated', 'name', 'tool_name', 'max_temp', 'pin_missing', 'pin_used', 'pin_unknown', 'pin_capability', 'pin_duplicate', 'values', 'numbers', 'role', 'busy']

export function emptyBed(bed) {
	return { bed: bed === null || bed === undefined || bed === '' ? '' : String(bed), name: '', sensorPreset: 'thermistor', sensorPin: '', outputKind: 'ssr', outputPin: '', maxTemp: String(DEFAULT_MAX_TEMP) }
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

// {beds: [{bed, name?, sensor: {preset, pin}, output: {kind, pin}, max_temp}]}: what the service takes
export function toSpec(draft) {
	return {
		beds: draft.beds.map(b => {
			const out = {
				bed: whole(b.bed), sensor: { preset: b.sensorPreset, pin: b.sensorPin }, output: { kind: b.outputKind, pin: b.outputPin }, max_temp: number(b.maxTemp)
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

// the checks of the form: [{field, code, params?}]; `ctx` = {definedBeds: [numbers the board or a file already has], pins: {free, used}, canWrite, busy}
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
		if (n === null || n > MAX_BED) out.push({ field: f('bed'), code: 'bed_missing' })
		else if (defined.indexOf(n) >= 0) out.push({ field: f('bed'), code: 'bed_defined' })
		else if (seenBeds.indexOf(n) >= 0) out.push({ field: f('bed'), code: 'bed_repeated' })
		if (n !== null) seenBeds.push(n)
		if (!NAME_RE.test(String(b.name || ''))) out.push({ field: f('name'), code: 'name' })
		const t = number(b.maxTemp)
		if (t === null || t < MAX_TEMP_RANGE[0] || t > MAX_TEMP_RANGE[1]) out.push({ field: f('maxTemp'), code: 'max_temp', params: { min: MAX_TEMP_RANGE[0], max: MAX_TEMP_RANGE[1] } })
		;[['sensorPin', SENSOR_NEED], ['outputPin', OUTPUT_NEED[b.outputKind] || 'pwm']].forEach(([key, need]) => {
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
	const key = { 'bed': 'bed', 'name': 'name', 'max_temp': 'maxTemp', 'sensor.pin': 'sensorPin', 'sensor.preset': 'sensorPreset', 'output.pin': 'outputPin', 'output.kind': 'outputKind' }[m[2]] || m[2]
	return 'beds.' + m[1] + '.' + key
}
