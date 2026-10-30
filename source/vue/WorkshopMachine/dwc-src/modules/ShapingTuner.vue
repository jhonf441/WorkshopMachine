<template>
	<div class="shaping-tuner">
		<!-- without an accelerometer there is nothing to collect: say so plainly and point to the manual way -->
		<v-alert v-if="!accelerometer.present" density="compact" variant="outlined" type="info" class="mb-0">{{ t('shaping.tuner_none') }}</v-alert>
		<template v-else>
			<p class="text-body-medium machine-faint">{{ t('shaping.tuner_intro', { count: accelerometer.count }) }}</p>
			<v-alert v-if="accelerometer.source !== 'discovered'" density="compact" variant="outlined" type="warning">{{ t('shaping.tuner_declared') }}</v-alert>
			<div class="d-flex flex-wrap align-center" style="gap:12px">
				<v-select v-model="axis" :items="['X', 'Y']" :label="t('calibration.axis')" density="compact" variant="outlined" hide-details style="max-width:120px" />
				<v-select v-if="accelerometer.count > 1" v-model="index" :items="indexes" item-title="text" :label="t('shaping.tuner_index')" density="compact" variant="outlined" hide-details style="max-width:160px" />
			</div>
			<run-start v-if="canRun" class="mt-3" :allowed="canRun" :busy="!startAllowed" :starting="rs.status === 'starting'" :label="t('shaping.tuner_start')" @start="start(kind, params())" />
			<div v-else class="text-body-small machine-faint mt-2">{{ t('run.needs_technician') }}</div>
			<run-progress class="mt-3" :run="rs.run" :error-text="runErrorText" :foreign-text="foreignText" :now="now" @stop="stop()" />
			<v-card v-if="tuning" variant="outlined" class="mt-3">
				<v-card-text>
					<div class="text-body-medium">{{ t('shaping.tuner_result', { axis: tuning.axis, samples: tuning.samples === null ? '-' : tuning.samples, moves: tuning.moves === null ? '-' : tuning.moves }) }}</div>
					<div class="text-body-medium mt-1">{{ t('shaping.tuner_folder', { folder: tuning.folder || '-' }) }}</div>
					<div class="text-body-small machine-faint mt-1">{{ t('shaping.tuner_next') }}</div>
					<pre v-if="tuning.report" class="tuner-report">{{ tuning.report }}</pre>
				</v-card-text>
			</v-card>
		</template>
	</div>
</template>

<script setup>
// Accelerometer data collection for the input shaper (M955 + M956 on the service): shown only when the board reports an accelerometer;
// otherwise a plain explanation. The service COLLECTS the samples into a file; it does not analyse them, so the person reads the
// frequency from the data and types it in the form of the shaping module (nothing is written by this section).

import { computed, ref } from 'vue'
import RunStart from './RunStart.vue'
import RunProgress from './RunProgress.vue'
import { t } from '../text.js'
import { useRunModule } from './use-run-module.js'
import { RUN_KINDS3, normalizeTuning } from '../api/machine-api-p3.js'

const props = defineProps({
	api: { type: Object, required: true },
	published: { type: Object, default: null },
	accelerometer: { type: Object, required: true }, // {present, source, count} of machine.shaping.get
	canRun: { type: Boolean, default: false }, // technician
	now: { type: Number, default: 0 }
})

const { rs, startAllowed, runErrorText, foreignKind, start, stop } = useRunModule(props, [RUN_KINDS3.shapingTune], {})

const axis = ref('X')
const index = ref(0)

const kind = RUN_KINDS3.shapingTune
const indexes = computed(() => Array.from({ length: props.accelerometer.count }, (_, i) => ({ value: i, text: '#' + i })))
const tuning = computed(() => (rs.result ? normalizeTuning(rs.result) : null))
const foreignText = computed(() => (rs.foreign ? t('run.another_running', { kind: foreignKind.value }) : ''))

function params() {
	return { axis: axis.value, accelerometer: index.value }
}
</script>

<style>
.shaping-tuner .tuner-report { font-family: monospace; font-size: 12px; white-space: pre-wrap; margin-top: 6px; }
</style>
