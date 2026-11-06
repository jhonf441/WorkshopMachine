<template>
	<div class="beds-module">
		<div class="text-h6 mb-1">{{ t('beds.title') }}</div>
		<p class="text-body-2 machine-faint">{{ t('beds.intro') }}</p>
		<role-note v-if="!canWrite" min="technician" class="text-body-2" />
		<v-alert v-if="busy && !applied" dense outlined type="warning" class="text-body-2">{{ t('beds.block_busy') }}</v-alert>
		<error-notice :error="loadError" retry @retry="load()" />

		<div v-if="info" class="text-body-2 mb-3">
			<span v-if="info.defined.length">{{ t('beds.defined_now') }}</span>
			<v-chip v-for="d in info.defined" :key="'d' + d.bed" small label outlined class="ml-1"><v-icon small left>mdi-check-circle-outline</v-icon>{{ d.heater === null ? t('beds.defined_bed', { bed: d.bed }) : t('beds.defined_bed_heater', { bed: d.bed, heater: d.heater }) }}</v-chip>
			<span v-if="!info.defined.length">{{ t('beds.defined_none') }}</span>
			<div v-if="info.inFiles.length" class="machine-faint">{{ t('beds.in_files', { list: info.inFiles.join(', ') }) }}</div>
		</div>

		<v-card v-for="(b, i) in draft.beds" :key="i" outlined class="pa-3 mb-3">
			<div class="d-flex align-center mb-2" style="gap: 8px">
				<span class="text-subtitle-1 font-weight-medium">{{ bedTitle(b) }}</span>
				<v-spacer />
				<v-btn icon small :disabled="!!applied" :aria-label="t('beds.remove_bed')" :title="t('beds.remove_bed')" @click="removeBed(i)"><v-icon small>mdi-delete-outline</v-icon></v-btn>
			</div>
			<div class="beds-grid">
				<div class="beds-field">
					<div class="beds-label"><label :for="'bd-bed-' + i" class="text-caption">{{ t('beds.f_bed') }}</label><help-tip :title="t('beds.f_bed')" :what="t('beds.help.bed_what')" :why="t('beds.help.bed_why')" :if-missing="t('beds.help.bed_missing')" :how="t('beds.help.bed_how')" /></div>
					<v-text-field :id="'bd-bed-' + i" v-model="b.bed" dense outlined hide-details inputmode="numeric" :disabled="!!applied" :error="shown(i, 'bed')" :aria-label="t('beds.f_bed')" />
					<div v-if="shown(i, 'bed')" class="text-caption error--text">{{ message(i, 'bed') }}</div>
				</div>
				<div class="beds-field">
					<div class="beds-label"><label :for="'bd-name-' + i" class="text-caption">{{ t('beds.f_name') }}</label></div>
					<v-text-field :id="'bd-name-' + i" v-model="b.name" dense outlined hide-details :placeholder="t('beds.name_default', { n: (Number(b.bed) || 0) + 1 })" :disabled="!!applied" :error="shown(i, 'name')" :aria-label="t('beds.f_name')" />
					<div v-if="shown(i, 'name')" class="text-caption error--text">{{ message(i, 'name') }}</div>
				</div>
				<div class="beds-field">
					<div class="beds-label"><label :for="'bd-preset-' + i" class="text-caption">{{ t('beds.f_sensor_preset') }}</label></div>
					<v-select :id="'bd-preset-' + i" v-model="b.sensorPreset" :items="presetItems" dense outlined hide-details :disabled="!!applied" :aria-label="t('beds.f_sensor_preset')" />
				</div>
				<div class="beds-field">
					<div class="beds-label"><label :for="'bd-spin-' + i" class="text-caption">{{ t('beds.f_sensor_pin') }}</label><help-tip :title="t('beds.f_pins')" :what="t('beds.help.pins_what')" :why="t('beds.help.pins_why')" :if-missing="t('beds.help.pins_missing')" :how="t('beds.help.pins_how')" /></div>
					<v-select :id="'bd-spin-' + i" v-model="b.sensorPin" :items="pinItems('adc', b.sensorPin)" dense outlined hide-details :placeholder="t('beds.pin_pick')" :no-data-text="t('beds.pin_no_free')" :disabled="!!applied" :error="shown(i, 'sensorPin')" :aria-label="t('beds.f_sensor_pin')" />
					<div v-if="shown(i, 'sensorPin')" class="text-caption error--text">{{ message(i, 'sensorPin') }}</div>
				</div>
				<div class="beds-field">
					<div class="beds-label"><label :for="'bd-kind-' + i" class="text-caption">{{ t('beds.f_output_kind') }}</label></div>
					<v-select :id="'bd-kind-' + i" v-model="b.outputKind" :items="kindItems" dense outlined hide-details :disabled="!!applied" :aria-label="t('beds.f_output_kind')" @change="b.outputPin = ''" />
				</div>
				<div class="beds-field">
					<div class="beds-label"><label :for="'bd-opin-' + i" class="text-caption">{{ t('beds.f_output_pin') }}</label></div>
					<v-select :id="'bd-opin-' + i" v-model="b.outputPin" :items="pinItems(outputNeed(b), b.outputPin)" dense outlined hide-details :placeholder="t('beds.pin_pick')" :no-data-text="t('beds.pin_no_free')" :disabled="!!applied" :error="shown(i, 'outputPin')" :aria-label="t('beds.f_output_pin')" />
					<div v-if="shown(i, 'outputPin')" class="text-caption error--text">{{ message(i, 'outputPin') }}</div>
				</div>
				<div class="beds-field">
					<div class="beds-label"><label :for="'bd-max-' + i" class="text-caption">{{ t('beds.f_max_temp') }}</label><help-tip :title="t('beds.f_max_temp')" :what="t('beds.help.max_what')" :why="t('beds.help.max_why')" :if-missing="t('beds.help.max_missing')" :how="t('beds.help.max_how')" /></div>
					<v-text-field :id="'bd-max-' + i" v-model="b.maxTemp" dense outlined hide-details suffix="°C" inputmode="decimal" :disabled="!!applied" :error="shown(i, 'maxTemp')" :aria-label="t('beds.f_max_temp')" />
					<div v-if="shown(i, 'maxTemp')" class="text-caption error--text">{{ message(i, 'maxTemp') }}</div>
				</div>
			</div>
		</v-card>
		<div v-if="!draft.beds.length" class="text-body-2 machine-faint mb-3">{{ t('beds.empty') }}</div>
		<div class="d-flex align-center flex-wrap mb-4" style="gap: 12px">
			<v-btn small outlined :disabled="!!applied || draft.beds.length >= maxBeds" @click="addBed()"><v-icon small left>mdi-plus</v-icon>{{ t('beds.add_bed') }}</v-btn>
			<span class="text-caption" :class="{ 'warning--text': draft.beds.length >= maxBeds }">{{ draft.beds.length >= maxBeds ? t('beds.beds_limit', { max: maxBeds }) : t('beds.beds_count', { n: draft.beds.length, max: maxBeds }) }}</span>
		</div>

		<div class="text-subtitle-1 font-weight-medium mb-1">{{ t('beds.lines_title') }}</div>
		<div v-if="!ready" class="text-body-2 machine-faint">{{ t('beds.lines_wait') }}</div>
		<div v-else-if="previewLoading" class="text-body-2 machine-faint"><v-progress-circular indeterminate size="16" width="2" class="mr-2" />{{ t('beds.lines_loading') }}</div>
		<error-notice :error="previewError" retry @retry="loadPreview()" />
		<template v-if="ready && preview && !previewLoading">
			<div class="mb-2">
				<span class="text-caption machine-faint mr-1">{{ t('beds.lines_goes_to') }}</span>
				<v-chip v-for="f in preview.files" :key="f" small label outlined class="mr-1"><v-icon small left>mdi-file-document-outline</v-icon>{{ f }}</v-chip>
			</div>
			<div class="beds-code pa-2">
				<div v-for="l in preview.lines" :key="l.n" :class="lineClass(l)" style="white-space: pre">{{ l.text || ' ' }}</div>
			</div>
			<v-alert v-for="(e, i) in preview.errors" :key="'e' + i" dense outlined type="error" class="mt-2 mb-0 text-body-2">{{ t('beds.err_' + e.code) }}</v-alert>
			<v-alert v-if="!preview.errors.length" dense outlined type="success" class="mt-2 mb-0 text-body-2">{{ t('beds.lines_ok') }}</v-alert>
		</template>

		<div class="text-subtitle-1 font-weight-medium mt-4 mb-1">{{ t('beds.plan_title') }}</div>
		<p class="text-body-2 machine-faint">{{ t('beds.plan_note') }}</p>
		<div class="d-flex align-center flex-wrap" style="gap: 8px">
			<v-btn color="primary" :disabled="!canPlan || working || !!applied || ps.status === 'review'" :loading="ps.status === 'planning'" @click="createPlan()">
				<v-icon left>mdi-clipboard-check-outline</v-icon>{{ t('beds.plan_btn') }}
			</v-btn>
			<span v-if="!canPlan && ready" class="text-caption warning--text">{{ t('beds.plan_blocked') }}</span>
		</div>
		<plan-review v-if="ps.status !== 'idle'" class="mt-2" :state="ps" :title="t('beds.plan_review')" :role-ok="canWrite" @apply="applyPlan()" @reset="flow.reset()" />
		<v-alert v-if="applied" dense outlined type="success" class="mt-3 text-body-2">
			<div class="font-weight-medium">{{ t('beds.applied_title') }}</div>
			<div>{{ t('beds.applied_next') }}</div>
			<v-btn small outlined class="mt-2" @click="restart()">{{ t('beds.again') }}</v-btn>
		</v-alert>
	</div>
</template>

<script>
'use strict'

// "Bed heaters" assistant (DWC 3.6, technician): defines the beds a split bed needs (sensor, heater and M140 P H of each zone) in the configuration. The person picks
// the pins from the free ones (never guessed), sees the EXACT lines the service would write and where, and creates a plan: the same plan of every other change of the
// configuration (preview of the diff, backup, history, the machine restarts to read it). The page never sends loose G-code. The service operations are behind api.beds
// (api/machine-api-beds.js); the checks that block are in lib/beds-spec.js and the service enforces them again.

import ErrorNotice from '../ErrorNotice.vue' // vue/_shared
import HelpTip from '../HelpTip.vue' // vue/_shared36
import RoleNote from './RoleNote.vue'
import PlanReview from './PlanReview.vue'
import { textMixin } from './text-mixin.js'
import { createPlanFlow } from '../state/plan-flow.js'
import { isWorking } from '../state/plan-state.js'
import { PRESETS, OUTPUT_KINDS, OUTPUT_NEED, createDraft, emptyBed, toSpec, specKey, pinChoices, bedIssues, formIssues, fieldOfError } from '../lib/beds-spec.js'
import { lineKind } from '../lib/toolwiz-preview.js'

const NO_PINS = { free: [], used: [], freeDrivers: null }

export default {
	mixins: [textMixin],
	components: { ErrorNotice, HelpTip, RoleNote, PlanReview },
	props: {
		api: { type: Object, required: true },
		canWrite: { type: Boolean, default: false }, // technician: creating the plan (the service checks again)
		busy: { type: Boolean, default: false }, // a procedure is running: the machine is not free
		asked: { type: Array, default: null } // the bed numbers another plugin asked for (the 3D printing page: the beds its zones use and the board lacks)
	},
	data() {
		return { draft: createDraft(this.asked), info: null, pins: NO_PINS, loadError: null, tried: false, preview: null, previewLoading: false, previewError: null, applied: null, ps: null, flow: null, timer: null }
	},
	computed: {
		maxBeds() {
			return this.info ? this.info.maxBeds : 8
		},
		definedBeds() {
			return this.info ? this.info.defined.map(d => d.bed).concat(this.info.inFiles) : []
		},
		ctx() {
			return { definedBeds: this.definedBeds, pins: this.pins, canWrite: this.canWrite, busy: this.busy }
		},
		issues() {
			return bedIssues(this.draft, this.ctx)
		},
		ready() {
			return formIssues(this.issues).length === 0
		},
		canPlan() {
			return this.issues.length === 0 && !!this.preview && this.preview.errors.length === 0 && !this.previewLoading
		},
		working() {
			return isWorking(this.ps)
		},
		key() {
			return specKey(this.draft)
		},
		presetItems() {
			return PRESETS.map(p => ({ value: p, text: this.t('beds.preset_' + p) }))
		},
		kindItems() {
			return OUTPUT_KINDS.map(k => ({ value: k, text: this.t('beds.kind_' + k) }))
		}
	},
	watch: {
		// any edit makes the lines and the plan under review stale: they are dropped, never applied by mistake
		key() {
			this.tried = false
			if (!this.applied && this.ps.status !== 'idle') this.flow.reset()
			this.schedulePreview()
		},
		asked(v) {
			if (v && !this.applied) this.draft = createDraft(v, this.firstFree())
		}
	},
	created() {
		this.flow = createPlanFlow({ apply: plan => this.api.beds.apply(plan) })
		this.ps = this.flow.state
		this.load()
	},
	beforeDestroy() {
		clearTimeout(this.timer)
	},
	methods: {
		firstFree() {
			return this.info && this.info.next.beds.length ? this.info.next.beds[0] : null
		},
		async load() {
			try {
				this.info = await this.api.beds.get()
				this.pins = await this.api.beds.pins()
				this.loadError = null
				if (!this.asked && this.draft.beds.length === 1 && this.draft.beds[0].bed === '' && this.firstFree() !== null) this.draft.beds[0].bed = String(this.firstFree())
			} catch (e) {
				this.loadError = e
			}
		},
		outputNeed(b) {
			return OUTPUT_NEED[b.outputKind] || 'pwm'
		},
		pinItems(need, current) {
			return pinChoices(this.pins, need, this.draft, current).map(p => ({ value: p.pin, text: p.pin + ' - ' + p.capabilities.join('/') }))
		},
		// the message of a field of one bed (the person sees it once they try to continue, or once the service refuses it)
		issueOf(i, key) {
			const field = 'beds.' + i + '.' + key
			return this.issues.find(x => x.field === field) || (this.preview && this.preview.errors.map(e => ({ field: fieldOfError(e), code: e.code })).find(x => x.field === field)) || null
		},
		shown(i, key) {
			const it = this.issueOf(i, key)
			return !!it && (this.tried || !(it.code === 'bed_missing' || it.code === 'pin_missing'))
		},
		message(i, key) {
			const it = this.issueOf(i, key)
			return it ? this.t('beds.err_' + it.code, it.params) : ''
		},
		lineClass(l) {
			return { 'machine-faint': l.kind === 'comment', 'success--text font-weight-bold': l.kind === 'safety', 'warning--text': l.kind === 'heater' }
		},
		addBed() {
			const used = this.draft.beds.map(b => Number(b.bed)).concat(this.definedBeds)
			const free = this.info ? this.info.next.beds.find(n => used.indexOf(n) < 0) : null
			this.draft.beds.push(emptyBed(free === undefined ? null : free))
		},
		bedTitle(b) {
			const n = String(b.bed === null || b.bed === undefined ? '' : b.bed).trim()
			return n !== '' && /^\d+$/.test(n) ? this.t('beds.bed_n', { n }) : this.t('beds.bed_new')
		},
		removeBed(i) {
			this.draft.beds.splice(i, 1)
		},
		schedulePreview() {
			clearTimeout(this.timer)
			this.preview = null
			if (this.applied || !this.ready) return
			this.timer = setTimeout(() => this.loadPreview(), 350)
		},
		async loadPreview() {
			this.previewLoading = true
			this.previewError = null
			try {
				const data = await this.api.beds.preview(toSpec(this.draft))
				this.preview = Object.assign({}, data, { lines: data.lines.map(l => (l.kind ? l : { n: l.n, text: l.text, kind: lineKind(l.text) })) })
			} catch (e) {
				this.previewError = e
			} finally {
				this.previewLoading = false
			}
		},
		createPlan() {
			this.tried = true
			if (!this.canPlan) return null
			return this.flow.propose(async () => ({ plan: await this.api.beds.plan(toSpec(this.draft)), conflict: null }))
		},
		async applyPlan() {
			await this.flow.apply(this.canWrite)
			if (this.ps.status === 'done') this.applied = this.ps.result || {}
		},
		restart() {
			this.applied = null
			this.draft = createDraft(null, this.firstFree())
			this.flow.reset()
			this.load()
		}
	}
}
</script>

<style scoped>
.beds-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 12px; }
.beds-field { min-width: 0; display: flex; flex-direction: column; }
.beds-label { display: flex; align-items: center; gap: 4px; min-height: 28px; }
.beds-code { font-family: var(--tp-font-mono, monospace); font-size: 13px; overflow-x: auto; border: 1px solid var(--wf-line, rgba(128, 128, 128, 0.4)); border-radius: 8px; }
</style>
