<template>
	<div class="mesh-module">
		<div class="d-flex align-center flex-wrap" style="gap:8px">
			<div class="text-title-large">{{ t('mesh.title') }}</div>
			<v-spacer />
			<!-- 3D lives in the DWC Height Map page; this page does not duplicate it -->
			<v-btn size="small" variant="outlined" to="/Plugins/HeightMap"><v-icon size="small" start>mdi-cube-scan</v-icon>{{ t('mesh.open_height_map') }}</v-btn>
		</div>
		<p class="text-body-medium machine-faint">{{ t('mesh.intro') }}</p>
		<v-alert v-if="!canRun" density="compact" variant="outlined" type="info" class="mb-3">{{ t('page.read_only') }}</v-alert>
		<v-card variant="outlined" class="mb-4 pa-3">
			<mesh-bed
				:model="bedModel" :inputs="rs.inputs" :form="form" :grid="grid" :previous="previous" :service-mesh="serviceMesh" :result-signal="resultSignal"
				:thresholds="thresholds" :editable="canRun && !busy" :can-run="canRun" :pe="pe" :derived="derived" :sets="setsView"
				@save-set="saveSet($event.name, $event.points)" @delete-set="deleteSet"
			/>
		</v-card>
		<v-card v-if="canRun" variant="outlined" class="mb-4">
			<v-card-title class="text-title-medium pb-0">{{ t('mesh.run_title') }}</v-card-title>
			<v-card-text>
				<mesh-run-form :inputs="rs.inputs" :form="form" :disabled="busy" :locked="okDerived" />
				<run-start class="mt-3" :allowed="canRun" :busy="!startAllowed" :starting="rs.status === 'starting'" :disabled-text="blockedText" @start="begin()" />
			</v-card-text>
		</v-card>
		<run-progress :run="rs.run" :error-text="runErrorText" :foreign-text="foreignText" :now="now" @stop="stop()" />
		<div class="text-body-medium font-weight-medium mt-2 mb-2">{{ t('mesh.library_title') }}</div>
		<mesh-library
			:meshes="meshes" :compensation-on="compensationOn" :can-write="canWrite" :busy="working" :unavailable="libraryOff"
			:notice="notice" :error="opError" @show="show" @load="load" @clear="clear" @save="save" @taper="taper"
		/>
	</div>
</template>

<script setup>
// Mesh module (design 2.4): probe a mesh in the service (whole bed or a region), see it on the 2D bed map with its statistics, and manage
// the compensation (load, clear, save, taper) from the library. The run is followed like the others (re-attaches after a reload); the
// grid to show comes in the run result or is fetched with machine.mesh.get. 3D is the DWC Height Map page (button above).

import { computed, reactive, ref, watch } from 'vue'
import { t } from '../text.js'
import { useRunModule } from './use-run-module.js'
import { useBedLayout } from './use-bed-layout.js'
import { usePointSets } from './use-point-sets.js'
import RunStart from './RunStart.vue'
import RunProgress from './RunProgress.vue'
import MeshRunForm from './MeshRunForm.vue'
import MeshBed from '../bedview/MeshBed.vue'
import MeshLibrary from './MeshLibrary.vue'
import { draftKeyOf } from '../state/bed-state.js'
import { RUN_KINDS, refusalOf } from '../api/machine-api.js'
import { normalizeGrid, probeParams, qualityThresholds } from '../lib/mesh-grid.js'
import { meshArea } from '../lib/bed-mesh-plan.js'
import { gridFromPoints, effectiveInputs } from '../lib/point-grid.js'
import { createPointEdit } from '../state/point-edit-state.js'
import { refusalKey } from '../lib/runs.js'

const props = defineProps({
	api: { type: Object, required: true }, // createMachineApi(...)
	published: { type: Object, default: null }, // normalizeRuns of the plugin data `machine`
	canRun: { type: Boolean, default: false }, // technician
	ready: { type: Object, default: null }, // normalizeOverview(...).ready
	axes: { type: Array, default: () => [] }, // move.axes of the DWC model (letter, min, max)
	quality: { type: Object, default: null }, // profile mesh.quality
	canWrite: { type: Boolean, default: false }, // technician: load / clear / save / taper
	now: { type: Number, default: 0 }
})
const emit = defineEmits(['changed'])

const LAYOUT_MODE = 'mesh'
const grid = ref(null)
const previous = ref(null)
const pe = reactive(createPointEdit())
const resultSignal = ref(0)
const meshes = ref([])
const libraryOff = ref(false)
const working = ref(false)
const notice = ref('')
const opError = ref('')

const { rs, busy, startAllowed, runErrorText, foreignKind, start, stop } = useRunModule(props, [RUN_KINDS.meshProbe], () => ({ mode: 'bed', nx: 5, ny: 5, probe: 0, region: { xmin: '', xmax: '', ymin: '', ymax: '' } }))
const { bedState, bedModel, refreshLayout, layoutFor, askDraft } = useBedLayout(props, LAYOUT_MODE, grid)
const { setsView, loadPointSets, saveSet, deleteSet } = usePointSets(props)

const bed = computed(() => bedModel.value.bed)
// the points the person chose on the bed (Points mode) imply a regular grid; it replaces the typed counts and region in the run
const derived = computed(() => {
	const area = meshArea(bed.value, bedModel.value.reach, null)
	return pe.mode === 'points' && pe.points.length ? gridFromPoints(pe.points, { area }) : null
})
const okDerived = computed(() => (derived.value && derived.value.ok ? derived.value : null))
const form = computed(() => probeParams(effectiveInputs(rs.inputs, okDerived.value), bed.value))
// the draft the service is asked to confirm (region + points per axis); its points are used only if they answer THIS draft
const draft = computed(() => {
	const p = form.value.params
	return form.value.ok ? { region: p.mode === 'region' ? p.region : null, points: p.points, probe: p.probe } : null
})
// the draft by CONTENT: `draft` is a new object every time the model updates, and watching it asked the service again and again
const draftKey = computed(() => (draft.value ? draftKeyOf(LAYOUT_MODE, draft.value) : ''))
const serviceMesh = computed(() => {
	const lay = draft.value ? layoutFor(draft.value) : null
	return lay ? lay.mesh : null
})
const thresholds = computed(() => qualityThresholds(props.quality))
const compensationOn = computed(() => !!props.ready && props.ready.meshActive)
const blockedText = computed(() => {
	if (rs.status === 'starting') return ''
	return form.value.ok ? '' : t(Object.values(form.value.errors)[0])
})
const foreignText = computed(() => (rs.foreign ? t('run.another_running', { kind: foreignKind.value }) : ''))

// a finished run shows its mesh: the grid comes in the result, or by id
watch(() => rs.result, result => {
	const found = result && (normalizeGrid(result.grid) || null)
	if (found) { setGrid(found); resultSignal.value++ }
	else if (result && result.mesh_id) show(result.mesh_id)
	if (result) { loadLibrary(); refreshLayout() }
})
watch(draftKey, k => {
	if (k) askDraft(draft.value)
})

loadLibrary()
loadPointSets()
// the last mesh the service knows is shown at once, when nothing else is
refreshLayout(draft.value || undefined).then(() => {
	const lay = bedState.layout
	if (!grid.value && lay && lay.lastMesh) setGrid(normalizeGrid(lay.lastMesh))
})

function begin() {
	if (form.value.ok) start(RUN_KINDS.meshProbe, form.value.params)
}
async function loadLibrary() {
	try {
		meshes.value = await props.api.mesh.list()
		libraryOff.value = false
	} catch (e) {
		libraryOff.value = ['not_implemented', 'service_outdated', 'invalid_args'].indexOf(e && e.code) >= 0
		if (!libraryOff.value) opError.value = failText(e)
	}
}
// the mesh on show; the one that was on show becomes the "previous" to compare with
function setGrid(g) {
	if (!g) return
	if (grid.value && grid.value.id !== g.id) previous.value = grid.value
	grid.value = g
}
function failText(e) {
	return t(refusalKey(refusalOf(e))) + (e && e.message ? ' (' + e.message + ')' : '')
}
async function show(id) {
	opError.value = ''
	try {
		const g = normalizeGrid(await props.api.mesh.get(id))
		if (g) { setGrid(g); resultSignal.value++ }
		else opError.value = t('mesh.err_grid')
	} catch (e) {
		opError.value = failText(e)
	}
}
// one write of the compensation: the busy flag, the notice, and a fresh library and overview afterwards
async function write(call, doneKey) {
	working.value = true
	notice.value = ''
	opError.value = ''
	try {
		await call()
		notice.value = t(doneKey)
		await loadLibrary()
		emit('changed')
	} catch (e) {
		if (!e || e.code !== 'cancelled') opError.value = failText(e)
	} finally {
		working.value = false
	}
}
function load(id) {
	return write(() => props.api.mesh.load(id), 'mesh.done_load')
}
function clear() {
	return write(() => props.api.mesh.clear(), 'mesh.done_clear')
}
function save(name) {
	return write(() => props.api.mesh.save(name), 'mesh.done_save')
}
function taper(height) {
	return write(() => props.api.mesh.taper(height), 'mesh.done_taper')
}
</script>

