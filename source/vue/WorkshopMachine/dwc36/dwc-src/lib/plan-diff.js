'use strict'

// How a configuration plan (machine.config.plan, machine.history.restore) is shown: the diff lines classified, counts, and the text of
// the refusals of the plan and apply operations. Pure.

// unified diff line -> 'add' | 'del' | 'hunk' | 'file' | 'ctx' (the view also prints the first character: colour is never the only signal)
export function classifyLine(line) {
	const s = String(line)
	if (s.startsWith('+++') || s.startsWith('---')) return 'file'
	if (s.startsWith('@@')) return 'hunk'
	if (s.startsWith('+')) return 'add'
	if (s.startsWith('-')) return 'del'
	return 'ctx'
}

// {files, changedFiles, added, removed} of a normalized plan
export function planStats(plan) {
	const out = { files: 0, changedFiles: 0, added: 0, removed: 0 }
	if (!plan) return out
	plan.files.forEach(f => {
		out.files++
		if (f.changed) out.changedFiles++
		f.diff.forEach(l => {
			const c = classifyLine(l)
			if (c === 'add') out.added++
			else if (c === 'del') out.removed++
		})
	})
	return out
}

export function hasChanges(plan) {
	return !!plan && plan.files.some(f => f.changed)
}

// refusal reasons of machine.config.plan / apply / history.restore that have their own text (plan.err_<reason>)
export const ERROR_REASONS = [
	'plan_expired', 'kind_mismatch', 'role', 'busy_run', 'nothing_to_apply', 'conflict', 'no_config', 'not_utf8', 'bad_value', 'no_points',
	'too_many_points', 'too_few_points', 'out_of_reach', 'duplicate_point', 'no_limits', 'not_implemented', 'invalid_args', 'forbidden',
	'motion_denied', 'file_changed', 'not_found', 'patch_missing_line', 'patch_unsupported_form', 'patch_expression', 'current_over_limit', 'bad_type',
	'no_frequency', 'out_of_range', 'implausible', 'no_value'
]

export function planErrorKey(reason) {
	return 'plan.err_' + (ERROR_REASONS.indexOf(reason) >= 0 ? reason : 'other')
}
