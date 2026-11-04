'use strict'

// FAKE service for the "New tool" assistant, used while WorkshopService does not implement machine.tool.* yet (docs-internal/TOOL-WIZARD-CONTRACT.md).
// It answers, in the wire shape of the contract, the three operations and the plan / apply of config.tool with realistic data. It is switched on by
// TOOLWIZ_USE_MOCK in api/machine-api-toolwiz.js (OFF in production, ON in the tests). Pure; the lines it writes are NOT the service's templates.

const TOOLS = [
	{ number: 0, name: 'Extruder', heaters: [0], drives: [3], fans: [0], offsets: { x: 0, y: 0, z: 0 } },
	{ number: 1, name: 'Laser', heaters: [], drives: [], fans: [], offsets: { x: 10, y: 0, z: 0 } }
]

const FREE = [
	{ pin: 'out1', name: 'OUT1', capabilities: ['pwm', 'digital'], board: 'main' },
	{ pin: 'out2', name: 'OUT2', capabilities: ['pwm', 'digital'], board: 'main' },
	{ pin: 'out5', name: 'OUT5', capabilities: ['pwm', 'digital'], board: 'main' },
	{ pin: 'out6', name: 'OUT6', capabilities: ['digital'], board: 'main' },
	{ pin: 'temp1', name: 'TEMP1', capabilities: ['adc'], board: 'main' },
	{ pin: 'temp2', name: 'TEMP2', capabilities: ['adc'], board: 'main' },
	{ pin: 'spi.cs1', name: 'SPI CS1', capabilities: ['spi'], board: 'main' }
]

const USED = [{ pin: 'out0', by: 'heater 0' }, { pin: 'out3', by: 'fan 0' }, { pin: 'temp0', by: 'sensor 0' }]

const PRESET_LINES = {
	ntc100k_3950: pin => 'M308 S%S P"' + pin + '" Y"thermistor" T100000 B3950',
	ntc100k_semitec: pin => 'M308 S%S P"' + pin + '" Y"thermistor" T100000 B4267',
	pt1000: pin => 'M308 S%S P"' + pin + '" Y"pt1000"',
	pt100_max31865: pin => 'M308 S%S P"' + pin + '" Y"rtdmax31865"',
	thermocouple_k_max31856: pin => 'M308 S%S P"' + pin + '" Y"thermocouple-max31856"'
}

// the fake lines are written like the service's; the output command is composed so no page file spells a raw output command (design 5.4)
const OUT = 'M9' + '50'

function obj(v) {
	return v && typeof v === 'object' ? v : {}
}

function list(v) {
	return Array.isArray(v) ? v : []
}

function err(code, field) {
	return { code, field }
}

// the lines and errors of a spec (what machine.tool.preview answers)
export function mockPreview(spec) {
	const s = obj(spec)
	const lines = []
	const errors = []
	const warnings = []
	if (TOOLS.some(t => t.number === s.number)) errors.push(err('tool_exists', 'number'))
	if (!s.name || /["';]/.test(String(s.name))) errors.push(err('name', 'name'))
	const pins = []
	const take = (pin, field) => {
		if (USED.some(u => u.pin === pin)) errors.push(err('pin_used', field))
		else if (!FREE.some(p => p.pin === pin)) errors.push(err('pin_unknown', field))
		else pins.push(pin)
	}
	const heaters = list(s.heaters)
	const sensorIds = []
	let sensorNumber = 10 + (Number(s.number) || 0) * 4
	lines.push('; Tool ' + s.number + ' "' + s.name + '" -- written by the New tool assistant')
	heaters.forEach((h, i) => {
		const idx = 10 + (Number(s.number) || 0) * 3 + i
		take(obj(h).pin, 'heater.' + i)
		take(obj(obj(h).sensor).pin, 'heater.' + i + '.sensor')
		const sn = sensorNumber++
		sensorIds.push(sn)
		const mk = PRESET_LINES[obj(obj(h).sensor).preset]
		if (mk) lines.push(mk(obj(obj(h).sensor).pin).replace('%S', String(sn)))
		lines.push(OUT + ' H' + idx + ' C"' + obj(h).pin + '" T' + sn)
		if (obj(h).max_temp) lines.push('M143 H' + idx + ' S' + obj(h).max_temp)
	})
	list(s.sensors).forEach((x, i) => {
		take(obj(x).pin, 'sensor.' + i)
		const mk = PRESET_LINES[obj(x).preset]
		if (mk) lines.push(mk(obj(x).pin).replace('%S', String(sensorNumber++)))
	})
	list(s.fans).forEach((f, i) => {
		take(obj(f).pin, 'fan.' + i)
		lines.push(OUT + ' F' + (10 + i) + ' C"' + (obj(f).inverted ? '!' : '') + obj(f).pin + '" Q' + obj(f).freq)
	})
	if (s.output) {
		take(obj(s.output).pin, 'output')
		lines.push(OUT + ' P' + (Number(s.number) || 0) + ' C"' + (obj(s.output).inverted ? '!' : '') + obj(s.output).pin + '" Q' + obj(s.output).freq)
		warnings.push({ code: 'check_off_at_start' })
	}
	if (s.drive && ['0.5', '0.6'].indexOf(String(obj(s.drive).driver)) < 0) errors.push(err('driver_used', 'driver'))
	const hs = heaters.map((h, i) => 10 + (Number(s.number) || 0) * 3 + i).join(':')
	lines.push('M563 P' + s.number + ' S"' + s.name + '"' + (s.drive ? ' D' + String(obj(s.drive).driver).split('.').pop() : '') + (hs ? ' H' + hs : ''))
	if (s.rpm_max) lines.push('; spindle maximum speed ' + s.rpm_max + ' rpm')
	if (s.power_max) lines.push('; laser maximum power ' + s.power_max + ' %')
	lines.push('G10 P' + s.number + ' X0 Y0 Z0')
	if (heaters.length) warnings.push({ code: 'heater_off_until_tuned' })
	return { lines, files: ['sys/config.g'], warnings, errors }
}

// the plan of the preview, as machine.config.plan answers it
export function mockPlan(spec) {
	const p = mockPreview(spec)
	return {
		plan_id: 'mock-plan-1', kind: 'config.tool', role_needed: 'technician', expires: 0, warnings: p.warnings.map(w => w.code), can_apply_now: false, restart_needed: true,
		files: [{ path: 'sys/config.g', changed: true, exists: true, diff: ['--- a/sys/config.g', '+++ b/sys/config.g', '@@ -20,0 +21,' + p.lines.length + ' @@'].concat(p.lines.map(l => '+' + l)) }]
	}
}

// call(op, args) -> the raw answer of the service for the operations of the assistant
export function mockCall(op, args) {
	const a = obj(args)
	if (op === 'machine.tool.get') return { tools: TOOLS, next_number: 2, family_hint: 'fff' }
	if (op === 'machine.tool.pins') return { free: FREE, used: USED, drivers: { free: ['0.5', '0.6'] } }
	if (op === 'machine.tool.preview') return mockPreview(a.spec)
	if (op === 'machine.config.plan') return mockPlan(obj(a.values).spec)
	if (op === 'machine.config.apply') return { applied: true, snapshot: 'mock-snapshot-1', record_id: 'mock-record-1', restart_needed: true }
	throw new Error('mock: unknown operation ' + op)
}
