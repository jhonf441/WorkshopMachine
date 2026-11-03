'use strict'

// Power-loss module logic: what the machine does when the supply drops (the M911 line of the configuration) and what RepRapFirmware left behind.
// The values come from machine.power.get (api normalizePower); the edit of the two voltages persists as kind config.m911 (admin class: the
// server enforces it). The commands (P) are shown, never edited. Pure.

export const KIND_POWER = 'config.m911'
export const POWER_RANGE = { sMin: 10, sMax: 28, rMin: 10, rMax: 30 } // volts (the service checks the same)

function numOf(text) {
	if (typeof text === 'number') return isFinite(text) ? text : null
	const s = String(text === undefined || text === null ? '' : text).trim().replace(',', '.')
	return s !== '' && /^[-+]?(\d+\.?\d*|\.\d+)$/.test(s) ? Number(s) : null
}

export function powerDraft(m911) {
	return { s: m911 && typeof m911.s === 'number' ? String(m911.s) : '', r: m911 && typeof m911.r === 'number' ? String(m911.r) : '' }
}

// the draft against the line: {values: {s?, r?} of what changed, errorKey: null | 'power.err_number' | 'power.err_order'}
export function powerChange(m911, draft) {
	const s = numOf(draft && draft.s)
	const r = numOf(draft && draft.r)
	if (!m911 || typeof m911.s !== 'number' || typeof m911.r !== 'number') return { values: {}, errorKey: null }
	if (s === null || r === null || s < POWER_RANGE.sMin || s > POWER_RANGE.sMax || r < POWER_RANGE.rMin || r > POWER_RANGE.rMax) return { values: {}, errorKey: 'power.err_number' }
	if (r <= s) return { values: {}, errorKey: 'power.err_order' }
	const values = {}
	if (s !== m911.s) values.s = s
	if (r !== m911.r) values.r = r
	return { values, errorKey: null }
}

const FACT_LOOK = { ok: { icon: 'mdi-check-circle-outline', color: 'success' }, warn: { icon: 'mdi-alert-outline', color: 'warning' }, info: { icon: 'mdi-information-outline', color: 'info' } }

export const KIND_PROLOGUE = 'config.prologue' // creates resurrect-prologue.g with the standard text when the machine has none (admin; never overwrites)

// the lines of a file as the viewer draws them: comments dimmed, code normal. [{ n, text, kind: 'blank' | 'comment' | 'code' }]
export function fileLines(text) {
	const lines = String(text === undefined || text === null ? '' : text).split('\n').map(t => (t.charCodeAt(t.length - 1) === 13 ? t.slice(0, -1) : t))
	if (lines.length && lines[lines.length - 1] === '') lines.pop()
	return lines.map((t, i) => ({ n: i + 1, text: t, kind: t.trim() === '' ? 'blank' : t.trim().charAt(0) === ';' ? 'comment' : 'code' }))
}

// what the prologue does, one fact per row: [{ key: i18n suffix of power.fact_<key>, level: 'ok' | 'warn' | 'info', icon, color }]. Laser or CNC that does not ask
// before resuming, or does not switch the tool off, is a warning: the tool may be where it was, about to switch on again.
export function prologueFacts(summary) {
	if (!summary) return []
	const out = []
	const manual = summary.laser || summary.cnc
	if (summary.laser) out.push({ key: summary.asks ? 'laser_asks' : 'laser_no_ask', level: summary.asks ? 'ok' : 'warn' })
	if (summary.cnc) out.push({ key: summary.asks ? 'cnc_asks' : 'cnc_no_ask', level: summary.asks ? 'ok' : 'warn' })
	if (manual && summary.stopsTool) out.push({ key: 'stops_tool', level: 'ok' })
	if (manual && !summary.stopsTool) out.push({ key: 'no_stop', level: 'warn' })
	if (summary.laser && summary.airOff) out.push({ key: 'air_off', level: 'ok' })
	if (manual && summary.cancels) out.push({ key: 'cancels', level: 'ok' })
	if (summary.otherModes) out.push({ key: 'other_modes', level: 'info' })
	if (!manual && !summary.otherModes) out.push({ key: 'nothing', level: 'warn' })
	return out.map(f => Object.assign({}, f, FACT_LOOK[f.level]))
}

// Resume after a cut: the three acknowledgements of laser / CNC (the service asks for the same three) and the rows of the check list.
export const ACK_KEYS = ['piece', 'tool', 'area']
export function ackDone(ack, needsAck) {
	return !needsAck || ACK_KEYS.every(k => !!(ack && ack[k] === true))
}

const RESUME_LOOK = { ok: { icon: 'mdi-check-circle-outline', color: 'success' }, block: { icon: 'mdi-close-circle-outline', color: 'error' }, info: { icon: 'mdi-alert-outline', color: 'warning' } }

// [{ id, ok, block, icon, color }] in the order the service sends; a failed row that only informs (block false) is a warning, not an error
export function resumeRows(resume) {
	const rows = (resume && resume.checks) || []
	return rows.map(c => Object.assign({}, c, RESUME_LOOK[c.ok ? 'ok' : c.block ? 'block' : 'info']))
}

// why the button is off ('' = it can go): the first failed blocking check, then the acknowledgements
export function resumeBlock(resume, ack) {
	if (!resume || !resume.checks || !resume.checks.length) return 'power.resume_blocked'
	if (resume.checks.some(c => c.block && !c.ok)) return 'power.resume_blocked'
	if (!ackDone(ack, resume.needsAck)) return 'power.resume_need_ack'
	return ''
}

// the state line of the page: {level: 'ok' | 'warn' | 'info', textKey}
export function powerState(view) {
	if (!view || !view.configRead) return { level: 'info', textKey: 'power.state_unread' }
	if (!view.m911) return { level: 'warn', textKey: 'power.state_no_line' }
	if (view.resurrect && view.resurrect.exists) return { level: 'warn', textKey: 'power.state_interrupted' }
	return { level: 'ok', textKey: 'power.state_ok' }
}
