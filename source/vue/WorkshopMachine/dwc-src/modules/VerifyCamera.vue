<template>
	<div class="verify-camera">
		<p class="text-body-medium machine-faint">{{ t('verify.intro') }}</p>
		<details class="wf-more" v-if="mode === 'manual'">
			<summary>{{ t('common.how_it_works') }}</summary>
		<v-alert density="compact" variant="outlined" type="info">{{ t('verify.manual') }}</v-alert>
		</details>
		<div v-else-if="mode === 'checking'" class="text-body-medium machine-faint">{{ t('common.loading') }}</div>
		<template v-else>
			<div class="d-flex align-start flex-wrap" style="gap:8px">
				<v-select v-model="vs.form.target" :items="targetItems" item-title="text" :label="t('verify.field_target')" density="compact" variant="outlined" hide-details style="max-width:170px" :disabled="!canRun || busy" />
				<v-select
					v-if="vs.form.target === 'system'" v-model="vs.form.system" :items="systemItems" item-title="text" :label="t('verify.field_system')" density="compact" variant="outlined" hide-details
					style="max-width:170px" :disabled="!canRun || busy"
				/>
				<v-select v-model="vs.form.method" :items="methodItems" item-title="text" :label="t('verify.field_method')" density="compact" variant="outlined" hide-details style="max-width:190px" :disabled="!canRun || busy" />
				<v-text-field
					v-model="vs.form.tolerance" :label="t('verify.field_tolerance')" density="compact" variant="outlined" hide-details="auto" style="max-width:130px" :disabled="!canRun || busy"
					:error-messages="params ? [] : [t('verify.err_tolerance')]"
				/>
				<v-btn size="small" color="primary" :disabled="!startAllowed || !params" :loading="busy" @click="start(kind, params)"><v-icon size="small" start>mdi-camera-marker-outline</v-icon>{{ t('verify.run') }}</v-btn>
			</div>
			<div class="text-body-small machine-faint mt-1">{{ vs.form.target === 'tool' ? t('verify.tool_note') : t('verify.system_note') }}</div>
			<div class="text-body-small machine-faint">{{ t('verify.moves_note') }}</div>
			<div v-if="!canRun" class="text-body-small machine-faint">{{ t('run.needs_technician') }}</div>
			<run-progress class="mt-3" :run="rs.run" :error-text="runErrorText" :foreign-text="foreignText" :now="now" @stop="stop()" />
			<v-alert v-if="lastResult" density="compact" variant="outlined" :type="lastResult.view.outcome === 'ok' ? 'success' : 'warning'" class="mt-3">{{ t('verify.last_' + lastResult.view.outcome) }}</v-alert>
			<div v-if="!rows.length" class="text-body-medium machine-faint mt-3">{{ t('verify.no_rows') }}</div>
			<template v-else>
				<div v-if="worst !== null" class="text-body-medium mt-3">{{ t('verify.worst', { mm: fmt(worst) }) }}</div>
				<v-table density="compact" class="mt-2">
					<thead>
						<tr>
							<th class="text-left">{{ t('verify.col_outcome') }}</th>
							<th class="text-left">{{ t('verify.col_target') }}</th>
							<th class="text-left">{{ t('verify.col_method') }}</th>
							<th class="text-right">{{ t('verify.col_error') }}</th>
							<th class="text-right">{{ t('verify.col_dx') }}</th>
							<th class="text-right">{{ t('verify.col_dy') }}</th>
							<th class="text-right">{{ t('verify.col_uncertainty') }}</th>
							<th class="text-right">{{ t('verify.col_tolerance') }}</th>
						</tr>
					</thead>
					<tbody>
						<tr v-for="r in rows" :key="r.key">
							<td class="text-no-wrap"><v-chip size="x-small" variant="outlined" :color="r.view.color"><v-icon size="x-small" start>{{ r.view.icon }}</v-icon>{{ t(r.view.textKey) }}</v-chip></td>
							<td class="text-no-wrap">{{ targetText(r) }}</td>
							<td>{{ t('verify.method_' + r.method) }}</td>
							<td class="text-right">{{ fmt(r.errorMm) }}</td>
							<td class="text-right">{{ fmt(r.dxMm) }}</td>
							<td class="text-right">{{ fmt(r.dyMm) }}</td>
							<td class="text-right">{{ fmt(r.uncertaintyMm) }}</td>
							<td class="text-right">{{ fmt(r.toleranceMm) }}</td>
						</tr>
					</tbody>
				</v-table>
				<div class="text-body-small machine-faint mt-1">{{ t('verify.table_note') }}</div>
			</template>
		</template>
	</div>
</template>

<script setup>
// Camera verification of the offsets (design 2.7 and 2.12). Visible in the Offsets module; ENABLED only when the service reports the
// capability `vision.measure` (machine.state vision.measure). Without it the section says that the verification is manual. The measurement
// is a procedure of the service (it moves the machine, asks Vision where the mark is and compares); the page shows the table of the error
// in mm per system / tool: the latest result of each, from the history and from the runs of this session.

import { computed, reactive, watch } from 'vue'
import { useRunModule } from './use-run-module.js'
import RunProgress from './RunProgress.vue'
import { t } from '../text.js'
import { RUN_KINDS4, normalizeVerification } from '../api/machine-api-p4.js'
import { modeOf, runParams, tableRows, worstError, outcomeView, systemName, TARGETS, METHODS, SYSTEMS } from '../lib/verification.js'
import { createVerifyState, addResult, seed, rowsOf } from '../state/verify-state.js'
import { formatNumber } from '../lib/format.js'

const props = defineProps({
	api: { type: Object, required: true }, // createMachineApi(...)
	published: { type: Object, default: null }, // normalizeRuns of the plugin data `machine`
	canRun: { type: Boolean, default: false }, // technician: machine.run
	measure: { type: Boolean, default: null }, // machine.state vision.measure: true / false, null while it is not known
	now: { type: Number, default: 0 }
})

const { rs, busy, startAllowed, runErrorText, foreignKind, start, stop } = useRunModule(props, [RUN_KINDS4.offsetsVerify], {})

const vs = reactive(createVerifyState())
const kind = RUN_KINDS4.offsetsVerify

const mode = computed(() => modeOf(props.measure))
const params = computed(() => runParams(vs.form))
const targetItems = computed(() => TARGETS.map(v => ({ value: v, text: t('verify.target_' + v) })))
const methodItems = computed(() => METHODS.map(v => ({ value: v, text: t('verify.method_' + v) })))
const systemItems = computed(() => [{ value: '', text: t('verify.system_current') }].concat(SYSTEMS.map(n => ({ value: n, text: systemName(n) }))))
const rows = computed(() => tableRows(rowsOf(vs)))
const worst = computed(() => worstError(rows.value))
// the row of the run just finished, for the one-line verdict above the table
const lastResult = computed(() => {
	const row = rs.status === 'done' && rs.result ? normalizeVerification(rs.result) : null
	return row ? Object.assign({ view: outcomeView(row.outcome) }, row) : null
})
const foreignText = computed(() => (rs.foreign ? t('run.another_running', { kind: foreignKind.value }) : ''))

// a run finished: its result goes into the table
watch(() => rs.status, status => {
	const row = status === 'done' && rs.result ? normalizeVerification(rs.result) : null
	if (row) addResult(vs, row)
})

function fmt(v) {
	return typeof v === 'number' ? formatNumber(v, 2) : '-'
}
function targetText(r) {
	return r.targetKind === 'tool' ? t('verify.tool_n', { n: r.number }) : systemName(r.number)
}

props.api.maintenance.verify.recent(10).then(rows2 => seed(vs, rows2), () => seed(vs, []))
</script>
