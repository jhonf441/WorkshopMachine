'use strict'

// "New tool" assistant, preview: machine.tool.preview -> {lines, files, warnings, errors}. The page shows the lines EXACTLY as the service wrote them and
// only classifies them (comment, safety line, line that touches a heater). It also refuses a preview that would switch something on. Pure.

function list(v) {
	return Array.isArray(v) ? v : []
}

function obj(v) {
	return v && typeof v === 'object' ? v : {}
}

// the lines the page watches: M143 is the maximum temperature of a heater, M950 H / M308 / M307 build it
const SAFETY = /^\s*M143\b/i
// the page never writes the output command itself (design 5.4): it only recognises it in the lines the service sends
const HEATER = /^\s*(M9[5]0\s+H|M308\b|M307\b|M570\b)/i
// a configuration for a new tool never switches anything on (contract section 5)
const ACTIVATES = /^\s*(M3|M4|M104|M109|M140|M141|M190|M191|M303)\b|^\s*M106\s+(P\d+\s+)?S(0?\.\d*[1-9]|[1-9])/i

// the warnings of the service that have a text of the page (toolwiz.warn_<code>); any other shows the service's own text
export const WARNING_CODES = ['check_off_at_start', 'heater_off_until_tuned']

export function lineKind(text) {
	const s = String(text)
	if (/^\s*$/.test(s)) return 'blank'
	if (/^\s*;/.test(s)) return 'comment'
	if (SAFETY.test(s)) return 'safety'
	if (HEATER.test(s)) return 'heater'
	return 'code'
}

export function normalizePreview(raw) {
	const r = obj(raw)
	return {
		lines: list(r.lines).map(String).map((text, i) => ({ n: i + 1, text, kind: lineKind(text) })),
		files: list(r.files).map(f => (f && typeof f === 'object' ? String(f.path || '') : String(f))).filter(Boolean),
		warnings: list(r.warnings).map(w => (w && typeof w === 'object' ? { code: String(w.code || 'other'), text: String(w.text || '') } : { code: String(w), text: '' })),
		errors: list(r.errors).map(e => ({ code: String(obj(e).code || obj(e).reason || 'values'), field: String(obj(e).field || '') }))
	}
}

export function maxTempLines(preview) {
	return preview.lines.filter(l => l.kind === 'safety').length
}

export function activatingLines(preview) {
	return preview.lines.filter(l => ACTIVATES.test(l.text))
}

// the step an error of the service belongs to (so the page sends the person back to fix it)
const STEP_OF = { tool_number: 'name', tool_exists: 'name', name: 'name', laser_mode: 'type', pin_unknown: 'pins', pin_used: 'pins', pin_capability: 'pins', driver_unknown: 'carries', driver_used: 'carries', heater_unknown: 'carries', rpm_range: 'carries', power_range: 'carries', values: 'carries' }

export function stepOfError(code) {
	return STEP_OF[code] || 'carries'
}

// what stops the review: the service's errors plus the page's own: a heater without its M143, or a line that activates something
export function previewIssues(preview, heaterCount) {
	const out = preview.errors.map(e => ({ field: e.field, code: e.code, service: true }))
	if (heaterCount > maxTempLines(preview)) out.push({ field: 'preview', code: 'preview_no_max' })
	if (activatingLines(preview).length) out.push({ field: 'preview', code: 'preview_activates' })
	return out
}
