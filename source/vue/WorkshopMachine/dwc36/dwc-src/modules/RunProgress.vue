<template>
	<div class="run-progress">
		<v-alert v-if="foreignText" dense outlined type="info" class="mb-2">{{ foreignText }}</v-alert>
		<v-alert v-if="errorText" dense outlined type="error" class="mb-2">{{ errorText }}</v-alert>
		<div v-if="run" class="d-flex align-center flex-wrap" style="gap:8px">
			<v-chip small :color="stateColor" :outlined="active" :dark="!active">
				<v-icon x-small left>{{ stateIcon }}</v-icon>{{ t('run.state_' + run.state) }}
			</v-chip>
			<span v-if="run.total" class="text-body-2">{{ t('run.step', { step: run.step, total: run.total }) }}</span>
			<span v-if="run.phase" class="text-caption machine-faint">{{ t('run.phase', { phase: phaseText }) }}</span>
			<span v-if="run.user" class="text-caption machine-faint">{{ t('run.by_user', { user: run.user }) }}</span>
			<span v-if="seconds !== null" class="text-caption machine-faint">{{ t('run.elapsed', { s: seconds }) }}</span>
			<v-spacer />
			<!-- STOP is for every role and never blocked (machine.stop): it is shown while the run lasts -->
			<v-btn v-if="active" small color="error" :disabled="stopping" @click="$emit('stop')">
				<v-icon small left>mdi-stop</v-icon>{{ t('run.stop') }}
			</v-btn>
		</div>
		<v-progress-linear v-if="active" class="mt-2" height="6" rounded :indeterminate="fraction === null" :value="(fraction || 0) * 100" color="primary" />
		<div v-if="stopping" class="text-caption machine-faint mt-1">{{ t('run.stopping_hint') }}</div>
	</div>
</template>

<script>
'use strict'

// Progress of the run a module follows: state, step of total, phase, who started it, elapsed time, the STOP button and the reason a run
// ended badly. Only shows what the service published (machine.runs): the page keeps no sequence of its own.

import { textMixin } from './text-mixin.js'
import { isActive, progressFraction, elapsedSeconds, phaseKey } from '../lib/runs.js'

const COLORS = { queued: 'primary', running: 'primary', stopping: 'warning', done: 'success', error: 'error', aborted: 'warning' }
const ICONS = { queued: 'mdi-timer-sand', running: 'mdi-play-circle-outline', stopping: 'mdi-stop-circle-outline', done: 'mdi-check-circle', error: 'mdi-alert-octagon', aborted: 'mdi-alert' }

export default {
	mixins: [textMixin],
	props: {
		run: { type: Object, default: null }, // normalized run (api/machine-api.js)
		errorText: { type: String, default: '' },
		foreignText: { type: String, default: '' },
		now: { type: Number, default: 0 } // seconds, so the elapsed time moves
	},
	computed: {
		active() {
			return isActive(this.run)
		},
		stopping() {
			return !!this.run && this.run.state === 'stopping'
		},
		fraction() {
			return progressFraction(this.run)
		},
		seconds() {
			return elapsedSeconds(this.run, this.now)
		},
		phaseText() {
			const key = phaseKey(this.run && this.run.phase)
			return key ? this.t(key) : (this.run && this.run.phase) || ''
		},
		stateColor() {
			return COLORS[this.run && this.run.state] || 'grey'
		},
		stateIcon() {
			return ICONS[this.run && this.run.state] || 'mdi-help-circle-outline'
		}
	}
}
</script>
