<template>
	<div class="safety-module">
		<div class="text-title-large mb-1">{{ t('safety.title') }}</div>
		<p class="text-body-medium machine-faint">{{ t('safety.intro') }}</p>
		<div class="d-flex align-center flex-wrap" style="gap:8px">
			<v-btn color="primary" :disabled="!startAllowed" :loading="busy" @click="start(kind, {})"><v-icon start>mdi-shield-search</v-icon>{{ t('safety.run') }}</v-btn>
			<span class="text-body-small machine-faint">{{ t('safety.no_motion') }}</span>
			<span v-if="!canRun" class="text-body-small machine-faint">{{ t('run.needs_technician') }}</span>
		</div>
		<run-progress class="mt-3" :run="rs.run" :error-text="runErrorText" :foreign-text="foreignText" :now="now" @stop="stop()" />
		<template v-if="result">
			<div class="d-flex flex-wrap align-center mt-4" style="gap:8px">
				<v-chip size="small" :color="verdict.color" variant="flat"><v-icon size="x-small" start>{{ verdict.icon }}</v-icon>{{ t('safety.verdict_' + result.verdict) }}</v-chip>
				<v-chip v-for="s in counts" :key="s.severity" size="small" variant="outlined" :color="s.color"><v-icon size="x-small" start>{{ s.icon }}</v-icon>{{ t(s.textKey) }}: {{ s.n }}</v-chip>
				<span v-if="result.generatedAt" class="text-body-small machine-faint">{{ t('safety.checked_at', { when: when }) }}</span>
			</div>
			<div v-if="!rows.length" class="text-body-medium machine-faint mt-3">{{ t('safety.no_items') }}</div>
			<v-table v-else density="compact" class="mt-2">
				<thead>
					<tr>
						<th class="text-left">{{ t('safety.col_severity') }}</th>
						<th class="text-left">{{ t('safety.col_item') }}</th>
						<th class="text-left">{{ t('safety.col_fix') }}</th>
					</tr>
				</thead>
				<tbody>
					<tr v-for="r in rows" :key="r.id">
						<td class="text-no-wrap"><v-chip size="x-small" variant="outlined" :color="r.color"><v-icon size="x-small" start>{{ r.icon }}</v-icon>{{ t(r.severityKey) }}</v-chip></td>
						<td>
							<div>{{ r.known ? t(r.textKey) : r.name }}</div>
							<div v-if="r.detail" class="text-body-small machine-faint">{{ detailOf(r) }}</div>
						</td>
						<td>
							<span v-if="r.actionKey">{{ t(r.actionKey) }}</span>
							<v-btn v-if="r.goto" size="x-small" variant="text" color="primary" @click="$emit('goto', r.goto)">{{ t('safety.open_module') }}</v-btn>
						</td>
					</tr>
				</tbody>
			</v-table>
		</template>
		<div v-else-if="!busy" class="text-body-medium machine-faint mt-3">{{ t('safety.not_run') }}</div>
	</div>
</template>

<script setup>
// Safety diagnosis module (design 2.9): ONE button runs the read-only machine check in the service (a procedure of kind safety.check:
// nothing moves, no reservation, it also works during a job) and the table lists every item with its severity and what to do about
// it. The newest finished check stays visible after a reload (machine.runs). The items that need motion are separate buttons in their
// own modules; this one only points to them.

import { computed } from 'vue'
import { useRunModule } from './use-run-module.js'
import RunProgress from './RunProgress.vue'
import { t } from '../text.js'
import { RUN_KINDS2, normalizeSafety } from '../api/machine-api-p2.js'
import { checkRows, summaryOf, severityView, detailText, SEVERITIES } from '../lib/safety.js'
import { formatDate } from '../lib/format.js'

const props = defineProps({
	api: { type: Object, required: true }, // createMachineApi(...)
	published: { type: Object, default: null }, // normalizeRuns of the plugin data `machine`
	canRun: { type: Boolean, default: false }, // technician: machine.run
	now: { type: Number, default: 0 }
})
defineEmits(['goto'])

const { rs, busy, startAllowed, runErrorText, foreignKind, start, stop } = useRunModule(props, [RUN_KINDS2.safetyCheck], {})

const kind = RUN_KINDS2.safetyCheck
const detailOf = r => detailText(r.parts, t)
const result = computed(() => (rs.result ? normalizeSafety(rs.result) : null))
const rows = computed(() => checkRows(result.value))
const verdict = computed(() => severityView(result.value.verdict))
const counts = computed(() => {
	const sum = summaryOf(result.value ? result.value.items : [])
	return SEVERITIES.slice().reverse().filter(s => sum[s] > 0).map(s => Object.assign({ n: sum[s] }, severityView(s)))
})
const when = computed(() => formatDate(result.value && result.value.generatedAt))
const foreignText = computed(() => (rs.foreign ? t('run.another_running', { kind: foreignKind.value }) : ''))
</script>
