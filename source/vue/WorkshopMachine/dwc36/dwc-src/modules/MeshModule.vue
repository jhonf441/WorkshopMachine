<template>
	<div class="mesh-module">
		<div class="d-flex align-center flex-wrap" style="gap:8px">
			<div class="text-h6">{{ t('mesh.title') }}</div>
			<v-spacer />
			<!-- 3D lives in the DWC Height Map page; this page does not duplicate it -->
			<v-btn small outlined to="/Plugins/HeightMap"><v-icon small left>mdi-cube-scan</v-icon>{{ t('mesh.open_height_map') }}</v-btn>
		</div>
		<p class="text-body-2 machine-faint">{{ t('mesh.intro') }}</p>
		<v-alert v-if="!canRun" dense outlined type="info" class="mb-3">{{ t('page.read_only') }}</v-alert>
		<v-card outlined class="mb-4 pa-3">
			<mesh-bed
				:model="bedModel" :inputs="rs.inputs" :form="form" :grid="grid" :previous="previous" :service-mesh="serviceMesh" :result-signal="resultSignal"
				:thresholds="thresholds" :editable="canRun && !busy" :can-run="canRun" :pe="pe" :derived="derived" :sets="setsView"
				@save-set="saveSet($event.name, $event.points)" @delete-set="deleteSet"
			/>
		</v-card>
		<v-card v-if="canRun" outlined class="mb-4">
			<v-card-title class="text-subtitle-1 pb-0">{{ t('mesh.run_title') }}</v-card-title>
			<v-card-text>
				<mesh-run-form :inputs="rs.inputs" :form="form" :disabled="busy" :locked="okDerived" />
				<run-start class="mt-3" :allowed="canRun" :busy="!startAllowed" :starting="rs.status === 'starting'" :disabled-text="blockedText" @start="begin()" />
			</v-card-text>
		</v-card>
		<run-progress :run="rs.run" :error-text="runErrorText" :foreign-text="foreignText" :now="now" @stop="stop()" />
		<div class="text-body-2 font-weight-medium mt-2 mb-2">{{ t('mesh.library_title') }}</div>
		<mesh-library
			:meshes="meshes" :compensation-on="compensationOn" :can-write="canWrite" :busy="working" :unavailable="libraryOff"
			:notice="notice" :error="opError" @show="show" @load="load" @clear="clear" @save="save" @taper="taper"
		/>
	</div>
</template>

<script>
'use strict'

// Mesh module (design 2.4): probe a mesh in the service (whole bed or a region), see it on the 2D bed map with its statistics, and manage
// the compensation (load, clear, save, taper) from the library. The run is followed like the others (re-attaches after a reload); the
// grid to show comes in the run result or is fetched with machine.mesh.get. 3D is the DWC Height Map page (button above).

import { runModule } from './run-module.js'
import RunStart from './RunStart.vue'
import RunProgress from './RunProgress.vue'
import MeshRunForm from './MeshRunForm.vue'
import MeshBed from '../bedview/MeshBed.vue'
import { bedLayoutMixin } from './bed-layout-mixin.js'
import { pointSetsMixin } from './pointsets-mixin.js'
import { draftKeyOf } from '../state/bed-state.js'
import MeshLibrary from './MeshLibrary.vue'
import { RUN_KINDS, refusalOf } from '../api/machine-api.js'
import { normalizeGrid, probeParams, qualityThresholds } from '../lib/mesh-grid.js'
import { meshArea } from '../lib/bed-mesh-plan.js'
import { gridFromPoints, effectiveInputs } from '../lib/point-grid.js'
import { createPointEdit } from '../state/point-edit-state.js'
import { refusalKey } from '../lib/runs.js'

export default {
	components: { RunStart, RunProgress, MeshRunForm, MeshBed, MeshLibrary },
	mixins: [bedLayoutMixin(), pointSetsMixin(), runModule([RUN_KINDS.meshProbe], () => ({ mode: 'bed', nx: 5, ny: 5, probe: 0, region: { xmin: '', xmax: '', ymin: '', ymax: '' } }))],
	props: {
		api: { type: Object, required: true }, // createMachineApi(...)
		published: { type: Object, default: null }, // normalizeRuns of the plugin data `machine`
		canRun: { type: Boolean, default: false }, // technician
		ready: { type: Object, default: null }, // normalizeOverview(...).ready
		axes: { type: Array, default: () => [] }, // move.axes of the DWC model (letter, min, max)
		quality: { type: Object, default: null }, // profile mesh.quality
		canWrite: { type: Boolean, default: false }, // technician: load / clear / save / taper
		now: { type: Number, default: 0 }
	},
	data() {
		return { layoutMode: 'mesh', pe: createPointEdit(), resultSignal: 0, meshes: [], libraryOff: false, grid: null, previous: null, working: false, notice: '', opError: '' }
	},
	computed: {
		bed() {
			return this.bedModel.bed
		},
		// the draft the service is asked to confirm (region + points per axis); its points are used only if they answer THIS draft
		draft() {
			const p = this.form.params
			return this.form.ok ? { region: p.mode === 'region' ? p.region : null, points: p.points, probe: p.probe } : null
		},
		// the draft by CONTENT: `draft` is a new object every time the model updates, and watching it asked the service again and again
		draftKey() {
			return this.draft ? draftKeyOf(this.layoutMode, this.draft) : ''
		},
		serviceMesh() {
			const lay = this.draft ? this.layoutFor(this.draft) : null
			return lay ? lay.mesh : null
		},
		thresholds() {
			return qualityThresholds(this.quality)
		},
		// the points the person chose on the bed (Points mode) imply a regular grid; it replaces the typed counts and region in the run
		derived() {
			const area = meshArea(this.bed, this.bedModel.reach, null)
			return this.pe.mode === 'points' && this.pe.points.length ? gridFromPoints(this.pe.points, { area }) : null
		},
		okDerived() {
			return this.derived && this.derived.ok ? this.derived : null
		},
		form() {
			return probeParams(effectiveInputs(this.rs.inputs, this.okDerived), this.bed)
		},
		compensationOn() {
			return !!this.ready && this.ready.meshActive
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
		// a finished run shows its mesh: the grid comes in the result, or by id
		'rs.result'(result) {
			const found = result && (normalizeGrid(result.grid) || null)
			if (found) { this.setGrid(found); this.resultSignal++ }
			else if (result && result.mesh_id) this.show(result.mesh_id)
			if (result) { this.loadLibrary(); this.refreshLayout() }
		},
		draftKey(k) {
			if (k) this.askDraft(this.draft)
		}
	},
	created() {
		this.loadLibrary()
		this.loadPointSets()
		// the last mesh the service knows is shown at once, when nothing else is
		this.refreshLayout(this.draft || undefined).then(() => {
			const lay = this.bedState.layout
			if (!this.grid && lay && lay.lastMesh) this.setGrid(normalizeGrid(lay.lastMesh))
		})
	},
	methods: {
		begin() {
			if (this.form.ok) this.start(RUN_KINDS.meshProbe, this.form.params)
		},
		async loadLibrary() {
			try {
				this.meshes = await this.api.mesh.list()
				this.libraryOff = false
			} catch (e) {
				this.libraryOff = ['not_implemented', 'service_outdated', 'invalid_args'].indexOf(e && e.code) >= 0
				if (!this.libraryOff) this.opError = this.failText(e)
			}
		},
		// the mesh on show; the one that was on show becomes the "previous" to compare with
		setGrid(grid) {
			if (!grid) return
			if (this.grid && this.grid.id !== grid.id) this.previous = this.grid
			this.grid = grid
		},
		failText(e) {
			return this.t(refusalKey(refusalOf(e))) + (e && e.message ? ' (' + e.message + ')' : '')
		},
		async show(id) {
			this.opError = ''
			try {
				const grid = normalizeGrid(await this.api.mesh.get(id))
				if (grid) { this.setGrid(grid); this.resultSignal++ }
				else this.opError = this.t('mesh.err_grid')
			} catch (e) {
				this.opError = this.failText(e)
			}
		},
		// one write of the compensation: the busy flag, the notice, and a fresh library and overview afterwards
		async write(call, doneKey) {
			this.working = true
			this.notice = ''
			this.opError = ''
			try {
				await call()
				this.notice = this.t(doneKey)
				await this.loadLibrary()
				this.$emit('changed')
			} catch (e) {
				if (!e || e.code !== 'cancelled') this.opError = this.failText(e)
			} finally {
				this.working = false
			}
		},
		load(id) {
			return this.write(() => this.api.mesh.load(id), 'mesh.done_load')
		},
		clear() {
			return this.write(() => this.api.mesh.clear(), 'mesh.done_clear')
		},
		save(name) {
			return this.write(() => this.api.mesh.save(name), 'mesh.done_save')
		},
		taper(height) {
			return this.write(() => this.api.mesh.taper(height), 'mesh.done_taper')
		}
	}
}
</script>
