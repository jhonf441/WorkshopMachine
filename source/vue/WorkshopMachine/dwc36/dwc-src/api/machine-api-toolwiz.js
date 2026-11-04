'use strict'

// "New tool" assistant: the ONLY place that knows the operation names and the shape of the answers (docs-internal/TOOL-WIZARD-CONTRACT.md):
//   machine.tool.get      -> {tools: [{number, name, heaters, drives, fans, offsets}], next_number, family_hint}
//   machine.tool.pins     -> {free: [{pin, name, capabilities, board}], used: [{pin, by}]}  (+ optional drivers: {free: [id]})
//   machine.tool.preview  {spec} -> {lines, files, warnings, errors}  (writes nothing)
//   the plan: kind config.tool through machine.config.plan / machine.config.apply (the same plan flow of every other section; level 3 confirmation by api())
// The service part is NOT installed yet: TOOLWIZ_USE_MOCK answers with fake data (api/machine-api-toolwiz-mock.js). Switching it to false is all that is needed.

import { normalizePlan } from './machine-api-p2.js'
import { normalizePins } from '../lib/toolwiz-pins.js'
import { normalizePreview } from '../lib/toolwiz-preview.js'
import { mockCall } from './machine-api-toolwiz-mock.js'

// ---- THE SWITCH: false in production; the tests build the adapter with {mock: true} ----
export const TOOLWIZ_USE_MOCK = false

export const OPS_TOOLWIZ = { get: 'machine.tool.get', pins: 'machine.tool.pins', preview: 'machine.tool.preview' }
export const KIND_TOOL = 'config.tool'

function obj(v) {
	return v && typeof v === 'object' && !Array.isArray(v) ? v : {}
}

function list(v) {
	return Array.isArray(v) ? v : []
}

export function normalizeTools(raw) {
	const r = obj(raw)
	const next = Number(r.next_number)
	return {
		tools: list(r.tools).map(t => ({ number: Number(obj(t).number), name: String(obj(t).name || ''), heaters: list(obj(t).heaters), drives: list(obj(t).drives), fans: list(obj(t).fans) })).filter(t => Number.isInteger(t.number)),
		nextNumber: Number.isInteger(next) ? next : null,
		familyHint: String(r.family_hint || '')
	}
}

// `call` is api() of the shared client, `config` the config part of the Machine api (plan / apply); options.mock overrides TOOLWIZ_USE_MOCK
export function createToolWizardApi(call, config, options) {
	const mock = options && options.mock !== undefined ? !!options.mock : TOOLWIZ_USE_MOCK
	const run = mock ? async (op, args) => mockCall(op, args) : call
	return {
		mock,
		get: async () => normalizeTools(await run(OPS_TOOLWIZ.get, {})),
		pins: async kind => normalizePins(await run(OPS_TOOLWIZ.pins, kind ? { kind } : {})),
		preview: async spec => normalizePreview(await run(OPS_TOOLWIZ.preview, { spec })),
		plan: async spec => (mock ? normalizePlan(await run('machine.config.plan', { kind: KIND_TOOL, values: { spec } })) : config.plan(KIND_TOOL, { spec })),
		apply: async plan => {
			if (!mock) return config.apply(plan.id, plan.kind)
			const r = obj(await run('machine.config.apply', { plan_id: plan.id, kind: plan.kind }))
			return { applied: !!r.applied, snapshot: r.snapshot || null, recordId: r.record_id || null, restartNeeded: !!r.restart_needed }
		}
	}
}
