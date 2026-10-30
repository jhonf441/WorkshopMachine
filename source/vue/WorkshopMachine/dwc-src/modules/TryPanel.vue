<template>
	<v-card variant="outlined" class="try-panel">
		<v-card-title class="text-title-medium pb-0">{{ t('try.title') }}</v-card-title>
		<v-card-text>
			<p class="text-body-medium machine-faint">{{ t('try.intro') }}</p>
			<template v-if="state.status === 'pending' || state.status === 'finishing'">
				<v-alert density="compact" variant="outlined" type="warning" class="mb-2">
					{{ t('try.running', { kind: state.trial.gcodeKind, seconds: left === null ? '-' : left }) }}
				</v-alert>
				<v-progress-linear :model-value="percent" height="8" rounded :color="left !== null && left <= 10 ? 'error' : 'warning'" class="mb-2" />
				<div class="text-body-medium mb-1">{{ t('try.values', { applied: pairs(state.trial.applied), previous: pairs(state.trial.previous) }) }}</div>
				<div v-if="state.trial.user" class="text-body-small machine-faint mb-2">{{ t('try.by', { user: state.trial.user }) }}</div>
				<div class="d-flex flex-wrap" style="gap:8px">
					<v-btn color="primary" :disabled="!keepAllowed || state.status === 'finishing'" :loading="state.status === 'finishing'" @click="$emit('keep')">
						<v-icon start>mdi-check</v-icon>{{ t('try.keep') }}
					</v-btn>
					<v-btn color="error" variant="outlined" :disabled="!keepAllowed || state.status === 'finishing'" @click="$emit('revert')">
						<v-icon start>mdi-undo</v-icon>{{ t('try.revert') }}
					</v-btn>
				</div>
				<div class="text-body-small machine-faint mt-2">{{ t('try.keep_hint') }}</div>
			</template>
			<template v-else>
				<div v-if="line" class="text-body-medium mb-2"><span class="try-line">{{ line }}</span></div>
				<div class="d-flex align-center flex-wrap" style="gap:8px">
					<v-text-field :model-value="seconds" :label="t('try.seconds')" density="compact" variant="outlined" hide-details type="number" :min="range.min" :max="range.max" style="max-width:130px" @update:model-value="emit('update:seconds', Number($event))" />
					<v-btn color="primary" :disabled="!startAllowed" :loading="state.status === 'starting'" @click="$emit('start')">
						<v-icon start>mdi-timer-sand</v-icon>{{ t('try.start') }}
					</v-btn>
					<span v-if="!roleOk" class="text-body-small text-warning">{{ t('try.needs_role') }}</span>
				</div>
			</template>
			<v-alert v-if="state.status === 'done' && state.outcome" density="compact" variant="outlined" :type="state.outcome === 'kept' ? 'success' : 'info'" class="mt-2 mb-0">
				{{ t('try.done_' + state.outcome) }}
				<div v-if="state.persist && canPersist" class="mt-2">
					<v-btn size="small" color="primary" @click="$emit('persist')"><v-icon size="small" start>mdi-content-save-outline</v-icon>{{ t('try.persist') }}</v-btn>
				</div>
			</v-alert>
			<v-alert v-if="state.error" density="compact" variant="outlined" type="error" class="mt-2 mb-0">
				{{ t(state.error.key) }}<span v-if="state.error.detail"> ({{ state.error.detail }})</span>
			</v-alert>
			<v-btn v-if="state.status === 'done' || state.status === 'error'" size="small" variant="text" class="mt-1" @click="$emit('reset')">{{ t('plan.close') }}</v-btn>
		</v-card-text>
	</v-card>
</template>

<script setup>
// "Try now" with its countdown (machine.try): the value is applied for a limited time and the service puts the previous one back unless the
// person presses keep. The state is state/try-state.js; this component keeps none of its own. The remaining time comes from `now`
// (seconds, ticks every second in the shell) against the expiry the service gave.

import { computed } from 'vue'
import { t } from '../text.js'
import { remainingSeconds, remainingFraction, canKeep, canStart } from '../state/try-state.js'
import { TRY_SECONDS } from '../api/machine-api-p3.js'

const props = defineProps({
	state: { type: Object, required: true }, // createTryState()
	now: { type: Number, default: 0 },
	roleOk: { type: Boolean, default: false }, // workshopCan machine.try for this gcode_kind
	hasValues: { type: Boolean, default: false }, // the draft has something valid to try
	canPersist: { type: Boolean, default: false }, // the person may prepare the plan that makes a kept trial permanent
	line: { type: String, default: '' }, // the line that would be applied, shown before it is sent
	seconds: { type: Number, default: TRY_SECONDS.default }
})
const emit = defineEmits(['keep', 'revert', 'start', 'persist', 'reset', 'update:seconds'])

const range = TRY_SECONDS
const left = computed(() => remainingSeconds(props.state, props.now))
const percent = computed(() => {
	const f = remainingFraction(props.state, props.now)
	return f === null ? 100 : Math.round(f * 100)
})
const keepAllowed = computed(() => canKeep(props.state, props.roleOk))
const startAllowed = computed(() => canStart(props.state, props.roleOk, props.hasValues) && props.seconds >= TRY_SECONDS.min && props.seconds <= TRY_SECONDS.max)

// {X: 800, Y: 800} -> 'X800 Y800'; other shapes are shown as JSON
function pairs(v) {
	const keys = Object.keys(v || {})
	if (!keys.length) return '-'
	return keys.map(k => (v[k] !== null && typeof v[k] === 'object' ? k + JSON.stringify(v[k]) : k + v[k])).join(' ')
}
</script>

<style>
.try-panel .try-line { font-family: monospace; }
</style>
