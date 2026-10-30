<template>
	<div class="run-progress">
		<v-alert v-if="foreignText" density="compact" variant="outlined" type="info" class="mb-2">{{ foreignText }}</v-alert>
		<v-alert v-if="errorText" density="compact" variant="outlined" type="error" class="mb-2">{{ errorText }}</v-alert>
		<div v-if="run" class="d-flex align-center flex-wrap" style="gap:8px">
			<v-chip size="small" :color="stateColor" :variant="active ? 'outlined' : 'flat'">
				<v-icon size="x-small" start>{{ stateIcon }}</v-icon>{{ t('run.state_' + run.state) }}
			</v-chip>
			<span v-if="run.total" class="text-body-medium">{{ t('run.step', { step: run.step, total: run.total }) }}</span>
			<span v-if="run.phase" class="text-body-small machine-faint">{{ t('run.phase', { phase: phaseText }) }}</span>
			<span v-if="run.user" class="text-body-small machine-faint">{{ t('run.by_user', { user: run.user }) }}</span>
			<span v-if="seconds !== null" class="text-body-small machine-faint">{{ t('run.elapsed', { s: seconds }) }}</span>
			<v-spacer />
			<!-- STOP is for every role and never blocked (machine.stop): it is shown while the run lasts -->
			<v-btn v-if="active" size="small" color="error" :disabled="stopping" @click="$emit('stop')">
				<v-icon size="small" start>mdi-stop</v-icon>{{ t('run.stop') }}
			</v-btn>
		</div>
		<v-progress-linear v-if="active" class="mt-2" height="6" rounded :indeterminate="fraction === null" :model-value="(fraction || 0) * 100" color="primary" />
		<div v-if="stopping" class="text-body-small machine-faint mt-1">{{ t('run.stopping_hint') }}</div>
	</div>
</template>

<script setup>
// Progress of the run a module follows: state, step of total, phase, who started it, elapsed time, the STOP button and the reason a run
// ended badly. Only shows what the service published (machine.runs): the page keeps no sequence of its own.

import { computed } from 'vue'
import { t } from '../text.js'
import { isActive, progressFraction, elapsedSeconds, phaseKey } from '../lib/runs.js'

const COLORS = { queued: 'primary', running: 'primary', stopping: 'warning', done: 'success', error: 'error', aborted: 'warning' }
const ICONS = { queued: 'mdi-timer-sand', running: 'mdi-play-circle-outline', stopping: 'mdi-stop-circle-outline', done: 'mdi-check-circle', error: 'mdi-alert-octagon', aborted: 'mdi-alert' }

const props = defineProps({
	run: { type: Object, default: null }, // normalized run (api/machine-api.js)
	errorText: { type: String, default: '' },
	foreignText: { type: String, default: '' },
	now: { type: Number, default: 0 } // seconds, so the elapsed time moves
})
defineEmits(['stop'])

const active = computed(() => isActive(props.run))
const stopping = computed(() => !!props.run && props.run.state === 'stopping')
const fraction = computed(() => progressFraction(props.run))
const seconds = computed(() => elapsedSeconds(props.run, props.now))
const phaseText = computed(() => {
	const key = phaseKey(props.run && props.run.phase)
	return key ? t(key) : (props.run && props.run.phase) || ''
})
const stateColor = computed(() => COLORS[props.run && props.run.state] || 'grey')
const stateIcon = computed(() => ICONS[props.run && props.run.state] || 'mdi-help-circle-outline')
</script>

