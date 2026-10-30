<template>
	<div class="height-module">
		<div class="text-h6 mb-1">{{ t('height.title') }}</div>
		<p class="text-body-2 machine-faint">{{ t('height.intro') }}</p>
		<error-notice :error="loadError" retry @retry="load()" />
		<v-alert v-if="!canWrite" dense outlined type="info" class="mb-3">{{ t('height.read_only') }}</v-alert>
		<template v-if="h">
			<v-alert v-if="missing.length" dense outlined type="warning" class="mb-3">
				<div>{{ t('height.hook_missing', { files: missing.join(', ') }) }}</div>
				<v-btn v-if="canWrite" small color="primary" class="mt-2" :disabled="busy" :title="t('height.hook_tip')" @click="installHook()">{{ t('height.hook_apply') }}</v-btn>
			</v-alert>
			<v-btn-toggle v-model="mode" mandatory dense class="mb-3">
				<v-btn v-for="m in MODES" :key="m" :value="m" small>{{ m }}<v-icon v-if="m === h.mode" x-small right>mdi-circle-medium</v-icon></v-btn>
			</v-btn-toggle>
			<v-card outlined class="mb-3">
				<v-card-text>
					<div class="text-subtitle-2 mb-1">{{ t('height.card_title', { mode }) }}</div>
					<v-alert v-if="!view.current" dense outlined type="info" class="mb-2 text-caption">{{ t('height.not_current', { mode }) }}</v-alert>
					<div class="d-flex align-center flex-wrap mb-1" style="gap:8px">
						<span class="text-body-2">{{ t('height.how') }}</span>
						<v-btn-toggle :value="view.data.method" dense mandatory @change="setMethod">
							<v-btn v-for="m in view.methods" :key="m" :value="m" small :disabled="!canWrite || busy">{{ t('height.method_' + m) }}</v-btn>
						</v-btn-toggle>
					</div>
					<div class="text-caption machine-faint mb-2">{{ t('height.note_' + view.data.method) }}</div>
					<template v-if="view.data.method === 'bltouch'">
						<div class="d-flex align-center flex-wrap mb-2" style="gap:8px">
							<span class="text-body-2">{{ t('height.trigger', { mode }) }}</span>
							<b>{{ triggerText }}</b>
							<v-chip x-small label :color="view.data.k0 ? 'success' : 'info'" outlined>{{ view.data.k0 ? t('height.calibrated', { date: view.data.k0.date }) : t('height.from_mode_file') }}</v-chip>
							<v-btn small outlined :disabled="!canWrite || busy || !!block('k0') || !!wiz" :title="blockText('k0')" @click="start('k0')">{{ t('height.calibrate_bltouch') }}</v-btn>
						</div>
						<div v-if="blockText('k0')" class="height-block mb-2"><v-icon x-small color="warning" class="mr-1">mdi-information-outline</v-icon>{{ blockText('k0') }}</div>
						<div class="d-flex align-center flex-wrap mb-2" style="gap:8px">
							<span class="text-body-2">{{ t('height.adjust') }}</span>
							<v-text-field v-model="adjust" type="number" step="0.01" dense outlined hide-details class="height-field" :disabled="!canWrite" :error="!!adjustError" />
							<span class="machine-faint">mm</span>
							<v-btn v-for="n in nudges" :key="n" small outlined :disabled="!canWrite" style="min-width:56px;min-height:44px" @click="adjust = nudge(adjust, n)">{{ (n > 0 ? '+' : '') + n }}</v-btn>
							<v-btn small color="primary" :disabled="!canWrite || busy" @click="saveAdjust()">{{ t('height.save') }}</v-btn>
						</div>
						<div class="text-caption machine-faint">{{ adjustError ? t(adjustError) : t('height.adjust_tip') }}</div>
					</template>
					<template v-else-if="view.data.method === 'paper'">
						<v-btn small color="primary" :disabled="!canWrite || busy || !!block('paper') || !!wiz" @click="start('paper')">{{ t('height.measure_paper') }}</v-btn>
						<div v-if="blockText('paper')" class="height-block mt-1"><v-icon x-small color="warning" class="mr-1">mdi-information-outline</v-icon>{{ blockText('paper') }}</div>
					</template>
					<height-szp
						v-else :view="view" :can-write="canWrite" :busy="busy" :block="blockText('szp')" :out="szpOut" :sr="szpSR"
						@run="runSzp" @save="saveSzp"
					/>
					<div v-if="view.data.method !== 'szp'" class="d-flex align-center flex-wrap mt-3" style="gap:8px">
						<span class="text-body-2">{{ t('height.paper_thickness') }}</span>
						<v-text-field v-model="paperText" type="number" step="0.01" dense outlined hide-details class="height-field" :disabled="!canWrite" :error="!!paperError" @change="savePaper()" />
						<span class="text-caption machine-faint">{{ paperError ? t(paperError) : t('height.paper_tip') }}</span>
					</div>
				</v-card-text>
			</v-card>
			<v-card v-if="wiz" outlined class="mb-3">
				<v-card-text>
					<height-wizard
						:key="wiz" :api="api" :kind="wiz" :view="view" :reach="h.reach" :z="h.z" :point="point" :paper="h.data.paper"
						@moved="refreshQuiet()" @save-k0="saveK0" @marked="notice = t('height.paper_marked')" @close="wiz = ''"
					/>
				</v-card-text>
			</v-card>
		</template>
		<div v-if="notice" class="text-body-2 success--text">{{ notice }}</div>
		<div v-if="opError" class="text-body-2 error--text">{{ opError }}</div>
	</div>
</template>

<script>
'use strict'

// Height calibration of the tool (it was a card of the Workbench, Zones > Active zone): how the height is measured in each mode, the trigger
// height of the BLTouch (calibrated with the paper), the fine adjustment, the thickness of the paper and the SZP of FFF. The service keeps the data
// (machine.height.*: the saved file with revision, zcal.g, the hooks of the mode files and the movements of the assistants); this draws it.

import ErrorNotice from '../ErrorNotice.vue' // vue/_shared
import HeightWizard from './HeightWizard.vue'
import HeightSzp from './HeightSzp.vue'
import { textMixin } from './text-mixin.js'
import { HEIGHT_MODES } from '../api/machine-api-p8.js'
import { modeView, blockReason, defaultPoint, askedPoint, parseAdjust, parsePaper, nudged, changeOf, hookMissing, szpRecord, parseSzpOutput, NUDGE, ASK_KEY, todayText } from '../lib/height.js'

function takeAsked() {
	try {
		const text = localStorage.getItem(ASK_KEY)
		if (text) localStorage.removeItem(ASK_KEY)
		return askedPoint(text)
	} catch (e) {
		return null
	}
}

export default {
	components: { ErrorNotice, HeightWizard, HeightSzp },
	mixins: [textMixin],
	props: {
		api: { type: Object, required: true }, // createMachineApi(...)
		canWrite: { type: Boolean, default: false } // technician
	},
	data() {
		return {
			h: null, loadError: null, mode: 'Laser', MODES: HEIGHT_MODES, busy: false, notice: '', opError: '', wiz: '', point: { x: 0, y: 0 }, asked: takeAsked(),
			adjust: '0', paperText: '0.1', szpOut: '', szpSR: null, nudges: [-NUDGE, NUDGE]
		}
	},
	computed: {
		view() {
			return modeView(this.h, this.mode)
		},
		missing() {
			return hookMissing(this.h)
		},
		adjustError() {
			const r = parseAdjust(this.adjust)
			return r.ok ? '' : r.errorKey
		},
		paperError() {
			const r = parsePaper(this.paperText)
			return r.ok ? '' : r.errorKey
		},
		triggerText() {
			const p = this.view.probe
			return p && p.triggerHeight !== null ? p.triggerHeight + ' mm' : '--'
		}
	},
	watch: {
		mode() {
			this.wiz = ''
			this.syncDrafts()
		}
	},
	created() {
		this.load(true)
	},
	methods: {
		nudge: nudged,
		async load(first) {
			try {
				this.h = await this.api.height.get()
				this.loadError = null
				if (first) {
					this.mode = this.h.mode || 'Laser'
					this.point = defaultPoint(this.h, this.asked)
				}
				this.syncDrafts()
			} catch (e) {
				this.loadError = e
			}
		},
		// the reading of Z while the person jogs: only the numbers of the machine, never the drafts
		async refreshQuiet() {
			try {
				const keep = this.h
				const fresh = await this.api.height.get()
				this.h = Object.assign({}, keep, { z: fresh.z, probes: fresh.probes, homed: fresh.homed })
			} catch (e) {
				/* the next step says what failed */
			}
		},
		syncDrafts() {
			this.adjust = String(this.view.data.setting)
			this.paperText = String(this.h ? this.h.data.paper : 0.1)
		},
		block(kind) {
			return blockReason(this.h, this.view, kind)
		},
		blockText(kind) {
			const r = this.block(kind)
			return r ? this.t('height.block_' + r, { mode: this.mode }) : ''
		},
		start(kind) {
			this.notice = ''
			this.opError = ''
			this.wiz = kind
		},
		// every change goes through the revision it was based on; a conflict reloads and says so
		async save(changes, okText) {
			this.busy = true
			this.opError = ''
			try {
				const r = await this.api.height.save(this.h.rev, changes)
				this.h = Object.assign({}, this.h, { rev: r.rev, data: r.data, hooks: r.hooks, applied: r.applied })
				this.notice = okText + (r.applied ? '' : ' ' + this.t('height.not_applied_now'))
				this.syncDrafts()
				return true
			} catch (e) {
				if (e && e.code === 'conflict') {
					this.opError = this.t('height.conflict')
					await this.load()
				} else {
					this.opError = String((e && e.message) || e)
				}
				return false
			} finally {
				this.busy = false
			}
		},
		setMethod(m) {
			if (m && m !== this.view.data.method) this.save(changeOf(this.mode, { method: m }), this.t('height.saved_method', { mode: this.mode, method: this.t('height.method_' + m) }))
		},
		saveAdjust() {
			const r = parseAdjust(this.adjust)
			if (r.ok) this.save(changeOf(this.mode, { setting: r.value }), this.t('height.saved_adjust', { mode: this.mode, a: r.value }))
		},
		savePaper() {
			const r = parsePaper(this.paperText)
			if (r.ok) this.save({ paper: r.value }, this.t('height.saved_paper', { paper: r.value }))
		},
		async saveK0(record) {
			if (await this.save(changeOf(this.mode, { k0: record }), this.t('height.saved_k0', { mode: this.mode, med: record.z }))) this.wiz = ''
		},
		async runSzp(a) {
			this.szpOut = ''
			this.opError = ''
			this.busy = true
			try {
				const r = await this.api.height.step('szp', { x: this.point.x, y: this.point.y, a })
				this.szpOut = r.output
				if (a === 1) this.szpSR = parseSzpOutput(r.output)
			} catch (e) {
				this.opError = String((e && e.message) || e)
			} finally {
				this.busy = false
			}
		},
		saveSzp({ s, r }) {
			const rec = szpRecord(s, r, todayText())
			if (!rec) {
				this.opError = this.t('height.err_szp')
				return
			}
			this.save(changeOf('FFF', { szp: rec }), this.t('height.saved_szp', { s: rec.s, r: rec.r }))
		},
		async installHook() {
			this.busy = true
			try {
				const r = await this.api.height.hook()
				this.notice = this.t('height.hook_done', { files: r.added.join(', ') || '-' })
				this.h = Object.assign({}, this.h, { hooks: r.hooks, applied: true })
			} catch (e) {
				this.opError = String((e && e.message) || e)
			} finally {
				this.busy = false
			}
		}
	}
}
</script>

<style>
.height-module .height-field { max-width: 110px; }
/* why an assistant cannot start now: next to the button, readable (the disabled button alone does not say it) */
.height-module .height-block { font-size: 12px; line-height: 1.4; color: #ffb74d; }
.theme--light .height-module .height-block { color: #b26a00; }
</style>
