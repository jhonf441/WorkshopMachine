<template>
	<div class="probe-module">
		<div class="text-h6 mb-1">{{ t('probe.title') }}</div>
		<p class="text-body-2 machine-faint">{{ t('probe.intro') }}</p>
		<v-alert v-if="!canRun" dense outlined type="info" class="mb-3">{{ t('page.read_only') }}</v-alert>
		<v-card outlined class="mb-4 pa-3"><probe-bed :model="bedModel" /></v-card>
		<v-row v-if="canRun" dense>
			<v-col cols="6" sm="3">
				<v-text-field v-model="rs.inputs.probe" :label="t('probe.field_probe')" type="number" dense outlined hide-details="auto" :disabled="busy" :error-messages="errorOf('probe')" />
			</v-col>
			<v-col cols="6" sm="3">
				<v-text-field v-model="rs.inputs.samples" :label="t('probe.field_samples')" type="number" dense outlined hide-details="auto" :disabled="busy" :error-messages="errorOf('samples')" />
			</v-col>
		</v-row>
		<run-start v-if="canRun" :allowed="canRun" :busy="!startAllowed" :starting="rs.status === 'starting'" :disabled-text="blockedText" @start="begin()" />
		<run-progress class="mt-3" :run="rs.run" :error-text="runErrorText" :foreign-text="foreignText" :now="now" @stop="stop()" />
		<div class="text-body-2 font-weight-medium mt-4 mb-2">{{ t('probe.result_title') }}</div>
		<probe-result v-if="resultView" :view="resultView" />
		<div v-else class="text-body-2 machine-faint">{{ t('probe.no_result') }}</div>
	</div>
</template>

<script>
'use strict'

// Probe module (design 2.2): repeatability run (N touches at one point) and its result card with the traffic light. The run happens in
// the service; this component asks for it, follows it (also after a reload) and shows the result of machine.runs.

import { runModule } from './run-module.js'
import RunStart from './RunStart.vue'
import RunProgress from './RunProgress.vue'
import ProbeResult from './ProbeResult.vue'
import ProbeBed from '../bedview/ProbeBed.vue'
import { bedLayoutMixin } from './bed-layout-mixin.js'
import { RUN_KINDS } from '../api/machine-api.js'
import { repeatParams, thresholdsOf, resultView } from '../lib/probe.js'

export default {
	components: { RunStart, RunProgress, ProbeResult, ProbeBed },
	mixins: [bedLayoutMixin(), runModule([RUN_KINDS.probeRepeat], { probe: 0, samples: 10 })],
	props: {
		api: { type: Object, required: true }, // createMachineApi(...)
		published: { type: Object, default: null }, // normalizeRuns of the plugin data `machine`
		canRun: { type: Boolean, default: false }, // technician
		thresholds: { type: Object, default: null }, // profile thresholds (probe_sigma_warn / probe_sigma_bad)
		axes: { type: Array, default: () => [] }, // move.axes of the DWC model (letter, min, max)
		now: { type: Number, default: 0 }
	},
	data() {
		return { layoutMode: 'mesh' } // the layout of the probe is the same in both modes; the probe index is asked as a draft
	},
	computed: {
		form() {
			return repeatParams(this.rs.inputs)
		},
		resultView() {
			return resultView(this.rs.result, thresholdsOf(this.thresholds))
		},
		blockedText() {
			if (this.rs.status === 'starting') return ''
			return this.form.ok ? '' : this.t(Object.values(this.form.errors)[0])
		},
		foreignText() {
			return this.rs.foreign ? this.t('run.another_running', { kind: this.foreignKind }) : ''
		}
	},
	watch: {
		// the probe index of the form: the bed view shows the offset and the reach of THAT probe
		'form.params.probe'(p) {
			if (this.form.ok) this.askDraft({ probe: p })
		}
	},
	created() {
		this.refreshLayout(this.form.ok ? { probe: this.form.params.probe } : undefined)
	},
	methods: {
		errorOf(field) {
			return this.form.errors[field] ? [this.t(this.form.errors[field])] : []
		},
		begin() {
			if (this.form.ok) this.start(RUN_KINDS.probeRepeat, this.form.params)
		}
	}
}
</script>
