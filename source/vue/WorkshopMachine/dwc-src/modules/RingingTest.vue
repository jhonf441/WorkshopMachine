<template>
	<div class="ringing-test">
		<p class="text-body-medium machine-faint">{{ t('shaping.ringing_intro') }}</p>
		<div class="d-flex flex-wrap align-center" style="gap:12px">
			<v-select v-model="form.axes" :items="choices" :label="t('calibration.axis')" density="compact" variant="outlined" hide-details style="max-width:110px" />
			<v-text-field v-model="form.size" :label="t('shaping.ringing_size')" density="compact" variant="outlined" hide-details suffix="mm" style="max-width:140px" />
			<v-text-field v-model="form.feed" :label="t('shaping.ringing_feed')" density="compact" variant="outlined" hide-details suffix="mm/min" style="max-width:160px" />
			<v-text-field v-model="form.accels" :label="t('shaping.ringing_accels')" density="compact" variant="outlined" hide-details suffix="mm/s2" style="max-width:240px" />
			<v-text-field v-model="form.repeats" :label="t('shaping.ringing_repeats')" density="compact" variant="outlined" hide-details style="max-width:110px" />
		</div>
		<div v-if="canGenerate" class="mt-3">
			<v-btn size="small" color="primary" :loading="loading" @click="generate()">{{ t('shaping.ringing_generate') }}</v-btn>
		</div>
		<div v-else class="text-body-small machine-faint mt-3">{{ t('shaping.ringing_needs_technician') }}</div>
		<error-notice :error="error" />
		<gcode-block v-if="test" class="mt-3" :title="t('shaping.ringing_gcode')" :text="test.gcode" />
		<div class="text-body-medium font-weight-medium mt-4">{{ t('shaping.ringing_measure') }}</div>
		<div class="d-flex flex-wrap align-center mt-2" style="gap:12px">
			<v-text-field v-model="ripples" :label="t('shaping.ringing_ripples')" density="compact" variant="outlined" hide-details style="max-width:130px" />
			<v-text-field v-model="distance" :label="t('shaping.ringing_distance')" density="compact" variant="outlined" hide-details suffix="mm" style="max-width:150px" />
			<span v-if="freq.errorKey" class="text-body-medium text-warning">{{ t(freq.errorKey) }}</span>
			<span v-else class="text-body-medium">{{ freq.ok ? t('shaping.ringing_freq', { hz: freq.frequency, wavelength: freq.wavelength }) : t('shaping.ringing_no_freq') }}</span>
			<v-btn size="small" variant="outlined" :disabled="!freq.ok" @click="$emit('use', freq.frequency)">{{ t('shaping.ringing_use') }}</v-btn>
		</div>
		<v-alert v-if="freq.warnKey" density="compact" variant="outlined" type="warning" class="mt-2 mb-0">{{ t(freq.warnKey) }}</v-alert>
	</div>
</template>

<script setup>
// The ringing test of the input shaping module: the G-code comes from the service (machine.shaping.test, TEXT ONLY: shown and copied, never
// sent to the board), and the frequency is computed from the ripples the person counts on the part. Pure logic in lib/ringing.js.

import { computed, reactive, ref } from 'vue'
import ErrorNotice from '../ErrorNotice.vue' // vue/_shared
import GcodeBlock from './GcodeBlock.vue'
import { t } from '../text.js'
import { AXES_CHOICES, ringingFrequency, testOptions } from '../lib/ringing.js'

const props = defineProps({
	api: { type: Object, required: true },
	canGenerate: { type: Boolean, default: false } // technician: machine.shaping.test
})
const emit = defineEmits(['use'])

const choices = AXES_CHOICES
const form = reactive({ axes: 'XY', size: '50', feed: '6000', accels: '500, 1000, 2000', repeats: '2' })
const test = ref(null)
const loading = ref(false)
const error = ref(null)
const ripples = ref('')
const distance = ref('')

const freq = computed(() => ringingFrequency(form.feed, ripples.value, distance.value))

async function generate() {
	loading.value = true
	try {
		test.value = await props.api.motion.test(testOptions(form))
		error.value = null
	} catch (e) {
		error.value = e
	} finally {
		loading.value = false
	}
}
</script>
