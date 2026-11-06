'use strict'

// "Bed heaters" assistant: the ONLY place that knows the operation names and the shape of the answers (WorkshopService dsf/machine_beds.py):
//   machine.beds.get      -> {defined: [{bed, heater}], in_files: [bed], next: {heater, sensor, beds: [bed]}, max_beds}
//   machine.tool.pins     -> {free: [{pin, capabilities}], used: [{pin, by}]}     (the free and used pins of the board: the same answer the tool assistant uses)
//   machine.beds.preview  {spec} -> {lines, files, warnings, errors, beds}        (writes nothing)
//   the plan: kind config.bed_heaters through machine.config.plan / machine.config.apply (the plan flow of every other section; level 3 confirmation by api())

import { normalizePins } from '../lib/toolwiz-pins.js'
import { normalizePreview } from '../lib/toolwiz-preview.js'

export const OPS_BEDS = { get: 'machine.beds.get', pins: 'machine.tool.pins', preview: 'machine.beds.preview' }
export const KIND_BEDS = 'config.bed_heaters'

function obj(v) {
	return v && typeof v === 'object' && !Array.isArray(v) ? v : {}
}

function list(v) {
	return Array.isArray(v) ? v : []
}

const num = v => (Number.isInteger(Number(v)) && v !== null && v !== '' ? Number(v) : null)

export function normalizeBeds(raw) {
	const r = obj(raw)
	const next = obj(r.next)
	return {
		defined: list(r.defined).map(d => ({ bed: Number(obj(d).bed), heater: num(obj(d).heater) })).filter(d => Number.isInteger(d.bed)),
		inFiles: list(r.in_files).map(Number).filter(Number.isInteger),
		next: { heater: num(next.heater), sensor: num(next.sensor), beds: list(next.beds).map(Number).filter(Number.isInteger) },
		maxBeds: Number.isInteger(Number(r.max_beds)) && Number(r.max_beds) > 0 ? Number(r.max_beds) : 8
	}
}

// `call` is api() of the shared client, `config` the config part of the Machine api (plan / apply)
export function createBedsApi(call, config) {
	return {
		get: async () => normalizeBeds(await call(OPS_BEDS.get, {})),
		pins: async () => normalizePins(await call(OPS_BEDS.pins, {})),
		preview: async spec => normalizePreview(await call(OPS_BEDS.preview, { spec })),
		plan: async spec => config.plan(KIND_BEDS, { spec }),
		apply: async plan => config.apply(plan.id, plan.kind)
	}
}
