<template>
	<div class="laser-pointer">
		<p class="text-body-2 machine-faint">{{ t('offsets.pointer_intro', { laser: pair.laserTool, pointer: pair.pointerTool }) }}</p>
		<div class="text-body-2 font-weight-medium">{{ t('offsets.pointer_step_1') }}</div>
		<div class="d-flex align-start flex-wrap mt-1" style="gap:8px">
			<v-text-field v-model="pointer.inputs.power" :label="t('offsets.pointer_power')" dense outlined hide-details="auto" style="max-width:150px" :error-messages="powerErrors" :disabled="!canRun || busy" />
			<v-btn small color="primary" :disabled="!canRun || busy || power === null" :loading="busy" @click="$emit('mark', power)">
				<v-icon small left>mdi-crosshairs-gps</v-icon>{{ t('offsets.pointer_mark') }}
			</v-btn>
		</div>
		<div class="text-caption machine-faint mt-1">{{ t('offsets.pointer_guard', { max: max }) }}</div>
		<template v-if="pointer.mark">
			<div class="text-body-2 mt-2">{{ t('offsets.pointer_marked', { x: fmt(pointer.mark.head.x), y: fmt(pointer.mark.head.y) }) }}</div>
			<div class="text-body-2 font-weight-medium mt-4">{{ t('offsets.pointer_step_2') }}</div>
			<div class="d-flex align-center flex-wrap mt-1" style="gap:8px">
				<v-btn small outlined :disabled="!canRun || busy" @click="$emit('capture', false)">{{ t('offsets.pointer_capture') }}</v-btn>
				<v-btn small color="primary" :disabled="!canRun || busy" @click="$emit('capture', true)">{{ t('offsets.pointer_capture_save') }}</v-btn>
				<v-btn small text :disabled="!canRun || busy" @click="$emit('clear')">{{ t('offsets.pointer_clear') }}</v-btn>
			</div>
		</template>
		<v-alert v-if="pointer.captured" dense outlined type="success" class="mt-3">
			<div>{{ t('offsets.pointer_result', { text: correction }) }}</div>
			<div class="text-caption">{{ pointer.captured.saved ? t('offsets.pointer_saved') : t('offsets.pointer_not_saved') }}</div>
			<div v-if="pointer.captured.previous" class="text-caption">{{ t('offsets.pointer_previous', { text: previous }) }}</div>
		</v-alert>
		<div class="text-caption machine-faint mt-2">{{ t('offsets.pointer_sign') }}</div>
		<div v-if="!canRun" class="text-caption machine-faint mt-2">{{ t('run.needs_technician') }}</div>
	</div>
</template>

<script>
'use strict'

// Laser <-> pointer assistant (design 2.7), shown by the module only when the machine declares a laser tool and a pointer tool. Step 1:
// the service marks a cross with the laser (machine.mark_cross, capped by its laser guard). Step 2: the person brings the pointer to the
// centre of the cross with the Jog and asks for the capture; the service answers the correction (and stores it when asked).

import { textMixin } from './text-mixin.js'
import { parsePower, correctionText, MAX_POWER } from '../lib/laser-pointer.js'

export default {
	mixins: [textMixin],
	props: {
		pointer: { type: Object, required: true }, // state.pointer, edited in place
		pair: { type: Object, required: true }, // pairOf(...)
		canRun: { type: Boolean, default: false },
		busy: { type: Boolean, default: false }
	},
	computed: {
		max() {
			return MAX_POWER
		},
		power() {
			return parsePower(this.pointer.inputs.power)
		},
		powerErrors() {
			return this.power === null ? [this.t('offsets.err_power', { max: MAX_POWER })] : []
		},
		correction() {
			return correctionText(this.pointer.captured && this.pointer.captured.correction)
		},
		previous() {
			const p = this.pointer.captured && this.pointer.captured.previous
			return p ? correctionText(p) + (p.date ? ' (' + p.date + ')' : '') : ''
		}
	},
	methods: {
		fmt(v) {
			return typeof v === 'number' ? v.toFixed(2) : '-'
		}
	}
}
</script>
