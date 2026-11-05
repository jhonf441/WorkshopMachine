<template>
	<div class="toolwiz-module">
		<div class="text-h6 mb-1">{{ t('toolwiz.title') }}</div>
		<p class="text-body-2 machine-faint">{{ t('toolwiz.intro') }}</p>
		<v-alert v-if="api.toolwiz.mock" dense outlined type="info" class="text-body-2">{{ t('toolwiz.mock_notice') }}</v-alert>
		<role-note v-if="!canWrite" min="technician" class="text-body-2" />
		<v-alert v-if="busy && !w.applied" dense outlined type="warning" class="text-body-2">{{ t('toolwiz.block_busy') }}</v-alert>
		<error-notice :error="loadError" retry @retry="load()" />

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
	</div>
</template>

<script>
'use strict'

// "New tool" assistant (DWC 3.6): leads a technician step by step to a tool with its driver, heaters, fans and temperature sensors: type, name and number,
// what it carries, pins (only the free ones), the exact preview, the plan with backup and the guided tests. Everything the machine gets goes through
// the service plan (config.tool): the page never sends loose G-code. The rules that block (heater without sensor / maximum temperature / autotune,
// role, busy machine) are in lib/toolwiz-safety.js; the service enforces them again. The service operations are behind api.toolwiz (api/machine-api-toolwiz.js).

import ErrorNotice from '../ErrorNotice.vue' // vue/_shared
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

const STEP_ICONS = { type: 'mdi-shape-outline', name: 'mdi-form-textbox', carries: 'mdi-fire', pins: 'mdi-pin-outline', preview: 'mdi-file-eye-outline', apply: 'mdi-content-save-check-outline', tests: 'mdi-clipboard-check-outline' }
const NO_PINS = { free: [], used: [], freeDrivers: null }

export default {
	mixins: [textMixin],
	components: { RoleNote, ErrorNotice, ToolStepType, ToolStepName, ToolStepCarries, ToolStepPins, ToolStepPreview, ToolStepApply, ToolStepTests },
	props: {
		api: { type: Object, required: true },
		canWrite: { type: Boolean, default: false }, // technician: creating the plan (the service checks again)
		busy: { type: Boolean, default: false } // a procedure is running: the machine is not free
	},
	data() {
		return { w: createWizard(null), tools: { tools: [], nextNumber: null, familyHint: '' }, pins: NO_PINS, loadError: null, tried: false, previewLoading: false, previewError: null, ps: null, flow: null }
	},
	computed: {
		ctx() {
			return { usedNumbers: this.tools.tools.map(x => x.number), freeDrivers: this.pins.freeDrivers, laserMode: undefined, pins: this.pins, canWrite: this.canWrite, busy: this.busy, familyHint: this.tools.familyHint }
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
