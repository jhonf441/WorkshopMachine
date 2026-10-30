'use strict'

// Reading a procedure run of the service (machine.runs): which run a module follows, how far it is, why it ended. Pure.
// Run states (machine_ops.py): queued -> running -> stopping -> done | error | aborted.

const ACTIVE = ['queued', 'running', 'stopping']

// codes of error.code that have their own text (run.error_<code>); anything else uses run.error_failed
export const ERROR_CODES = ['stop', 'machine_halted', 'reservation_lost', 'reserved', 'forbidden_code', 'bad_reply', 'vision_unavailable', 'vision_not_found', 'vision_bad_answer', 'failed']
// refusals of machine.run (error.reason or error code); anything else uses run.refuse_other
export const REFUSAL_CODES = ['no_probe', 'not_homed', 'unsupported_kinematics', 'heater_fault', 'no_model', 'busy_run', 'motion_denied', 'not_implemented', 'forbidden', 'unavailable', 'no_vision_measure', 'tool_not_current', 'bad_target', 'out_of_reach']

// phases a procedure reports (machine_*.py ctx.progress); each has its own text run.phase_<phase>, an unknown one is shown as it is
export const PHASES = ['prepare', 'parameters', 'checking', 'homing', 'g32', 'move', 'mark', 'measure', 'measuring', 'probing', 'sampling', 'collect', 'verifying', 'grid', 'reading', 'done']

export function phaseKey(phase) {
	return PHASES.indexOf(phase) >= 0 ? 'run.phase_' + phase : null
}

export function isActive(run) {
	return !!run && ACTIVE.indexOf(run.state) >= 0
}

// 0..1, null while the total is not known (the bar is then indeterminate)
export function progressFraction(run) {
	if (!run || !(run.total > 0)) return null
	return Math.max(0, Math.min(1, run.step / run.total))
}

export function errorKey(run) {
	if (!run || !run.errorCode) return null
	return 'run.error_' + (ERROR_CODES.indexOf(run.errorCode) >= 0 ? run.errorCode : 'failed')
}

export function refusalKey(reason) {
	return 'run.refuse_' + (REFUSAL_CODES.indexOf(reason) >= 0 ? reason : 'other')
}

export function elapsedSeconds(run, nowSeconds) {
	if (!run || !run.started) return null
	return Math.max(0, Math.round((run.finished || nowSeconds) - run.started))
}

// `view` = normalizeRuns(...) ({runs newest first, active}); `kinds` = the kinds of procedure a module owns.
// The module follows the active run of its kinds; with none active it shows the newest finished one of its kinds.
export function pickRun(view, kinds) {
	const runs = (view && view.runs) || []
	const mine = runs.filter(r => kinds.indexOf(r.kind) >= 0)
	const active = mine.find(isActive)
	if (active) return { run: active, attached: true }
	return { run: mine[0] || null, attached: false }
}

// the active run that belongs to ANOTHER module: this one must not start while it lasts, and says what is running
export function foreignRun(view, kinds) {
	const active = view && view.active
	return active && kinds.indexOf(active.kind) < 0 ? active : null
}

// 'idle' | 'active' | 'stopping' | 'done' | 'error' | 'aborted'
export function statusOf(run) {
	if (!run) return 'idle'
	if (run.state === 'stopping') return 'stopping'
	return isActive(run) ? 'active' : run.state
}
