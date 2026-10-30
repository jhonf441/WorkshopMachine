<template>
	<div class="shaping-tuner">
		<!-- without an accelerometer there is nothing to collect: say so plainly and point to the manual way -->
		<v-alert v-if="!accelerometer.present" dense outlined type="info" class="mb-0">{{ t('shaping.tuner_none') }}</v-alert>
		<template v-else>
			<p class="text-body-2 machine-faint">{{ t('shaping.tuner_intro', { count: accelerometer.count }) }}</p>
			<v-alert v-if="accelerometer.source !== 'discovered'" dense outlined type="warning">{{ t('shaping.tuner_declared') }}</v-alert>
			<div class="d-flex flex-wrap align-center" style="gap:12px">
				<v-select v-model="axis" :items="['X', 'Y']" :label="t('calibration.axis')" dense outlined hide-details style="max-width:120px" />
				<v-select v-if="accelerometer.count > 1" v-model="index" :items="indexes" :label="t('shaping.tuner_index')" dense outlined hide-details style="max-width:160px" />
			</div>
			<run-start v-if="canRun" class="mt-3" :allowed="canRun" :busy="!startAllowed" :starting="rs.status === 'starting'" :label="t('shaping.tuner_start')" @start="start(kind, params())" />
			<div v-else class="text-caption machine-faint mt-2">{{ t('run.needs_technician') }}</div>
			<run-progress class="mt-3" :run="rs.run" :error-text="runErrorText" :foreign-text="foreignText" :now="now" @stop="stop()" />
			<v-card v-if="tuning" outlined class="mt-3">
				<v-card-text>
					<div class="text-body-2">{{ t('shaping.tuner_result', { axis: tuning.axis, samples: tuning.samples === null ? '-' : tuning.samples, moves: tuning.moves === null ? '-' : tuning.moves }) }}</div>
					<div class="text-body-2 mt-1">{{ t('shaping.tuner_folder', { folder: tuning.folder || '-' }) }}</div>
					<div class="text-caption machine-faint mt-1">{{ t('shaping.tuner_next') }}</div>
					<pre v-if="tuning.report" class="tuner-report">{{ tuning.report }}</pre>
				</v-card-text>
			</v-card>
		</template>
	</div>
</template>

<script>
'use strict'

// Accelerometer data collection for the input shaper (M955 + M956 on the service): shown only when the board reports an accelerometer;
// otherwise a plain explanation. The service COLLECTS the samples into a file; it does not analyse them, so the person reads the
// frequency from the data and types it in the form of the shaping module (nothing is written by this section).

import { runModule } from './run-module.js'
import RunStart from './RunStart.vue'
import RunProgress from './RunProgress.vue'
import { RUN_KINDS3, normalizeTuning } from '../api/machine-api-p3.js'

export default {
	components: { RunStart, RunProgress },
	mixins: [runModule([RUN_KINDS3.shapingTune], {})],
	props: {
		api: { type: Object, required: true },
		published: { type: Object, default: null },
		accelerometer: { type: Object, required: true }, // {present, source, count} of machine.shaping.get
		canRun: { type: Boolean, default: false }, // technician
		now: { type: Number, default: 0 }
	},
	data() {
		return { axis: 'X', index: 0 }
	},
	computed: {
		kind() {
			return RUN_KINDS3.shapingTune
		},
		indexes() {
			return Array.from({ length: this.accelerometer.count }, (_, i) => ({ value: i, text: '#' + i }))
		},
		tuning() {
			return this.rs.result ? normalizeTuning(this.rs.result) : null
		},
		foreignText() {
			return this.rs.foreign ? this.t('run.another_running', { kind: this.foreignKind }) : ''
		}
	},
	methods: {
		params() {
			return { axis: this.axis, accelerometer: this.index }
		}
	}
}
</script>

<style>
.shaping-tuner .tuner-report { font-family: monospace; font-size: 12px; white-space: pre-wrap; margin-top: 6px; }
</style>
