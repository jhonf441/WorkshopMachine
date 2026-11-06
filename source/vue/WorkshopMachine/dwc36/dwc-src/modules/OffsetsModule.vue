<template>
	<div class="offsets-module">
		<div class="text-h6 mb-1">{{ t('offsets.title') }}</div>
		<p class="text-body-2 machine-faint">{{ tx('offsets.intro') }}</p>
		<error-notice :error="loadError" retry @retry="load()" />
		<role-note v-if="!canWrite" min="technician" class="mb-3" />
		<template v-if="os.data">
			<v-card outlined class="mb-4">
				<v-card-title class="text-subtitle-1 pb-0">{{ t('offsets.tools_title') }}</v-card-title>
				<v-card-text>
					<offsets-table
						:sets="os.data.tools" :axes="toolAxes" :draft="os.drafts.tools" :editable="canWrite" :per-row="canWrite" :first-column="t('offsets.col_tool')"
						:empty-text="t('offsets.no_tools')" :reviewing="reviewKey" :saved="savedKey" @review="proposeTool"
					/>
					<div v-if="canWrite" class="text-caption machine-faint mt-1">{{ t('offsets.one_tool') }}</div>
				</v-card-text>
			</v-card>
			<!-- the work systems are read only here: they are the work zones of the Workbench (lib/cross-page.js) -->
			<v-card outlined class="mb-4">
				<v-card-title class="text-subtitle-1 pb-0">{{ t('offsets.work_title') }}</v-card-title>
				<v-card-text>
					<offsets-table :sets="os.data.workplaces" :axes="workAxes" :draft="noDraft" :current="os.data.current" :first-column="t('offsets.col_system')" :empty-text="t('offsets.no_work')" />
					<div class="text-caption machine-faint mt-2">{{ tx('offsets.work_hint') }}</div>
					<div v-if="workbenchOn" class="d-flex align-center flex-wrap mt-2" style="gap:8px"><workbench-link :zone="os.data.current" /></div>
				</v-card-text>
			</v-card>
			<plan-review v-if="ps.status !== 'idle'" class="mb-4" :state="ps" :title="reviewKey ? t('offsets.plan_title_tool', { tool: reviewLabel }) : t('offsets.plan_title')" :role-ok="canWrite" @apply="applyPlan()" @reset="resetPlan()" />
			<v-card v-if="canWrite" outlined class="mb-4">
				<v-card-title class="text-subtitle-1 pb-0">{{ t('offsets.snapshots_title') }}</v-card-title>
				<v-card-text>
					<offsets-snapshots :api="api" :snapshots="os.snapshots" :pick="os.pick" :last="os.data.lastSnapshot" :taken="taken" :can-write="canWrite" :busy="working" @snapshot="snapshot()" />
				</v-card-text>
			</v-card>
			<!-- the verification measures with the camera of Vision: nothing about it when Vision is not installed or not enabled -->
			<v-card v-if="visionOn" outlined class="mb-4">
				<v-card-title class="text-subtitle-1 pb-0">{{ t('verify.title') }}</v-card-title>
				<v-card-text><verify-camera :api="api" :published="published" :can-run="canRun" :measure="measure" :now="now" /></v-card-text>
			</v-card>
			<!-- shown only when the machine declares a laser tool AND a pointer tool and the board reports a laser -->
			<v-card v-if="pair.available" outlined class="mb-4">
				<v-card-title class="text-subtitle-1 pb-0">{{ t('offsets.pointer_title') }}</v-card-title>
				<v-card-text>
					<laser-pointer :pointer="os.pointer" :pair="pair" :can-run="canRun" :busy="working" @mark="mark" @capture="capture" @clear="clearMark" />
				</v-card-text>
			</v-card>
		</template>
		<div v-if="notice" class="text-body-2 success--text">{{ notice }}</div>
		<div v-if="opError" class="text-body-2 error--text">{{ opError }}</div>
	</div>
</template>

<script>
'use strict'

// Offsets module (design 2.7): the tool offsets (edited here, every change goes through the plan: diff preview, then the service's
// confirmation), the work coordinate systems G54..G59.3 (read only: they are the work zones of the Workbench, the button takes the person
// there), snapshots to compare and the laser <-> pointer assistant. An operator reads the tables; a technician edits the tools. Nothing
// here moves the machine except the cross mark of the assistant (a service procedure).

import ErrorNotice from '../ErrorNotice.vue' // vue/_shared
import OffsetsTable from './OffsetsTable.vue'
import OffsetsSnapshots from './OffsetsSnapshots.vue'
import LaserPointer from './LaserPointer.vue'
import PlanReview from './PlanReview.vue'
import VerifyCamera from './VerifyCamera.vue'
import WorkbenchLink from './WorkbenchLink.vue'
import { textMixin } from './text-mixin.js'
import { pluginActive } from '../workshop-ids.js' // vue/_shared36
import { createOffsetsState, loadBegin, loaded, loadFailed, axesFor, changesFor, pointerMarked, pointerCaptured, pointerReset } from '../state/offsets-state.js'
import { createPlanFlow } from '../state/plan-flow.js'
import { toolValues, toolChange, keyOf, setLabel, KIND_TOOLS } from '../lib/offsets.js'
import { pairOf, crossReasonKey } from '../lib/laser-pointer.js'
import { planErrorKey } from '../lib/plan-diff.js'
import { refusalOf } from '../api/machine-api.js'
import { detailOf } from '../lib/refusal.js'
import RoleNote from './RoleNote.vue'

const NO_DRAFT = {} // the work table is never edited here

export default {
	components: { RoleNote, ErrorNotice, OffsetsTable, OffsetsSnapshots, LaserPointer, PlanReview, VerifyCamera, WorkbenchLink },
	mixins: [textMixin],
	props: {
		api: { type: Object, required: true }, // createMachineApi(...)
		canWrite: { type: Boolean, default: false }, // workshopCan('machine.config.apply', config.g10): the technician
		canRun: { type: Boolean, default: false }, // technician: the cross mark
		toolPair: { type: Object, default: null }, // the pair the profile declares (normalizeState toolPair)
		published: { type: Object, default: null }, // normalizeRuns of the plugin data `machine` (the camera verification is a run)
		measure: { type: Boolean, default: null }, // machine.state vision.measure: Vision can measure a mark (null = not known)
		now: { type: Number, default: 0 }
	},
	data() {
		return { os: createOffsetsState(), ps: null, flow: null, loadError: null, working: false, notice: '', opError: '', taken: null, laser: null, noDraft: NO_DRAFT, reviewKey: '', reviewDraft: '', savedKey: '' }
	},
	computed: {
		workbenchOn() {
			return pluginActive(this.$store, 'workbench')
		},
		visionOn() {
			return pluginActive(this.$store, 'vision')
		},
		toolAxes() {
			return axesFor(this.os, 'tools')
		},
		workAxes() {
			return axesFor(this.os, 'work')
		},
		pair() {
			return pairOf(this.toolPair, this.laser)
		},
		// the tool whose plan is open, as the table names it ("T1 Pellet extruder")
		reviewLabel() {
			const set = ((this.os.data && this.os.data.tools) || []).find(s => keyOf(s) === this.reviewKey)
			return set ? setLabel(set) : this.reviewKey
		}
	},
	watch: {
		// the plan on screen is of the values that were reviewed: when the row is edited again the plan is closed (it would be applied with other numbers)
		'os.drafts.tools': {
			deep: true,
			handler() {
				if (this.reviewKey && this.ps && this.ps.status === 'review' && JSON.stringify(this.os.drafts.tools[this.reviewKey]) !== this.reviewDraft) this.resetPlan()
			}
		}
	},
	created() {
		this.flow = createPlanFlow({ apply: plan => this.api.config.apply(plan.id, plan.kind) })
		this.ps = this.flow.state
		this.load()
		this.api.capabilities().then(c => { this.laser = c.laser }, () => { this.laser = null }) // no answer: the profile alone decides
	},
	methods: {
		async load() {
			loadBegin(this.os)
			try {
				loaded(this.os, await this.api.offsets.get())
				this.loadError = null
				await this.loadSnapshots()
			} catch (e) {
				loadFailed(this.os, planErrorKey(refusalOf(e)), detailOf(e))
				this.loadError = e
			}
		},
		async loadSnapshots() {
			if (!this.canWrite) return
			try {
				this.os.snapshots = (await this.api.history.list({ kind: 'offsets.snapshot', limit: 20 })).records
			} catch (e) {
				this.os.snapshots = []
			}
		},
		// the tools go one by one (config.g10 edits one tool per plan)
		proposeTool(key) {
			const change = toolChange(changesFor(this.os), key)
			if (!change) return null
			const values = toolValues(change)
			this.reviewKey = key
			this.reviewDraft = JSON.stringify(this.os.drafts.tools[key])
			this.savedKey = ''
			return this.flow.propose(async () => ({ plan: await this.api.config.plan(KIND_TOOLS, values), conflict: null }))
		},
		async applyPlan() {
			await this.flow.apply(this.canWrite)
			if (this.ps.status === 'done') {
				this.savedKey = this.reviewKey // the row says it was saved (and the notice of the plan says where: the configuration of the machine)
				this.reviewKey = ''
				await this.load()
			}
		},
		resetPlan() {
			this.flow.reset()
			this.reviewKey = ''
		},
		// one service call with its busy flag, notice and error text
		async act(call, doneKey) {
			this.working = true
			this.notice = ''
			this.opError = ''
			try {
				const out = await call()
				this.notice = doneKey ? this.t(doneKey) : ''
				return out
			} catch (e) {
				if (!e || e.code !== 'cancelled') this.opError = this.t(this.reasonKey(e)) + (detailOf(e) ? ' (' + detailOf(e) + ')' : '')
				return null
			} finally {
				this.working = false
			}
		},
		reasonKey(e) {
			const reason = refusalOf(e)
			const cross = crossReasonKey(reason)
			return cross === 'offsets.cross_other' ? planErrorKey(reason) : cross
		},
		async snapshot() {
			this.taken = await this.act(() => this.api.offsets.snapshot(), 'offsets.done_snapshot')
			await this.loadSnapshots()
		},
		async mark(power) {
			const out = await this.act(() => this.api.pointer.mark(power), 'offsets.done_mark')
			if (out) pointerMarked(this.os, out)
		},
		async capture(save) {
			const out = await this.act(() => this.api.pointer.capture(save), null)
			if (out) pointerCaptured(this.os, out)
		},
		async clearMark() {
			if (await this.act(() => this.api.pointer.clear(), null)) pointerReset(this.os)
		}
	}
}
</script>
