<template>
	<div class="toolwiz-module">
		<card-head icon="mdi-wrench-cog-outline" :title="t('toolwiz.title')" />
		<v-alert v-if="api.toolwiz.mock" dense outlined type="info" class="text-body-2">{{ t('toolwiz.mock_notice') }}</v-alert>
		<role-note v-if="!canWrite" min="technician" class="text-body-2" :subject="$t('plugins.WorkshopMachine.subjects.tool_wizard')" />
		<v-alert v-if="busy && !w.applied" dense outlined type="warning" class="text-body-2">{{ t('toolwiz.block_busy') }}</v-alert>
		<section-notice :error="loadError" retry @retry="load()" />

		<!-- the steps: the colour says where each one is (done, on show, pending); a step opens only when the ones before it are clean -->
		<div class="d-flex flex-wrap mb-3" style="gap: 6px">
			<v-chip
				v-for="s in steps" :key="s.id" small :color="s.color" :text-color="s.color === 'grey lighten-2' ? undefined : 'white'" :disabled="!s.open"
				:outlined="s.current ? false : !s.done" @click="open(s.id)"
			>
				<v-icon x-small left>{{ s.icon }}</v-icon>{{ s.n }}. {{ t('toolwiz.step_' + s.id) }}
			</v-chip>
		</div>

		<tool-step-type v-if="w.step === 'type'" :w="w" :ctx="ctx" :issues="issues" :show="tried" />
		<tool-step-name v-else-if="w.step === 'name'" :w="w" :ctx="ctx" :issues="issues" :show="tried" />
		<tool-step-carries v-else-if="w.step === 'carries'" :w="w" :ctx="ctx" :issues="issues" :show="tried" />
		<tool-step-pins v-else-if="w.step === 'pins'" :w="w" :ctx="ctx" :issues="issues" :show="tried" />
		<tool-step-preview v-else-if="w.step === 'preview'" :w="w" :ctx="ctx" :loading="previewLoading" :error="previewError" @reload="loadPreview()" @goto="open($event)" />
		<tool-step-apply v-else-if="w.step === 'apply'" :w="w" :ctx="ctx" :issues="issues" :ps="ps" @plan="createPlan()" @apply="applyPlan()" @reset="flow.reset()" />
		<tool-step-tests v-else :w="w" @again="restart()" />

		<v-alert v-if="tried && issues.length && showGeneral" dense outlined type="warning" class="mt-3 text-body-2">{{ t('toolwiz.fix_first') }}</v-alert>

		<div v-if="!w.applied" class="d-flex align-center mt-4" style="gap: 8px">
			<v-btn small outlined :disabled="w.step === 'type'" @click="goBack()"><v-icon small left>mdi-chevron-left</v-icon>{{ t('toolwiz.back') }}</v-btn>
			<v-btn v-if="w.step !== 'apply' && !previewBlocked" small color="primary" @click="goNext()">{{ t('toolwiz.next') }}<v-icon small right>mdi-chevron-right</v-icon></v-btn>
		</div>
		<!-- ONE help for the section, at the foot: what the wizard is, then what the rows of the step mean (each row registers itself, see ToolRow.vue) -->
		<help-fold :title="t('toolwiz.title')" :what="t('toolwiz.intro')" :items="helpItems" class="mt-4" />
	</div>
</template>

<script>
'use strict'

// "New tool" assistant (DWC 3.6): leads a technician step by step to a tool with its driver, heaters, fans and temperature sensors: type, name and number,
// what it carries, pins (only the free ones), the exact preview, the plan with backup and the guided tests. Everything the machine gets goes through
// the service plan (config.tool): the page never sends loose G-code. The rules that block (heater without sensor / maximum temperature / autotune,
// role, busy machine) are in lib/toolwiz-safety.js; the service enforces them again. The service operations are behind api.toolwiz (api/machine-api-toolwiz.js).

import SectionNotice from './SectionNotice.vue' // one notice per cause
import ToolStepType from './ToolStepType.vue'
import ToolStepName from './ToolStepName.vue'
import ToolStepCarries from './ToolStepCarries.vue'
import ToolStepPins from './ToolStepPins.vue'
import ToolStepPreview from './ToolStepPreview.vue'
import ToolStepApply from './ToolStepApply.vue'
import ToolStepTests from './ToolStepTests.vue'
import { textMixin } from './text-mixin.js'
import { createPlanFlow } from '../state/plan-flow.js'
import { STEPS, createWizard, stepIssues, canGo, go, next, back, setPreview, markApplied } from '../state/toolwiz-state.js'
import { toSpec, specKey } from '../lib/toolwiz-spec.js'
import RoleNote from './RoleNote.vue'
import HelpFold from '../HelpFold.vue' // vue/_shared36
import CardHead from '../CardHead.vue' // vue/_shared36

const STEP_ICONS = { type: 'mdi-shape-outline', name: 'mdi-form-textbox', carries: 'mdi-fire', pins: 'mdi-pin-outline', preview: 'mdi-file-eye-outline', apply: 'mdi-content-save-check-outline', tests: 'mdi-clipboard-check-outline' }
const NO_PINS = { free: [], used: [], freeDrivers: null }

export default {
	mixins: [textMixin],
	components: { CardHead, RoleNote, SectionNotice, HelpFold, ToolStepType, ToolStepName, ToolStepCarries, ToolStepPins, ToolStepPreview, ToolStepApply, ToolStepTests },
	props: {
		api: { type: Object, required: true },
		canWrite: { type: Boolean, default: false }, // technician: creating the plan (the service checks again)
		busy: { type: Boolean, default: false } // a procedure is running: the machine is not free
	},
	// the rows of the step on show tell it that they exist (ToolRow.vue): the step has ONE help for all of them
	provide() {
		return { toolHelp: { add: row => this.helpRows.push(row), remove: row => { const i = this.helpRows.indexOf(row); if (i >= 0) this.helpRows.splice(i, 1) } } }
	},
	data() {
		return { helpRows: [], w: createWizard(null), tools: { tools: [], nextNumber: null, familyHint: '', modes: [], machineFile: null }, pins: NO_PINS, loadError: null, tried: false, previewLoading: false, previewError: null, ps: null, flow: null }
	},
	computed: {
		ctx() {
			return { usedNumbers: this.tools.tools.map(x => x.number), freeDrivers: this.pins.freeDrivers, laserMode: undefined, pins: this.pins, canWrite: this.canWrite, busy: this.busy, familyHint: this.tools.familyHint, machineFile: this.tools.machineFile }
		},
		issues() {
			return stepIssues(this.w, this.w.step, this.ctx)
		},
		// the preview with errors (or still stale) has no button to continue: the person goes back and fixes it
		previewBlocked() {
			return this.w.step === 'preview' && this.issues.length > 0
		},
		showGeneral() {
			return this.w.step !== 'apply' && this.w.step !== 'preview'
		},
		steps() {
			const cur = STEPS.indexOf(this.w.step)
			return STEPS.map((id, i) => {
				const done = i < cur || (this.w.applied && id !== 'tests') || (id === 'tests' && !!this.w.applied && cur === i)
				return { id, n: i + 1, icon: STEP_ICONS[id], current: i === cur, done, open: canGo(this.w, id, this.ctx), color: i === cur ? 'primary' : done ? 'success' : 'grey lighten-2' }
			})
		},
		specText() {
			return specKey(this.w.draft)
		},
		// one block per row of the step, in the order they are on screen, a topic once
		helpItems() {
			const seen = new Set()
			return this.helpRows
				.filter(r => r.$el && r.$el.compareDocumentPosition)
				.sort((a, b) => (a.$el.compareDocumentPosition(b.$el) & 4 ? -1 : 1))
				.filter(r => !seen.has(r.topic) && seen.add(r.topic))
				.map(r => ({ title: r.label, what: this.t('toolwiz.h_' + r.topic + '_what'), why: this.t('toolwiz.h_' + r.topic + '_why'), ifMissing: this.t('toolwiz.h_' + r.topic + '_missing'), how: this.t('toolwiz.h_' + r.topic + '_how') }))
		}
	},
	watch: {
		'w.step'(id) {
			this.tried = false
			if (id === 'preview') this.loadPreview()
		},
		// any edit makes the plan under review stale: it is dropped, never applied by mistake
		specText() {
			if (!this.w.applied && this.ps.status !== 'idle') this.flow.reset()
		}
	},
	created() {
		this.flow = createPlanFlow({ apply: plan => this.api.toolwiz.apply(plan) })
		this.ps = this.flow.state
		this.load()
	},
	methods: {
		async load() {
			try {
				this.tools = await this.api.toolwiz.get()
				this.pins = await this.api.toolwiz.pins()
				this.loadError = null
				if (this.w.draft.number === '' && this.tools.nextNumber !== null) this.w.draft.number = String(this.tools.nextNumber)
			} catch (e) {
				this.loadError = e
			}
		},
		open(id) {
			go(this.w, id, this.ctx)
		},
		goNext() {
			this.tried = !next(this.w, this.ctx).moved
		},
		goBack() {
			back(this.w)
		},
		async loadPreview() {
			this.previewLoading = true
			this.previewError = null
			try {
				setPreview(this.w, await this.api.toolwiz.preview(toSpec(this.w.draft)))
			} catch (e) {
				this.previewError = e
			} finally {
				this.previewLoading = false
			}
		},
		createPlan() {
			return this.flow.propose(async () => ({ plan: await this.api.toolwiz.plan(toSpec(this.w.draft)), conflict: null }))
		},
		async applyPlan() {
			await this.flow.apply(this.canWrite)
			if (this.ps.status === 'done') markApplied(this.w, this.ps.result)
		},
		restart() {
			this.w = createWizard(null)
			this.flow.reset()
			this.load()
		}
	}
}
</script>
