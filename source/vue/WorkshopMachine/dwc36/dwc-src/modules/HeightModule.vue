<template>
	<div class="height-module">
		<card-head icon="mdi-arrow-collapse-down" :title="t('height.title')" />
		<section-notice :error="loadError" retry @retry="load()" />
		<role-note v-if="!canWrite" min="technician" :ops="accessOps.height" class="mb-3" :subject="$t('plugins.WorkshopMachine.subjects.height')" />
		<template v-if="h">
			<v-alert v-if="missing.length" dense outlined type="warning" class="mb-3">
				<div>{{ t('height.hook_missing', { files: missing.join(', ') }) }}</div>
				<wf-action-button v-if="canWrite" :action="hookAct" main class="mt-2" :label="t('height.hook_apply')" :disabled="busy" @run="hookAct.run({})" />
				<div v-if="canWrite" class="text-caption mt-1">{{ t('height.hook_tip') }}</div>
			</v-alert>
			<v-btn-toggle v-model="mode" mandatory dense class="mb-3">
				<v-btn v-for="m in MODES" :key="m" :value="m" small>{{ m }}<v-icon v-if="m === h.mode" x-small right>mdi-circle-medium</v-icon></v-btn>
			</v-btn-toggle>
			<div class="wf-group mb-3">
				<div>
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
							<v-btn v-for="n in nudges" :key="n" small outlined :disabled="!canWrite" style="min-width:48px" @click="adjust = nudge(adjust, n)">{{ (n > 0 ? '+' : '') + n }}</v-btn>
							<wf-action-button :action="saveAct" main :label="t('height.save')" :disabled="!canWrite || busy" @run="saveAdjust()" />
						</div>
						<div class="text-caption machine-faint">{{ adjustError ? t(adjustError) : t('height.adjust_tip') }}</div>
					</template>
					<template v-else-if="view.data.method === 'paper'">
						<v-btn small color="primary" :disabled="!canWrite || busy || !!block('paper') || !!wiz" @click="start('paper')">{{ t('height.measure_paper') }}</v-btn>
						<div v-if="blockText('paper')" class="height-block mt-1"><v-icon x-small color="warning" class="mr-1">mdi-information-outline</v-icon>{{ blockText('paper') }}</div>
					</template>
					<height-szp
						v-else :view="view" :can-write="canWrite" :busy="busy" :action="saveAct" :block="blockText('szp')" :out="szpOut" :sr="szpSR"
						@run="runSzp" @save="saveSzp"
					/>
					<div v-if="view.data.method !== 'szp'" class="d-flex align-center flex-wrap mt-3" style="gap:8px">
						<span class="text-body-2">{{ t('height.paper_thickness') }}</span>
						<v-text-field v-model="paperText" type="number" step="0.01" dense outlined hide-details class="height-field" :disabled="!canWrite" :error="!!paperError" @change="savePaper()" />
						<span class="text-caption machine-faint">{{ paperError ? t(paperError) : t('height.paper_tip') }}</span>
					</div>
				</div>
			</div>
			<div v-if="wiz" class="wf-group mb-3">
				<div>
					<height-wizard
						:key="wiz" :api="api" :action="saveAct" :kind="wiz" :view="view" :reach="h.reach" :z="h.z" :point="point" :paper="h.data.paper"
						@moved="refreshQuiet()" @save-k0="saveK0" @marked="notice = t('height.paper_marked')" @close="wiz = ''"
					/>
				</div>
			</div>
		</template>
		<!-- the saves and the hook: the family line of each write; notice / opError are the wizard's and the SZP run's own lines -->
		<wf-result :action="saveAct" :retry="false" />
		<wf-result :action="hookAct" :retry="false" />
		<div v-if="notice" class="text-body-2 success--text">{{ notice }}</div>
		<div v-if="opError" class="text-body-2 error--text">{{ opError }}</div>
		<help-fold :title="t('height.title')" class="mt-4">{{ t('height.intro') }}</help-fold>
	</div>
</template>

<script>
'use strict'

// Height calibration of the tool (it was a card of the Workbench, Zones > Active zone): how the height is measured in each mode, the trigger
// height of the BLTouch (calibrated with the paper), the fine adjustment, the thickness of the paper and the SZP of FFF. The service keeps the data
// (machine.height.*: the saved file with revision, zcal.g, the hooks of the mode files and the movements of the assistants); this draws it.

import SectionNotice from './SectionNotice.vue' // one notice per cause
import HeightWizard from './HeightWizard.vue'
import HeightSzp from './HeightSzp.vue'
import { textMixin } from './text-mixin.js'
import { messageOf } from '../lib/refusal.js'
import { HEIGHT_MODES } from '../api/machine-api-p8.js'
import { modeView, blockReason, defaultPoint, parseAdjust, parsePaper, nudged, changeOf, hookMissing, szpRecord, parseSzpOutput, NUDGE, todayText } from '../lib/height.js'
import RoleNote from './RoleNote.vue'
import WfActionButton from '../WfActionButton.vue' // vue/_shared36
import WfResult from '../WfResult.vue' // vue/_shared36
import { createAction } from '../workshop-action.js' // vue/_shared36
import CardHead from '../CardHead.vue' // vue/_shared36
import HelpFold from '../HelpFold.vue' // vue/_shared36

export default {
	components: { CardHead, HelpFold, WfActionButton, WfResult, RoleNote, SectionNotice, HeightWizard, HeightSzp },
	mixins: [textMixin],
	props: {
		api: { type: Object, required: true }, // createMachineApi(...)
		canWrite: { type: Boolean, default: false }, // technician
		asked: { type: Object, default: null } // {x, y} the Workbench asked for in the route query (the Z point of its active zone), or null
	},
	data() {
		return {
			h: null, loadError: null, mode: 'Laser', MODES: HEIGHT_MODES, busy: false, notice: '', opError: '', wiz: '', point: { x: 0, y: 0 },
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
		// the saves of the page (every change goes through one) and the install of the hook are writes of the family
		this.saveAct = createAction({ run: args => this.doSave(args) })
		this.hookAct = createAction({ run: () => this.doHook() })
		this.load(true)
	},
	beforeDestroy() {
		this.saveAct.dispose()
		this.hookAct.dispose()
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
			return r ? this.tx('height.block_' + r, { mode: this.mode }) : ''
		},
		start(kind) {
			this.notice = ''
			this.opError = ''
			this.wiz = kind
		},
		// every change goes through the revision it was based on; a conflict reloads and says so
		// (a write of the family: saveAct; this answers whether it was saved, the way the callers always read it)
		async save(changes, okText) {
			this.notice = ''
			this.opError = ''
			await this.saveAct.run({ changes, okText })
			return this.saveAct.state === 'done'
		},
		async doSave({ changes, okText }) {
			this.busy = true
			try {
				const r = await this.api.height.save(this.h.rev, changes)
				this.h = Object.assign({}, this.h, { rev: r.rev, data: r.data, hooks: r.hooks, applied: r.applied })
				this.syncDrafts()
				return { text: okText + (r.applied ? '' : ' ' + this.t('height.not_applied_now')) }
			} catch (e) {
				if (e && e.code === 'conflict') {
					await this.load()
					throw Object.assign(new Error(this.t('height.conflict')), { code: 'internal' })
				}
				throw Object.assign(new Error(messageOf(e, k => this.t(k))), { code: 'internal' })
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
				this.opError = messageOf(e, k => this.t(k))
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
		async doHook() {
			this.busy = true
			this.notice = ''
			this.opError = ''
			try {
				const r = await this.api.height.hook()
				this.h = Object.assign({}, this.h, { hooks: r.hooks, applied: true })
				return { text: this.t('height.hook_done', { files: r.added.join(', ') || '-' }) }
			} catch (e) {
				throw Object.assign(new Error(messageOf(e, k => this.t(k))), { code: 'internal' })
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
.height-module .height-block { font-size: 13px; line-height: 1.4; color: var(--wf-warn); }
.theme--light .height-module .height-block { color: #b26a00; }
</style>
