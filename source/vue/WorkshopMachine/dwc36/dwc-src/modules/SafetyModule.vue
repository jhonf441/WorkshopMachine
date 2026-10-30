<template>
	<div class="safety-module">
		<div class="text-h6 mb-1">{{ t('safety.title') }}</div>
		<p class="text-body-2 machine-faint">{{ t('safety.intro') }}</p>
		<div class="d-flex align-center flex-wrap" style="gap:8px">
			<v-btn color="primary" :disabled="!startAllowed" :loading="busy" @click="start(kind, {})"><v-icon left>mdi-shield-search</v-icon>{{ t('safety.run') }}</v-btn>
			<span class="text-caption machine-faint">{{ t('safety.no_motion') }}</span>
			<span v-if="!canRun" class="text-caption machine-faint">{{ t('run.needs_technician') }}</span>
		</div>
		<run-progress class="mt-3" :run="rs.run" :error-text="runErrorText" :foreign-text="foreignText" :now="now" @stop="stop()" />
		<template v-if="result">
			<div class="d-flex flex-wrap align-center mt-4" style="gap:8px">
				<v-chip small :color="verdict.color" dark><v-icon x-small left>{{ verdict.icon }}</v-icon>{{ t('safety.verdict_' + result.verdict) }}</v-chip>
				<v-chip v-for="s in counts" :key="s.severity" small outlined :color="s.color"><v-icon x-small left>{{ s.icon }}</v-icon>{{ t(s.textKey) }}: {{ s.n }}</v-chip>
				<span v-if="result.generatedAt" class="text-caption machine-faint">{{ t('safety.checked_at', { when: when }) }}</span>
			</div>
			<div v-if="!rows.length" class="text-body-2 machine-faint mt-3">{{ t('safety.no_items') }}</div>
			<v-simple-table v-else dense class="mt-2">
				<thead>
					<tr>
						<th class="text-left">{{ t('safety.col_severity') }}</th>
						<th class="text-left">{{ t('safety.col_item') }}</th>
						<th class="text-left">{{ t('safety.col_fix') }}</th>
					</tr>
				</thead>
				<tbody>
					<tr v-for="r in rows" :key="r.id">
						<td class="text-no-wrap"><v-chip x-small outlined :color="r.color"><v-icon x-small left>{{ r.icon }}</v-icon>{{ t(r.severityKey) }}</v-chip></td>
						<td>
							<div>{{ r.known ? t(r.textKey) : r.name }}</div>
							<div v-if="r.detail" class="text-caption machine-faint">{{ detailOf(r) }}</div>
						</td>
						<td>
							<span v-if="r.actionKey">{{ t(r.actionKey) }}</span>
							<v-btn v-if="r.goto" x-small text color="primary" @click="$emit('goto', r.goto)">{{ t('safety.open_module') }}</v-btn>
						</td>
					</tr>
				</tbody>
			</v-simple-table>
		</template>
		<div v-else-if="!busy" class="text-body-2 machine-faint mt-3">{{ t('safety.not_run') }}</div>
	</div>
</template>

<script>
'use strict'

// Safety diagnosis module (design 2.9): ONE button runs the read-only machine check in the service (a procedure of kind safety.check:
// nothing moves, no reservation, it also works during a job) and the table lists every item with its severity and what to do about
// it. The newest finished check stays visible after a reload (machine.runs). The items that need motion are separate buttons in their
// own modules; this one only points to them.

import { runModule } from './run-module.js'
import RunProgress from './RunProgress.vue'
import { RUN_KINDS2, normalizeSafety } from '../api/machine-api-p2.js'
import { checkRows, summaryOf, severityView, detailText, SEVERITIES } from '../lib/safety.js'
import { formatDate } from '../lib/format.js'

export default {
	components: { RunProgress },
	mixins: [runModule([RUN_KINDS2.safetyCheck], {})],
	props: {
		api: { type: Object, required: true }, // createMachineApi(...)
		published: { type: Object, default: null }, // normalizeRuns of the plugin data `machine`
		canRun: { type: Boolean, default: false }, // technician: machine.run
		now: { type: Number, default: 0 }
	},
	methods: {
		detailOf(r) {
			return detailText(r.parts, (key, params) => this.t(key, params))
		}
	},
	computed: {
		kind() {
			return RUN_KINDS2.safetyCheck
		},
		result() {
			return this.rs.result ? normalizeSafety(this.rs.result) : null
		},
		rows() {
			return checkRows(this.result)
		},
		verdict() {
			return severityView(this.result.verdict)
		},
		counts() {
			const sum = summaryOf(this.result ? this.result.items : [])
			return SEVERITIES.slice().reverse().filter(s => sum[s] > 0).map(s => Object.assign({ n: sum[s] }, severityView(s)))
		},
		when() {
			return formatDate(this.result && this.result.generatedAt)
		},
		foreignText() {
			return this.rs.foreign ? this.t('run.another_running', { kind: this.foreignKind }) : ''
		}
	}
}
</script>
