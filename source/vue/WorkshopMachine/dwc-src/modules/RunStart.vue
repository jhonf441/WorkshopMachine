<template>
	<div class="run-start">
		<!-- DESIGN.md level 3: a motion procedure asks for an explicit tick of the checklist, then the button -->
		<div v-if="allowed" class="mb-2">
			<div class="text-body-medium font-weight-medium mb-1">{{ t('run.checklist_title') }}</div>
			<v-checkbox v-for="item in checks" :key="item" v-model="ticked[item]" density="compact" hide-details class="mt-0 pt-0" :disabled="busy" :label="t('run.check_' + item)" />
		</div>
		<div class="d-flex align-center flex-wrap" style="gap:8px">
			<v-btn color="primary" :disabled="!ready" :loading="starting" @click="go()">
				<v-icon start>mdi-play</v-icon>{{ starting ? t('run.starting') : label || t('run.start') }}
			</v-btn>
			<span v-if="!allowed" class="text-body-small machine-faint">{{ t('run.needs_technician') }}</span>
			<span v-else-if="disabledText" class="text-body-small text-warning">{{ disabledText }}</span>
		</div>
	</div>
</template>

<script setup>
// "Start" with its pre-check list (design 5.1): the person ticks every item and then presses the button. The service still asks its own
// confirmation (level 3, confirm_required) and refuses with the reason when something is not met; this list is the human part.

import { computed, reactive } from 'vue'
import { t } from '../text.js'
import { DEFAULT_CHECKS } from '../lib/run-checks.js'

const props = defineProps({
	allowed: { type: Boolean, default: false }, // the role may start (technician)
	busy: { type: Boolean, default: false }, // something is running already
	starting: { type: Boolean, default: false },
	disabledText: { type: String, default: '' }, // why it cannot start now (inputs wrong, other run...)
	label: { type: String, default: '' },
	checks: { type: Array, default: () => DEFAULT_CHECKS }
})
const emit = defineEmits(['start'])

const ticked = reactive({})
props.checks.forEach(c => { ticked[c] = false })

const allTicked = computed(() => props.checks.every(c => ticked[c]))
const ready = computed(() => props.allowed && !props.busy && !props.disabledText && allTicked.value)

function go() {
	if (!ready.value) return
	emit('start')
	props.checks.forEach(c => { ticked[c] = false }) // the next run asks again
}
</script>

