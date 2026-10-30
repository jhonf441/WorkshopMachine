<template>
	<div class="ringing-test">
		<p class="text-body-2 machine-faint">{{ t('shaping.ringing_intro') }}</p>
		<div class="d-flex flex-wrap align-center" style="gap:12px">
			<v-select v-model="form.axes" :items="choices" :label="t('calibration.axis')" dense outlined hide-details style="max-width:110px" />
			<v-text-field v-model="form.size" :label="t('shaping.ringing_size')" dense outlined hide-details suffix="mm" style="max-width:140px" />
			<v-text-field v-model="form.feed" :label="t('shaping.ringing_feed')" dense outlined hide-details suffix="mm/min" style="max-width:160px" />
			<v-text-field v-model="form.accels" :label="t('shaping.ringing_accels')" dense outlined hide-details suffix="mm/s2" style="max-width:240px" />
			<v-text-field v-model="form.repeats" :label="t('shaping.ringing_repeats')" dense outlined hide-details style="max-width:110px" />
		</div>
		<div v-if="canGenerate" class="mt-3">
			<v-btn small color="primary" :loading="loading" @click="generate()">{{ t('shaping.ringing_generate') }}</v-btn>
		</div>
		<div v-else class="text-caption machine-faint mt-3">{{ t('shaping.ringing_needs_technician') }}</div>
		<error-notice :error="error" />
		<gcode-block v-if="test" class="mt-3" :title="t('shaping.ringing_gcode')" :text="test.gcode" />
		<div class="text-body-2 font-weight-medium mt-4">{{ t('shaping.ringing_measure') }}</div>
		<div class="d-flex flex-wrap align-center mt-2" style="gap:12px">
			<v-text-field v-model="ripples" :label="t('shaping.ringing_ripples')" dense outlined hide-details style="max-width:130px" />
			<v-text-field v-model="distance" :label="t('shaping.ringing_distance')" dense outlined hide-details suffix="mm" style="max-width:150px" />
			<span v-if="freq.errorKey" class="text-body-2 warning--text">{{ t(freq.errorKey) }}</span>
			<span v-else class="text-body-2">{{ freq.ok ? t('shaping.ringing_freq', { hz: freq.frequency, wavelength: freq.wavelength }) : t('shaping.ringing_no_freq') }}</span>
			<v-btn small outlined :disabled="!freq.ok" @click="$emit('use', freq.frequency)">{{ t('shaping.ringing_use') }}</v-btn>
		</div>
		<v-alert v-if="freq.warnKey" dense outlined type="warning" class="mt-2 mb-0">{{ t(freq.warnKey) }}</v-alert>
	</div>
</template>

<script>
'use strict'

// The ringing test of the input shaping module: the G-code comes from the service (machine.shaping.test, TEXT ONLY: shown and copied, never
// sent to the board), and the frequency is computed from the ripples the person counts on the part. Pure logic in lib/ringing.js.

import ErrorNotice from '../ErrorNotice.vue' // vue/_shared
import GcodeBlock from './GcodeBlock.vue'
import { textMixin } from './text-mixin.js'
import { AXES_CHOICES, ringingFrequency, testOptions } from '../lib/ringing.js'

export default {
	components: { ErrorNotice, GcodeBlock },
	mixins: [textMixin],
	props: {
		api: { type: Object, required: true },
		canGenerate: { type: Boolean, default: false } // technician: machine.shaping.test
	},
	data() {
		return { choices: AXES_CHOICES, form: { axes: 'XY', size: '50', feed: '6000', accels: '500, 1000, 2000', repeats: '2' }, test: null, loading: false, error: null, ripples: '', distance: '' }
	},
	computed: {
		freq() {
			return ringingFrequency(this.form.feed, this.ripples, this.distance)
		}
	},
	methods: {
		async generate() {
			this.loading = true
			try {
				this.test = await this.api.motion.test(testOptions(this.form))
				this.error = null
			} catch (e) {
				this.error = e
			} finally {
				this.loading = false
			}
		}
	}
}
</script>
