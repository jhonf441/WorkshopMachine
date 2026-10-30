<template>
	<div class="probe-module">
		<div class="text-title-large mb-1">{{ t('probe.title') }}</div>
		<p class="text-body-medium machine-faint">{{ t('probe.intro') }}</p>
		<v-alert v-if="!canRun" density="compact" variant="outlined" type="info" class="mb-3">{{ t('page.read_only') }}</v-alert>
		<v-card variant="outlined" class="mb-4 pa-3"><probe-bed :model="bedModel" /></v-card>
		<v-row v-if="canRun" density="compact">
			<v-col cols="6" sm="3">
				<v-text-field v-model="rs.inputs.probe" :label="t('probe.field_probe')" type="number" density="compact" variant="outlined" hide-details="auto" :disabled="busy" :error-messages="errorOf('probe')" />
			</v-col>
			<v-col cols="6" sm="3">
				<v-text-field v-model="rs.inputs.samples" :label="t('probe.field_samples')" type="number" density="compact" variant="outlined" hide-details="auto" :disabled="busy" :error-messages="errorOf('samples')" />
			</v-col>
		</v-row>
		<run-start v-if="canRun" :allowed="canRun" :busy="!startAllowed" :starting="rs.status === 'starting'" :disabled-text="blockedText" @start="begin()" />
		<run-progress class="mt-3" :run="rs.run" :error-text="runErrorText" :foreign-text="foreignText" :now="now" @stop="stop()" />
		<div class="text-body-medium font-weight-medium mt-4 mb-2">{{ t('probe.result_title') }}</div>
		<probe-result v-if="resultView" :view="resultView" />
		<div v-else class="text-body-medium machine-faint">{{ t('probe.no_result') }}</div>
	</div>
</template>

<script setup>
// Probe module (design 2.2): repeatability run (N touches at one point) and its result card with the traffic light. The run happens in
// the service; this component asks for it, follows it (also after a reload) and shows the result of machine.runs.

import { computed, watch } from 'vue'
import { t } from '../text.js'
import { useRunModule } from './use-run-module.js'
import { useBedLayout } from './use-bed-layout.js'
import RunStart from './RunStart.vue'
import RunProgress from './RunProgress.vue'
import ProbeResult from './ProbeResult.vue'
import ProbeBed from '../bedview/ProbeBed.vue'
import { RUN_KINDS } from '../api/machine-api.js'
import { repeatParams, thresholdsOf, resultView as probeResultView } from '../lib/probe.js'

const props = defineProps({
	api: { type: Object, required: true }, // createMachineApi(...)
	published: { type: Object, default: null }, // normalizeRuns of the plugin data `machine`
	canRun: { type: Boolean, default: false }, // technician
	thresholds: { type: Object, default: null }, // profile thresholds (probe_sigma_warn / probe_sigma_bad)
	axes: { type: Array, default: () => [] }, // move.axes of the DWC model (letter, min, max)
	now: { type: Number, default: 0 }
})

const { rs, busy, startAllowed, runErrorText, foreignKind, start, stop } = useRunModule(props, [RUN_KINDS.probeRepeat], { probe: 0, samples: 10 })
// the layout of the probe is the same in both modes; the probe index is asked as a draft
const { bedModel, refreshLayout, askDraft } = useBedLayout(props, 'mesh')

const form = computed(() => repeatParams(rs.inputs))
const resultView = computed(() => probeResultView(rs.result, thresholdsOf(props.thresholds)))
const blockedText = computed(() => {
	if (rs.status === 'starting') return ''
	return form.value.ok ? '' : t(Object.values(form.value.errors)[0])
})
const foreignText = computed(() => (rs.foreign ? t('run.another_running', { kind: foreignKind.value }) : ''))

// the probe index of the form: the bed view shows the offset and the reach of THAT probe
watch(() => form.value.params.probe, p => {
	if (form.value.ok) askDraft({ probe: p })
})

refreshLayout(form.value.ok ? { probe: form.value.params.probe } : undefined)

function errorOf(field) {
	return form.value.errors[field] ? [t(form.value.errors[field])] : []
}
function begin() {
	if (form.value.ok) start(RUN_KINDS.probeRepeat, form.value.params)
}
</script>

