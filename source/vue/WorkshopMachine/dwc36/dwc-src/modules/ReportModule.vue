<template>
	<div class="report-module">
		<div>
			<div class="text-h6 mb-1">{{ t('report.title') }}</div>
			<p class="text-body-2 machine-faint">{{ t('report.intro') }}</p>
			<div class="d-flex align-center flex-wrap" style="gap:8px">
				<v-btn-toggle v-model="mode" mandatory dense>
					<v-btn small value="full">{{ t('report.mode_full') }}</v-btn>
					<v-btn small value="record" :disabled="!target">{{ t('report.mode_record') }}</v-btn>
				</v-btn-toggle>
				<v-btn small color="primary" :loading="rs.status === 'loading'" @click="load()"><v-icon small left>mdi-file-refresh-outline</v-icon>{{ t('report.build') }}</v-btn>
				<v-btn small outlined :disabled="!report" @click="print()"><v-icon small left>mdi-printer</v-icon>{{ t('report.print') }}</v-btn>
			</div>
			<div v-if="report" class="text-caption machine-faint mt-1">{{ t('report.print_hint') }}</div>
			<v-alert v-if="rs.status === 'error' && rs.error" dense outlined type="error" class="mt-2">{{ t(rs.error.key) }}<span v-if="rs.error.detail"> ({{ rs.error.detail }})</span></v-alert>
		</div>
		<report-view v-if="report" class="mt-3" :report="report" />
	</div>
</template>

<script>
'use strict'

// Report module (design 2.11): the printable page of one calibration or of the whole machine status. The data comes from the service
// (machine.report: numbers and tables, no drawing); the page is drawn here as plain HTML and inline SVG, and "Print / save as PDF" is the
// browser's window.print().

import ReportView from './ReportView.vue'
import { textMixin } from './text-mixin.js'
import { createReportState, setTarget, loadBegin, loadDone, loadFailed, targetOf } from '../state/report-state.js'
import { buildReport } from '../lib/report-model.js'
import { bedOf } from '../lib/mesh-grid.js'
import { planErrorKey } from '../lib/plan-diff.js'
import { refusalOf } from '../api/machine-api.js'

export default {
	components: { ReportView },
	mixins: [textMixin],
	props: {
		api: { type: Object, required: true }, // createMachineApi(...)
		target: { type: String, default: '' }, // id of the record the person asked a report of from the History module
		axes: { type: Array, default: () => [] }
	},
	data() {
		return { rs: createReportState(), mode: 'full' }
	},
	computed: {
		report() {
			if (!this.rs.data || this.rs.status !== 'ready') return null
			return buildReport(this.rs.data, {
				bed: bedOf(this.axes, null),
				labels: { pass: this.t('report.label_pass'), tolerance: this.t('report.label_tolerance'), legend: this.t('mesh.legend'), meshMap: this.t('mesh.map_title'), residual: this.t('report.drawing_residual') }
			})
		}
	},
	created() {
		if (this.target) {
			this.mode = 'record'
			this.load()
		}
	},
	methods: {
		async load() {
			setTarget(this.rs, this.mode, this.target)
			loadBegin(this.rs)
			try {
				loadDone(this.rs, await this.api.history.report(targetOf(this.rs)))
			} catch (e) {
				loadFailed(this.rs, planErrorKey(refusalOf(e)), e && e.message)
			}
		},
		print() {
			window.print()
		}
	}
}
</script>
