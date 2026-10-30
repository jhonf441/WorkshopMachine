<template>
	<div class="report-module">
		<div>
			<div class="text-title-large mb-1">{{ t('report.title') }}</div>
			<p class="text-body-medium machine-faint">{{ t('report.intro') }}</p>
			<div class="d-flex align-center flex-wrap" style="gap:8px">
				<v-btn-toggle v-model="mode" mandatory density="compact">
					<v-btn size="small" value="full">{{ t('report.mode_full') }}</v-btn>
					<v-btn size="small" value="record" :disabled="!target">{{ t('report.mode_record') }}</v-btn>
				</v-btn-toggle>
				<v-btn size="small" color="primary" :loading="rs.status === 'loading'" @click="load()"><v-icon size="small" start>mdi-file-refresh-outline</v-icon>{{ t('report.build') }}</v-btn>
				<v-btn size="small" variant="outlined" :disabled="!report" @click="print()"><v-icon size="small" start>mdi-printer</v-icon>{{ t('report.print') }}</v-btn>
			</div>
			<div v-if="report" class="text-body-small machine-faint mt-1">{{ t('report.print_hint') }}</div>
			<v-alert v-if="rs.status === 'error' && rs.error" density="compact" variant="outlined" type="error" class="mt-2">{{ t(rs.error.key) }}<span v-if="rs.error.detail"> ({{ rs.error.detail }})</span></v-alert>
		</div>
		<report-view v-if="report" class="mt-3" :report="report" />
	</div>
</template>

<script setup>
// Report module (design 2.11): the printable page of one calibration or of the whole machine status. The data comes from the service
// (machine.report: numbers and tables, no drawing); the page is drawn here as plain HTML and inline SVG, and "Print / save as PDF" is the
// browser's window.print().

import { computed, reactive, ref } from 'vue'
import ReportView from './ReportView.vue'
import { t } from '../text.js'
import { createReportState, setTarget, loadBegin, loadDone, loadFailed, targetOf } from '../state/report-state.js'
import { buildReport } from '../lib/report-model.js'
import { bedOf } from '../lib/mesh-grid.js'
import { planErrorKey } from '../lib/plan-diff.js'
import { refusalOf } from '../api/machine-api.js'

const props = defineProps({
	api: { type: Object, required: true }, // createMachineApi(...)
	target: { type: String, default: '' }, // id of the record the person asked a report of from the History module
	axes: { type: Array, default: () => [] }
})

const rs = reactive(createReportState())
const mode = ref('full')

const report = computed(() => {
	if (!rs.data || rs.status !== 'ready') return null
	return buildReport(rs.data, {
		bed: bedOf(props.axes, null),
		labels: { pass: t('report.label_pass'), tolerance: t('report.label_tolerance'), legend: t('mesh.legend'), meshMap: t('mesh.map_title'), residual: t('report.drawing_residual') }
	})
})

async function load() {
	setTarget(rs, mode.value, props.target)
	loadBegin(rs)
	try {
		loadDone(rs, await props.api.history.report(targetOf(rs)))
	} catch (e) {
		loadFailed(rs, planErrorKey(refusalOf(e)), e && e.message)
	}
}
function print() {
	window.print()
}

if (props.target) {
	mode.value = 'record'
	load()
}
</script>
