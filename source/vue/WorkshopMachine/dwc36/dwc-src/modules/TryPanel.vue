<template>
	<div class="wf-group try-panel">
		<div class="wf-group-title d-flex align-center flex-wrap" style="gap: 8px">{{ t('try.title') }}</div>
		<div>
			<p class="text-body-2 machine-faint">{{ t('try.intro') }}</p>
			<template v-if="state.status === 'pending' || state.status === 'finishing'">
				<v-alert dense outlined type="warning" class="mb-2">
					{{ t('try.running', { kind: state.trial.gcodeKind, seconds: left === null ? '-' : left }) }}
				</v-alert>
				<v-progress-linear :value="percent" height="8" rounded :color="left !== null && left <= 10 ? 'error' : 'warning'" class="mb-2" />
				<div class="text-body-2 mb-1">{{ t('try.values', { applied: pairs(state.trial.applied), previous: pairs(state.trial.previous) }) }}</div>
				<div v-if="state.trial.user" class="text-caption machine-faint mb-2">{{ t('try.by', { user: state.trial.user }) }}</div>
				<div class="d-flex flex-wrap" style="gap:8px">
					<wf-action-button :action="finishAct" main :label="t('try.keep')" :disabled="!keepAllowed" @run="$emit('keep')" />
					<wf-action-button :action="finishAct" :label="t('try.revert')" :disabled="!keepAllowed" @run="$emit('revert')" />
				</div>
				<div class="text-caption machine-faint mt-2">{{ t('try.keep_hint') }}</div>
			</template>
			<template v-else>
				<div v-if="line" class="text-body-2 mb-2"><span class="try-line">{{ line }}</span></div>
				<div class="d-flex align-center flex-wrap" style="gap:8px">
					<v-text-field :value="seconds" :label="t('try.seconds')" dense outlined hide-details type="number" :min="range.min" :max="range.max" style="max-width:130px" @input="$emit('update:seconds', Number($event))" />
					<v-btn color="primary" :disabled="!startAllowed" :loading="state.status === 'starting'" @click="$emit('start')">
						<v-icon left>mdi-timer-sand</v-icon>{{ t('try.start') }}
					</v-btn>
					<span v-if="!roleOk" class="text-caption warning--text">{{ t('try.needs_role') }}</span>
				</div>
			</template>
			<v-alert v-if="state.status === 'done' && state.outcome" dense outlined :type="state.outcome === 'kept' ? 'success' : 'info'" class="mt-2 mb-0">
				{{ t('try.done_' + state.outcome) }}
				<div v-if="state.persist && canPersist" class="mt-2">
					<wf-action-button :action="null" main :label="t('try.persist')" @run="$emit('persist')" />
				</div>
			</v-alert>
			<!-- a failure of start, keep or revert: the family line next to the controls (a failed keep leaves the trial waiting and the controls on) -->
			<wf-result v-if="state.error" :action="failAct" :retry="false" class="mt-2" />
			<v-btn v-if="state.status === 'done' || state.status === 'error'" small text class="mt-1" @click="$emit('reset')">{{ t('plan.close') }}</v-btn>
		</div>
	</div>
</template>

<script>
'use strict'

// "Try now" with its countdown (machine.try): the value is applied for a limited time and the service puts the previous one back unless the
// person presses keep. The state is state/try-state.js; this component keeps none of its own. The remaining time comes from `now`
// (seconds, ticks every second in the shell) against the expiry the service gave.

import WfActionButton from '../WfActionButton.vue' // vue/_shared36
import WfResult from '../WfResult.vue' // vue/_shared36
import { textMixin } from './text-mixin.js'
import { remainingSeconds, remainingFraction, canKeep, canStart } from '../state/try-state.js'
import { TRY_SECONDS } from '../api/machine-api-p3.js'

export default {
	components: { WfActionButton, WfResult },
	mixins: [textMixin],
	props: {
		state: { type: Object, required: true }, // createTryState()
		now: { type: Number, default: 0 },
		roleOk: { type: Boolean, default: false }, // workshopCan machine.try for this gcode_kind
		hasValues: { type: Boolean, default: false }, // the draft has something valid to try
		canPersist: { type: Boolean, default: false }, // the person may prepare the plan that makes a kept trial permanent
		line: { type: String, default: '' }, // the line that would be applied, shown before it is sent
		seconds: { type: Number, default: TRY_SECONDS.default }
	},
	computed: {
		range() {
			return TRY_SECONDS
		},
		left() {
			return remainingSeconds(this.state, this.now)
		},
		percent() {
			const f = remainingFraction(this.state, this.now)
			return f === null ? 100 : Math.round(f * 100)
		},
		// the trial state read as the state of a write (WfActionButton / WfResult read `state`, `error`, `text`): finishing = sending
		finishAct() {
			return { state: this.state.status === 'finishing' ? 'sending' : 'idle', error: null, text: '' }
		},
		failAct() {
			const e = this.state.error
			return { state: e ? 'error' : 'idle', error: e ? { code: 'internal', message: this.t(e.key) + (e.detail ? ' (' + e.detail + ')' : '') } : null, text: '' }
		},
		keepAllowed() {
			return canKeep(this.state, this.roleOk)
		},
		startAllowed() {
			return canStart(this.state, this.roleOk, this.hasValues) && this.seconds >= TRY_SECONDS.min && this.seconds <= TRY_SECONDS.max
		}
	},
	methods: {
		// {X: 800, Y: 800} -> 'X800 Y800'; other shapes are shown as JSON
		pairs(v) {
			const keys = Object.keys(v || {})
			if (!keys.length) return '-'
			return keys.map(k => (v[k] !== null && typeof v[k] === 'object' ? k + JSON.stringify(v[k]) : k + v[k])).join(' ')
		}
	}
}
</script>

<style>
.try-panel .try-line { font-family: monospace; }
</style>
