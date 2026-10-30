<template>
	<div class="level-module">
		<div class="text-title-large mb-1">{{ t('level.title') }}</div>
		<p class="text-body-medium machine-faint">{{ t('level.intro') }}</p>
		<div class="d-flex align-center flex-wrap mb-3" style="gap:8px">
			<span class="text-body-medium">{{ t('level.detected') }}:</span>
			<v-chip size="small" variant="outlined" :color="detection.kinds.length ? 'primary' : 'warning'">{{ t(detection.modeKey) }}</v-chip>
			<span v-if="detection.reasonKey" class="text-body-small text-warning">{{ t(detection.reasonKey) }}</span>
			<span v-else-if="detection.kinds.length < 3" class="text-body-small machine-faint">{{ t('level.reason_' + detection.mode) }}</span>
		</div>
		<v-alert v-if="!canRun" density="compact" variant="outlined" type="info" class="mb-3">{{ t('page.read_only') }}</v-alert>
		<v-card variant="outlined" class="mb-4 pa-3">
			<level-bed
				:model="bedModel" :lp="lp" :service-level="serviceLevel" :last-level="lastLevel" :result="rs.result" :editable="canRun && !busy && detection.kinds.length > 0"
				:sets="setsView" @save-set="saveSet($event.name, $event.points)" @delete-set="deleteSet"
			/>
		</v-card>
		<template v-if="canRun && detection.kinds.length">
			<v-radio-group v-model="rs.inputs.kind" :label="t('level.kind_label')" density="compact" hide-details class="mt-0 mb-3" :disabled="busy">
				<v-radio v-for="k in detection.kinds" :key="k" :value="k" :label="t('level.kind_' + k.split('.')[1])" />
			</v-radio-group>
			<v-row density="compact">
				<v-col cols="6" sm="3">
					<v-text-field v-model="rs.inputs.maxPasses" :label="t('level.field_passes')" type="number" density="compact" variant="outlined" hide-details="auto" :disabled="busy || measureOnly" :error-messages="errorOf('maxPasses')" />
				</v-col>
				<v-col cols="6" sm="3">
					<v-text-field v-model="rs.inputs.toleranceMm" :label="t('level.field_tolerance')" type="number" step="0.005" density="compact" variant="outlined" hide-details="auto" :disabled="busy" :error-messages="errorOf('toleranceMm')" />
				</v-col>
			</v-row>
			<run-start :allowed="canRun" :busy="!startAllowed" :starting="rs.status === 'starting'" :disabled-text="blockedText" @start="begin()" />
		</template>
		<run-progress class="mt-3" :run="rs.run" :error-text="runErrorText" :foreign-text="foreignText" :now="now" @stop="stop()" />
		<div class="text-body-medium font-weight-medium mt-4 mb-2">{{ t('level.result_title') }}</div>
		<level-passes v-if="hasPasses" :result="rs.result" />
		<div v-else class="text-body-medium machine-faint">{{ t('level.no_result') }}</div>
	</div>
</template>

<script setup>
// Levelling module (design 2.3): the detection mode comes from what the service discovered (machine.overview ready.levelling_mode), the
// run kinds offered follow from it (lib/level.js). Runs happen in the service: G32 through bed.g, G30 points, or measure only; progress
// per point, the table per pass, STOP. Applying changes to bed.g / M671 is a later phase and is not offered here.

import { computed, reactive, watch } from 'vue'
import { t } from '../text.js'
import { useRunModule } from './use-run-module.js'
import { useBedLayout } from './use-bed-layout.js'
import { usePointSets } from './use-point-sets.js'
import RunStart from './RunStart.vue'
import RunProgress from './RunProgress.vue'
import LevelPasses from './LevelPasses.vue'
import LevelBed from '../bedview/LevelBed.vue'
import { draftKeyOf } from '../state/bed-state.js'
import { createLevelPoints, pointsOf } from '../state/level-points-state.js'
import { KINDS, detect, runParams, defaultsOf } from '../lib/level.js'

const props = defineProps({
	api: { type: Object, required: true }, // createMachineApi(...)
	published: { type: Object, default: null }, // normalizeRuns of the plugin data `machine`
	canRun: { type: Boolean, default: false }, // technician
	canWrite: { type: Boolean, default: false }, // technician: save and delete the named point sets
	ready: { type: Object, default: null }, // normalizeOverview(...).ready
	profile: { type: Object, default: null }, // profile levelling block {max_passes, tolerance_mm}
	axes: { type: Array, default: () => [] }, // move.axes of the DWC model (letter, min, max)
	now: { type: Number, default: 0 }
})

const LAYOUT_MODE = 'level'
const { rs, busy, startAllowed, runErrorText, foreignKind, start, stop } = useRunModule(props, KINDS, { kind: 'level.measure', maxPasses: 5, toleranceMm: 0.02 })
const { bedState, bedModel, refreshLayout, layoutFor, askDraft } = useBedLayout(props, LAYOUT_MODE)
const { setsView, loadPointSets, saveSet, deleteSet } = usePointSets(props)
const lp = reactive(createLevelPoints())

// the draft the service is asked to confirm: only when the person edited the points (otherwise the layout alone has the suggestion)
const draft = computed(() => {
	const m = bedModel.value
	return lp.edited ? { points: pointsOf(lp, m.screws, m.reach, null).map(p => ({ x: p.x, y: p.y })) } : null
})
// the draft by CONTENT (see MeshModule): a new object on every model update must not ask the service again
const draftKey = computed(() => draftKeyOf(LAYOUT_MODE, draft.value || undefined))
const serviceLevel = computed(() => {
	const lay = layoutFor(draft.value || undefined)
	return lay ? lay.level : null
})
const lastLevel = computed(() => (bedState.layout ? bedState.layout.lastLevel : null))
const detection = computed(() => detect(props.ready))
const measureOnly = computed(() => rs.inputs.kind === 'level.measure')
const form = computed(() => runParams(rs.inputs, props.profile))
const hasPasses = computed(() => !!rs.result && Array.isArray(rs.result.passes))
const blockedText = computed(() => {
	if (rs.status === 'starting') return ''
	return form.value.ok ? '' : t(Object.values(form.value.errors)[0])
})
const foreignText = computed(() => (rs.foreign ? t('run.another_running', { kind: foreignKind.value }) : ''))

watch(draftKey, () => askDraft(draft.value || undefined))
watch(() => rs.result, result => {
	if (result) refreshLayout()
})

refreshLayout()
loadPointSets()
const defaults = defaultsOf(props.profile)
rs.inputs.maxPasses = defaults.maxPasses
rs.inputs.toleranceMm = defaults.toleranceMm
if (detection.value.kinds.length && detection.value.kinds.indexOf(rs.inputs.kind) < 0) rs.inputs.kind = detection.value.kinds[detection.value.kinds.length - 1]

function errorOf(field) {
	return form.value.errors[field] ? [t(form.value.errors[field])] : []
}
function begin() {
	if (!form.value.ok || detection.value.kinds.indexOf(rs.inputs.kind) < 0) return
	// measure only takes one pass: it gets the tolerance and no pass limit
	start(rs.inputs.kind, measureOnly.value ? { tolerance_mm: form.value.params.tolerance_mm } : form.value.params)
}
</script>

