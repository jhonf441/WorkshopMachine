<template>
	<div class="laser-pointer">
		<p class="text-body-medium machine-faint">{{ t('offsets.pointer_intro', { laser: pair.laserTool, pointer: pair.pointerTool }) }}</p>
		<div class="text-body-medium font-weight-medium">{{ t('offsets.pointer_step_1') }}</div>
		<div class="d-flex align-start flex-wrap mt-1" style="gap:8px">
			<v-text-field v-model="pointer.inputs.power" :label="t('offsets.pointer_power')" density="compact" variant="outlined" hide-details="auto" style="max-width:150px" :error-messages="powerErrors" :disabled="!canRun || busy" />
			<v-btn size="small" color="primary" :disabled="!canRun || busy || power === null" :loading="busy" @click="$emit('mark', power)">
				<v-icon size="small" start>mdi-crosshairs-gps</v-icon>{{ t('offsets.pointer_mark') }}
			</v-btn>
		</div>
		<div class="text-body-small machine-faint mt-1">{{ t('offsets.pointer_guard', { max: max }) }}</div>
		<template v-if="pointer.mark">
			<div class="text-body-medium mt-2">{{ t('offsets.pointer_marked', { x: fmt(pointer.mark.head.x), y: fmt(pointer.mark.head.y) }) }}</div>
			<div class="text-body-medium font-weight-medium mt-4">{{ t('offsets.pointer_step_2') }}</div>
			<div class="d-flex align-center flex-wrap mt-1" style="gap:8px">
				<v-btn size="small" variant="outlined" :disabled="!canRun || busy" @click="$emit('capture', false)">{{ t('offsets.pointer_capture') }}</v-btn>
				<v-btn size="small" color="primary" :disabled="!canRun || busy" @click="$emit('capture', true)">{{ t('offsets.pointer_capture_save') }}</v-btn>
				<v-btn size="small" variant="text" :disabled="!canRun || busy" @click="$emit('clear')">{{ t('offsets.pointer_clear') }}</v-btn>
			</div>
		</template>
		<v-alert v-if="pointer.captured" density="compact" variant="outlined" type="success" class="mt-3">
			<div>{{ t('offsets.pointer_result', { text: correction }) }}</div>
			<div class="text-body-small">{{ pointer.captured.saved ? t('offsets.pointer_saved') : t('offsets.pointer_not_saved') }}</div>
			<div v-if="pointer.captured.previous" class="text-body-small">{{ t('offsets.pointer_previous', { text: previous }) }}</div>
		</v-alert>
		<div class="text-body-small machine-faint mt-2">{{ t('offsets.pointer_sign') }}</div>
		<div v-if="!canRun" class="text-body-small machine-faint mt-2">{{ t('run.needs_technician') }}</div>
	</div>
</template>

<script setup>
// Laser <-> pointer assistant (design 2.7), shown by the module only when the machine declares a laser tool and a pointer tool. Step 1:
// the service marks a cross with the laser (machine.mark_cross, capped by its laser guard). Step 2: the person brings the pointer to the
// centre of the cross with the Jog and asks for the capture; the service answers the correction (and stores it when asked).

import { computed } from 'vue'
import { t } from '../text.js'
import { parsePower, correctionText, MAX_POWER } from '../lib/laser-pointer.js'

const props = defineProps({
	pointer: { type: Object, required: true }, // state.pointer, edited in place
	pair: { type: Object, required: true }, // pairOf(...)
	canRun: { type: Boolean, default: false },
	busy: { type: Boolean, default: false }
})
defineEmits(['mark', 'capture', 'clear'])

const max = MAX_POWER
const power = computed(() => parsePower(props.pointer.inputs.power))
const powerErrors = computed(() => (power.value === null ? [t('offsets.err_power', { max: MAX_POWER })] : []))
const correction = computed(() => correctionText(props.pointer.captured && props.pointer.captured.correction))
const previous = computed(() => {
	const p = props.pointer.captured && props.pointer.captured.previous
	return p ? correctionText(p) + (p.date ? ' (' + p.date + ')' : '') : ''
})

function fmt(v) {
	return typeof v === 'number' ? v.toFixed(2) : '-'
}
</script>
