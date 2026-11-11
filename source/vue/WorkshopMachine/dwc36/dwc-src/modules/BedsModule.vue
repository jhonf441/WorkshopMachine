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
		<v-card v-for="d in definedList" :key="'dc' + d.bed" outlined class="pa-3 mb-3 beds-defined" :data-bed="d.bed">
			<div class="d-flex align-center" style="gap: 8px">
				<v-icon small>mdi-check-circle-outline</v-icon>
				<span class="text-subtitle-1 font-weight-medium">{{ t('beds.bed_n', { n: d.bed }) }}</span>
				<v-chip v-if="!d.loaded" x-small label outlined color="warning">{{ t('beds.defined_unloaded') }}</v-chip>
			</div>
			<div class="text-body-2 machine-faint mt-1">
				<span v-if="d.heater !== null">{{ t('beds.d_heater', { heater: d.heater }) }}</span>
				<span v-if="d.sensor !== null"> · {{ d.sensorName ? t('beds.d_sensor_named', { sensor: d.sensor, name: d.sensorName }) : t('beds.d_sensor', { sensor: d.sensor }) }}</span>
				<span v-if="d.max !== null"> · {{ t('beds.d_max', { max: d.max }) }}</span>
				<span v-if="d.state"> · {{ d.state }}</span>
			</div>
			<bed-edit-card v-if="d.loaded" class="mt-2" :api="api" :row="d" :can-write="canWrite" :busy="busy" :model="model" :zones="definedList" @applied="load()" />
		</v-card>

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
					<div class="beds-label"><label :for="'bd-preset-' + i" class="text-caption">{{ t('beds.f_sensor_preset') }}</label><help-tip :title="t('beds.preset_' + b.sensorPreset)" :what="t('beds.help.sensor_' + b.sensorPreset + '_what')" :why="t('beds.help.sensor_' + b.sensorPreset + '_why')" :if-missing="t('beds.help.sensor_' + b.sensorPreset + '_missing')" :how="t('beds.help.sensor_' + b.sensorPreset + '_how')" /></div>
					<v-select :id="'bd-preset-' + i" v-model="b.sensorPreset" :items="presetItems" dense outlined hide-details :disabled="!!applied" :aria-label="t('beds.f_sensor_preset')" @change="presetChanged(b, $event)" />
				</div>
				<bed-sensor-fields :bed="b" :index="i" :disabled="!!applied" :shown="shown" :message="message" />
				<div class="beds-field">
					<div class="beds-label"><label :for="'bd-spin-' + i" class="text-caption">{{ t('beds.f_sensor_pin') }}</label><help-tip :title="t('beds.f_pins')" :what="t('beds.help.pins_what')" :why="t('beds.help.pins_why')" :if-missing="t('beds.help.pins_missing')" :how="t('beds.help.pins_how')" /></div>
					<v-select :id="'bd-spin-' + i" v-model="b.sensorPin" :items="pinItems(sensorNeed(b.sensorPreset), b.sensorPin)" dense outlined hide-details :placeholder="t('beds.pin_pick')" :no-data-text="t('beds.pin_no_free')" :disabled="!!applied" :error="shown(i, 'sensorPin')" :aria-label="t('beds.f_sensor_pin')" />
					<div v-if="shown(i, 'sensorPin')" class="text-caption error--text">{{ message(i, 'sensorPin') }}</div>
				</div>
				<!-- the output pin comes first: the page deduces from it whether the heater hangs from a MOSFET of the board (no relay, nothing to ask) or needs a relay -->
				<div class="beds-field">
					<div class="beds-label"><label :for="'bd-opin-' + i" class="text-caption">{{ t('beds.f_output_pin') }}</label><help-tip :title="t('beds.f_output_pin')" :what="t('beds.help.output_what')" :why="t('beds.help.output_why')" :if-missing="t('beds.help.output_missing')" :how="t('beds.help.output_how')" /></div>
					<v-select :id="'bd-opin-' + i" v-model="b.outputPin" :items="outputItems(b)" dense outlined hide-details :placeholder="t('beds.pin_pick')" :no-data-text="t('beds.pin_no_free')" :disabled="!!applied" :error="shown(i, 'outputPin')" :aria-label="t('beds.f_output_pin')" @change="outputPinChanged(b, $event)" />
					<div v-if="shown(i, 'outputPin')" class="text-caption error--text">{{ message(i, 'outputPin') }}</div>
				</div>
				<div class="beds-field">
					<div class="beds-label"><label :for="'bd-kind-' + i" class="text-caption">{{ t('beds.f_output_kind') }}</label><help-tip :title="t('beds.f_output_kind')" :what="t('beds.help.kind_what')" :why="t('beds.help.kind_why')" :if-missing="t('beds.help.kind_missing')" :how="t('beds.help.kind_how')" /></div>
					<div v-if="isDirect(b)" :id="'bd-kind-' + i" class="text-body-2 beds-direct" data-direct="1">{{ t('beds.kind_direct_note', directParams(b)) }}</div>
					<v-select v-else :id="'bd-kind-' + i" v-model="b.outputKind" :items="relayItems" dense outlined hide-details :disabled="!!applied" :error="shown(i, 'outputKind')" :aria-label="t('beds.f_output_kind')" />
					<div v-if="shown(i, 'outputKind')" class="text-caption error--text">{{ message(i, 'outputKind') }}</div>
				</div>
				<div class="beds-field">
					<div class="beds-label"><label :for="'bd-max-' + i" class="text-caption">{{ t('beds.f_max_temp') }}</label><help-tip :title="t('beds.f_max_temp')" :what="t('beds.help.max_what')" :why="t('beds.help.max_why')" :if-missing="t('beds.help.max_missing')" :how="t('beds.help.max_how')" /></div>
					<v-text-field :id="'bd-max-' + i" v-model="b.maxTemp" dense outlined hide-details suffix="°C" inputmode="decimal" :disabled="!!applied" :error="shown(i, 'maxTemp')" :aria-label="t('beds.f_max_temp')" />
					<div v-if="shown(i, 'maxTemp')" class="text-caption error--text">{{ message(i, 'maxTemp') }}</div>
				</div>
			</div>
		</v-card>
		<div v-if="!draft.beds.length" class="text-body-2 machine-faint mb-3">{{ t('beds.empty') }}</div>
		<!-- no bed or heater MOSFET of the board is free any more: said once, with who has them (the 18 A one first), so a relay is no surprise -->
		<div v-if="draft.beds.length && directNote" class="wf-note is-info mb-3 beds-direct-none" role="note"><v-icon :size="16" class="wf-note-icon" aria-hidden="true">mdi-information-outline</v-icon><span>{{ directNote }}</span></div>
		<div class="d-flex align-center flex-wrap mb-4" style="gap: 12px">
			<v-btn small outlined :disabled="!!applied || roomLeft <= 0" @click="addBed()"><v-icon small left>mdi-plus</v-icon>{{ t('beds.add_bed') }}</v-btn>
			<!-- the limit says where it comes from (the board, the service's read of it, or the RRF ceiling); the "?" tells how the count is made -->
			<span class="d-inline-flex align-center" style="gap: 2px">
				<span class="text-caption beds-count" :class="{ 'warning--text': roomLeft <= 0 }">{{ roomLeft <= 0 ? t('beds.beds_limit', { max: maxBeds }) : t('beds.beds_count', { n: definedCount + draft.beds.length, max: maxBeds }) }} · {{ t('beds.limit_src_' + limitSource) }}</span>
				<help-tip :title="t('beds.limit_title')" :what="t('beds.limit_' + limitSource, { max: maxBeds })" :why="t('beds.limit_why')" :how="t('beds.limit_count', { defined: definedCount, draft: draft.beds.length })" />
			</span>
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
import BedSensorFields from './BedSensorFields.vue'
import BedEditCard from './BedEditCard.vue'
import { textMixin } from './text-mixin.js'
import { createPlanFlow } from '../state/plan-flow.js'
import { isWorking } from '../state/plan-state.js'
import { PRESET_GROUPS, OUTPUT_LIST_NEED, MAX_BED, sensorNeed, boardLimits, definedRows, dropDefined, createDraft, emptyBed, toSpec, specKey, pinChoices, bedIssues, formIssues, fieldOfError } from '../lib/beds-spec.js'
import { KIND_DIRECT, RELAY_KINDS, kindForPin, outputOptionKey, outputRole, directFree, directTaken, serviceKindError } from '../lib/bed-output.js'
import { lineKind } from '../lib/toolwiz-preview.js'
import { pinOptionText, pinKindKey } from '../lib/pin-kinds.js'

const NO_PINS = { free: [], used: [], freeDrivers: null }

export default {
	mixins: [textMixin],
	components: { ErrorNotice, HelpTip, RoleNote, PlanReview, BedEditCard, BedSensorFields },
	props: {
		api: { type: Object, required: true },
		canWrite: { type: Boolean, default: false }, // technician: creating the plan (the service checks again)
		busy: { type: Boolean, default: false }, // a procedure is running: the machine is not free
		model: { type: Object, default: null }, // the live object model (limits.bedHeaters, heat.heaters): what the board supports and what each defined bed is
		asked: { type: Array, default: null } // the bed numbers another plugin asked for (the 3D printing page: the beds its zones use and the board lacks)
	},
	data() {
		return { draft: createDraft(this.asked), info: null, pins: NO_PINS, loadError: null, tried: false, preview: null, previewLoading: false, previewError: null, applied: null, ps: null, flow: null, timer: null }
	},
	computed: {
		// how many beds THIS board supports: its own limit (object model limits.bedHeaters), else what the service read from it, else the highest number RRF allows
		maxBeds() {
			return boardLimits(this.model).beds || (this.info && this.info.maxBeds) || MAX_BED + 1
		},
		// where that number comes from, so the page can say it: the live object model of the board, the service's read of it, or the RRF ceiling (nobody said)
		limitSource() {
			return boardLimits(this.model).beds ? 'board' : this.info && this.info.maxBeds ? 'service' : 'ceiling'
		},
		// no bed / heater MOSFET of the board is free: the note says who has them, with the current each one carries
		directNote() {
			if (directFree(this.pins).length) return ''
			const taken = directTaken(this.pins)
			return taken.length ? this.t('beds.direct_none', { list: taken.map(x => this.t('beds.direct_taken_item', { pin: x.pin, amps: x.amps, by: x.by })).join(', ') }) : ''
		},
		definedCount() {
			return this.definedBeds.filter((n, i, a) => a.indexOf(n) === i).length
		},
		// the beds the board has or the files define, with their details: shown in their own cards, never reduced to an error on a new row
		definedList() {
			return this.info ? definedRows(this.info, this.model) : []
		},
		roomLeft() {
			return Math.max(0, this.maxBeds - this.definedCount - this.draft.beds.length)
		},
		definedBeds() {
			return this.info ? this.info.defined.map(d => d.bed).concat(this.info.inFiles) : []
		},
		ctx() {
			return { definedBeds: this.definedBeds, pins: this.pins, canWrite: this.canWrite, busy: this.busy, maxBeds: this.maxBeds }
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
		// the sensor types grouped (a header and its options: thermistors, platinum RTD, thermocouples, other)
		presetItems() {
			const out = []
			PRESET_GROUPS.forEach(g => {
				out.push({ header: this.t('beds.group_' + g.id) })
				g.presets.forEach(p => out.push({ value: p, text: this.t('beds.preset_' + p) }))
			})
			return out
		},
		// the relay kinds: only asked when the pin is no MOSFET of the board (a MOSFET output is direct, nothing to choose)
		relayItems() {
			return RELAY_KINDS.map(k => ({ value: k, text: this.t('beds.kind_' + k) }))
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
			if (v && !this.applied) this.draft = this.seed(v)
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
		// the rows of the form for the beds asked: the ones the board already has are not new rows (they have their own card above)
		seed(beds) {
			const d = dropDefined(createDraft(beds, this.firstFree()), this.definedBeds)
			return d
		},
		firstFree() {
			return this.info && this.info.next.beds.length ? this.info.next.beds[0] : null
		},
		async load() {
			try {
				this.info = await this.api.beds.get()
				this.pins = await this.api.beds.pins()
				this.loadError = null
				if (this.asked && !this.applied) this.draft = this.seed(this.asked)
				if (!this.asked && this.draft.beds.length === 1 && this.draft.beds[0].bed === '' && this.firstFree() !== null) this.draft.beds[0].bed = String(this.firstFree())
			} catch (e) {
				this.loadError = e
			}
		},
		sensorNeed,
		pinItems(need, current) {
			return pinChoices(this.pins, need, this.draft, current).map(p => ({ value: p.pin, text: pinOptionText(p.pin, p.capabilities, key => this.t(key)) }))
		},
		// every free output of the board, each saying what it can drive ("out1 - heater MOSFET of the board, up to 6 A"; "io1.out - logic output: needs a relay")
		outputItems(b) {
			return pinChoices(this.pins, OUTPUT_LIST_NEED, this.draft, b.outputPin).map(p => {
				const o = outputOptionKey(p.pin, pinKindKey(p.capabilities))
				return { value: p.pin, text: o.key ? p.pin + ' - ' + this.t(o.key, o.params) : p.pin }
			})
		},
		// the pin decides: a bed / heater MOSFET is direct (the relay question disappears), any other pin keeps or takes a relay kind
		outputPinChanged(b, pin) {
			b.outputKind = kindForPin(pin, b.outputKind)
		},
		isDirect(b) {
			return b.outputKind === KIND_DIRECT
		},
		directParams(b) {
			return { pin: b.outputPin, amps: outputRole(b.outputPin).amps }
		},
		// a new sensor type that needs another kind of pin (a temperature input -> a SPI chip select) drops the pin that no longer fits; one that still fits stays
		presetChanged(b, preset) {
			const pin = this.pins.free.find(p => p.pin === String(b.sensorPin || '').replace(/^[!^]+/, ''))
			if (!pin || pin.capabilities.indexOf(sensorNeed(preset)) < 0) b.sensorPin = ''
		},
		// the message of a field of one bed (the person sees it once they try to continue, or once the service refuses it)
		issueOf(i, key) {
			const field = 'beds.' + i + '.' + key
			const kind = this.draft.beds[i] ? this.draft.beds[i].outputKind : ''
			// an older service answers `values` for the direct output it does not know: said as that, not as a vague bad value
			return this.issues.find(x => x.field === field) || (this.preview && this.preview.errors.map(e => ({ field: fieldOfError(e), code: fieldOfError(e) === field && key === 'outputKind' ? serviceKindError(e.code, kind) : e.code })).find(x => x.field === field)) || null
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
.beds-direct { min-height: 40px; display: flex; align-items: center; padding: 0 12px; border: 1px dashed var(--wf-line, rgba(128, 128, 128, 0.4)); border-radius: 4px; }
.beds-code { font-family: var(--tp-font-mono, monospace); font-size: 13px; overflow-x: auto; border: 1px solid var(--wf-line, rgba(128, 128, 128, 0.4)); border-radius: 8px; }
</style>
