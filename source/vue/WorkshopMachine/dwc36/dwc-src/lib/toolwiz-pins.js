'use strict'

// "New tool" assistant, pins: only the free pins that can do what the item needs, never one already given to another item of the draft.
// machine.tool.pins -> {free: [{pin, name, capabilities, board}], used: [{pin, by}]} (+ optional drivers: {free: [id]}). Pure.

import { presetOf, typeInfo } from './toolwiz-spec.js'

function list(v) {
	return Array.isArray(v) ? v : []
}

function obj(v) {
	return v && typeof v === 'object' ? v : {}
}

export function normalizePins(raw) {
	const r = obj(raw)
	return {
		free: list(r.free).map(p => ({ pin: String(obj(p).pin || ''), name: String(obj(p).name || obj(p).pin || ''), capabilities: list(obj(p).capabilities).map(String), board: String(obj(p).board || '') })).filter(p => p.pin),
		used: list(r.used).map(p => ({ pin: String(obj(p).pin || ''), by: String(obj(p).by || '') })).filter(p => p.pin),
		freeDrivers: r.drivers && typeof r.drivers === 'object' ? list(r.drivers.free).map(String) : null
	}
}

// what the item needs: heater, fan and the output of a spindle or laser take a PWM output, a sensor depends on its preset
export const PIN_NEED = { heater: ['pwm'], fan: ['pwm'], output: ['pwm'], sensor: ['temp'] }

export function needsOf(role, preset) {
	if (role === 'sensor') return [(presetOf(preset) || { need: 'temp' }).need]
	return PIN_NEED[role] || ['digital']
}

// the slots of the draft that need a pin: [{id, role, preset, value}]; `value` is the pin chosen now
export function pinSlots(draft) {
	const info = typeInfo(draft.type)
	const out = []
	if (!info) return out
	if (info.output) out.push({ id: 'output', role: 'output', preset: '', value: draft.output.pin })
	draft.heaters.forEach((h, i) => {
		out.push({ id: 'heater.' + i, role: 'heater', preset: '', value: h.pin })
		out.push({ id: 'heater.' + i + '.sensor', role: 'sensor', preset: h.sensorPreset, value: h.sensorPin })
	})
	draft.fans.forEach((f, i) => out.push({ id: 'fan.' + i, role: 'fan', preset: '', value: f.pin }))
	draft.sensors.forEach((s, i) => out.push({ id: 'sensor.' + i, role: 'sensor', preset: s.preset, value: s.pin }))
	return out
}

// the free pins that fit the slot and are not taken by another slot of the draft
export function pinOptions(pins, slot, slots) {
	const need = needsOf(slot.role, slot.preset)
	const taken = slots.filter(s => s.id !== slot.id && s.value).map(s => s.value)
	return pins.free.filter(p => need.some(n => p.capabilities.indexOf(n) >= 0) && taken.indexOf(p.pin) < 0)
}

// the checks of the pins step: every slot has a pin, it is free, it has the capability and nobody else in the draft has it
export function checkPins(draft, pins) {
	const slots = pinSlots(draft)
	const out = []
	slots.forEach(s => {
		if (!s.value) {
			out.push({ field: s.id, code: 'pin_missing' })
			return
		}
		const used = pins.used.find(u => u.pin === s.value)
		const free = pins.free.find(p => p.pin === s.value)
		if (used) out.push({ field: s.id, code: 'pin_used', params: { by: used.by } })
		else if (!free) out.push({ field: s.id, code: 'pin_unknown' })
		else if (!needsOf(s.role, s.preset).some(n => free.capabilities.indexOf(n) >= 0)) out.push({ field: s.id, code: 'pin_capability' })
		else if (slots.some(o => o.id !== s.id && o.value === s.value)) out.push({ field: s.id, code: 'pin_duplicate' })
	})
	return out
}

// write the chosen pin into the draft slot
export function setPin(draft, slotId, pin) {
	const m = /^(heater|fan|sensor)\.(\d+)(\.sensor)?$/.exec(slotId)
	if (slotId === 'output') draft.output.pin = pin
	else if (m && m[1] === 'heater') {
		if (m[3]) draft.heaters[+m[2]].sensorPin = pin
		else draft.heaters[+m[2]].pin = pin
	} else if (m && m[1] === 'fan') draft.fans[+m[2]].pin = pin
	else if (m && m[1] === 'sensor') draft.sensors[+m[2]].pin = pin
	return draft
}
