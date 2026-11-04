'use strict'

// "New tool" assistant: the explicit state machine of the steps. Plain object + plain functions (no Vue, no network).
//   step      the step on show; `applied` (the plan was applied) locks the draft and leaves only the last two steps
//   preview   {key, data} of the last machine.tool.preview; it is FRESH only while key equals the spec of the draft (any edit makes it stale)
// The page walks forward only when the checks of the step it leaves are clean, and can always walk back (until applied).

import { newDraft, typeInfo, checkType, checkName, checkCarries, specKey, emptyHeater, emptyFan, emptySensor } from '../lib/toolwiz-spec.js'
import { checkPins } from '../lib/toolwiz-pins.js'
import { previewIssues } from '../lib/toolwiz-preview.js'
import { applyBlockers } from '../lib/toolwiz-safety.js'

export const STEPS = ['type', 'name', 'carries', 'pins', 'preview', 'apply', 'tests']

export function createWizard(nextNumber) {
	return { step: 'type', draft: newDraft(nextNumber), preview: null, applied: null, tests: {} }
}

export function stepIndex(id) {
	return STEPS.indexOf(id)
}

export function previewFresh(w) {
	return !!w.preview && w.preview.key === specKey(w.draft)
}

// ctx: {usedNumbers, freeDrivers, laserMode, pins, canWrite, busy} -> [{field, code, params?}] that stop the person from leaving the step
export function stepIssues(w, id, ctx) {
	const d = w.draft
	if (id === 'type') return checkType(d)
	if (id === 'name') return checkName(d, ctx)
	if (id === 'carries') return checkCarries(d, ctx)
	if (id === 'pins') return checkPins(d, ctx.pins)
	if (id === 'preview') return previewFresh(w) ? previewIssues(w.preview.data, d.heaters.length) : [{ field: 'preview', code: 'preview_stale' }]
	if (id === 'apply') {
		if (w.applied) return []
		const fresh = previewFresh(w)
		return applyBlockers(d, { canWrite: ctx.canWrite, busy: ctx.busy, previewFresh: fresh, previewOk: fresh && previewIssues(w.preview.data, d.heaters.length).length === 0 }).map(code => ({ field: 'apply', code }))
	}
	return w.applied ? [] : [{ field: 'tests', code: 'not_applied' }]
}

// can the person open `id` now? Before applying: every earlier step (but the apply one) is clean; after applying: only apply and tests
export function canGo(w, id, ctx) {
	const to = stepIndex(id)
	if (to < 0) return false
	if (w.applied) return id === 'apply' || id === 'tests'
	if (to <= stepIndex(w.step)) return true
	if (id === 'tests') return false
	return STEPS.slice(0, to).every(s => s === 'apply' || stepIssues(w, s, ctx).length === 0)
}

export function go(w, id, ctx) {
	if (!canGo(w, id, ctx)) return false
	w.step = id
	return true
}

// {moved, issues}: leaving a step with issues does nothing and says why
export function next(w, ctx) {
	const issues = stepIssues(w, w.step, ctx)
	const i = stepIndex(w.step)
	if (w.step === 'apply') {
		if (!w.applied) return { moved: false, issues }
	} else if (issues.length) return { moved: false, issues }
	if (i >= STEPS.length - 1) return { moved: false, issues: [] }
	w.step = STEPS[i + 1]
	return { moved: true, issues: [] }
}

export function back(w) {
	const i = stepIndex(w.step)
	if (i <= 0 || w.applied) return false
	w.step = STEPS[i - 1]
	return true
}

// ---- edits (refused once applied) ----

export function setType(w, type) {
	if (w.applied || !typeInfo(type)) return false
	const d = w.draft
	d.type = type
	d.driver = ''
	d.heaters = []
	d.fans = []
	d.sensors = []
	d.rpmMax = ''
	d.powerMax = ''
	d.ackAutotune = false
	d.ackOff = false
	return true
}

const NEW = { heaters: emptyHeater, fans: emptyFan, sensors: emptySensor }

// add one heater / fan / sensor if the type allows another; false otherwise
export function addItem(w, kind) {
	const info = typeInfo(w.draft.type)
	if (w.applied || !info || !NEW[kind] || w.draft[kind].length >= info[kind]) return false
	w.draft[kind].push(NEW[kind]())
	if (kind === 'heaters') w.draft.ackAutotune = false
	return true
}

export function removeItem(w, kind, index) {
	if (w.applied || !NEW[kind] || index < 0 || index >= w.draft[kind].length) return false
	w.draft[kind].splice(index, 1)
	if (kind === 'heaters' && !w.draft.heaters.length) w.draft.ackAutotune = false
	return true
}

export function setPreview(w, data) {
	w.preview = { key: specKey(w.draft), data }
	return w
}

export function markApplied(w, result) {
	w.applied = { restartNeeded: !!(result && result.restartNeeded), snapshot: (result && result.snapshot) || null }
	w.step = 'tests'
	return w
}
