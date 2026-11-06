<template>
	<div class="power-module">
		<div class="text-h6 mb-1">{{ t('power.title') }}</div>
		<p class="text-body-2 machine-faint">{{ t('power.intro') }}</p>
		<error-notice :error="loadError" retry @retry="load()" />
		<v-alert v-if="view" dense outlined :type="{ ok: 'success', warn: 'warning', info: 'info' }[state.level]" class="mb-3">{{ t(state.textKey) }}</v-alert>
		<template v-if="view && view.m911">
			<div class="text-subtitle-1 mb-1">{{ t('power.line_title') }}</div>
			<div class="d-flex flex-wrap align-center mb-1" style="gap:12px">
				<v-text-field v-if="canEdit" v-model="draft.s" dense outlined hide-details class="power-field" :label="t('power.cut_label')" suffix="V" :error="!!change.errorKey" />
				<div v-else><b>{{ t('power.cut_label') }}:</b> {{ view.m911.s }} V</div>
				<v-text-field v-if="canEdit" v-model="draft.r" dense outlined hide-details class="power-field" :label="t('power.restore_label')" suffix="V" :error="!!change.errorKey" />
				<div v-else><b>{{ t('power.restore_label') }}:</b> {{ view.m911.r }} V</div>
				<div v-if="view.voltsNow !== null"><b>{{ t('power.now_label') }}:</b> {{ view.voltsNow }} V</div>
			</div>
			<div v-if="change.errorKey" class="text-caption error--text">{{ t(change.errorKey, { sMin: range.sMin, sMax: range.sMax, rMin: range.rMin, rMax: range.rMax }) }}</div>
			<div class="text-caption machine-faint mb-2">{{ t('power.line_help') }}</div>
			<div v-if="view.m911.commands" class="text-caption mb-2"><b>{{ t('power.commands_label') }}:</b> <code>{{ view.m911.commands }}</code></div>
			<div v-if="canEdit" class="d-flex align-center flex-wrap" style="gap:8px">
				<v-btn small color="primary" :disabled="!hasChange || flowBusy" @click="propose()">{{ t('power.review') }}</v-btn>
				<span class="text-caption machine-faint">{{ t('power.admin_hint') }}</span>
			</div>
			<role-note v-else min="admin" class="mt-2" />
		</template>
		<template v-if="view">
			<div class="text-subtitle-1 mt-5 mb-1">{{ t('power.files_title') }}</div>
			<div class="text-caption machine-faint mb-3">{{ t('power.files_help') }}</div>

			<div class="power-file mb-4">
				<div class="text-subtitle-2">{{ t('power.resurrect_title') }}</div>
				<div class="text-caption machine-faint mb-1">{{ t('power.resurrect_what') }}</div>
				<div class="text-body-2"><code>resurrect.g</code>: {{ view.resurrect.exists ? t('power.resurrect_yes', { job: view.resurrect.job || '-' }) : t('power.resurrect_no') }}</div>
				<template v-if="view.resurrect.exists">
					<ul class="text-body-2 power-facts">
						<li v-if="view.resurrect.job"><b>{{ t('power.job_label') }}:</b> <code>{{ view.resurrect.job }}</code></li>
						<li v-if="view.resurrect.positionBytes !== null"><b>{{ t('power.position_label') }}:</b> {{ view.resurrect.positionBytes }}</li>
						<li v-if="axes"><b>{{ t('power.axes_label') }}:</b> {{ axes }}</li>
						<li v-for="(h, i) in view.resurrect.header" :key="i" class="machine-faint">{{ h }}</li>
					</ul>
					<v-btn small text @click="show.resurrect = !show.resurrect"><v-icon small left>mdi-file-eye-outline</v-icon>{{ t(show.resurrect ? 'power.hide_content' : 'power.view_content') }}</v-btn>
					<div v-if="show.resurrect" class="power-code mt-1"><div v-for="l in resurrectLines" :key="l.n" :class="'power-line power-' + l.kind"><span class="power-n">{{ l.n }}</span><span class="power-txt">{{ l.text }}</span></div></div>
					<div v-if="show.resurrect && view.resurrect.truncated" class="text-caption machine-faint">{{ t('power.truncated', { n: view.resurrect.text.length }) }}</div>
					<div class="power-resume mt-3">
						<div class="text-subtitle-2">{{ t('power.resume_title') }}</div>
						<div class="text-caption machine-faint mb-1">{{ t('power.resume_hint') }}</div>
						<ul class="text-body-2 power-facts power-facts-icons">
							<li v-for="c in resumeList" :key="c.id"><v-icon small :color="c.color" class="mr-1">{{ c.icon }}</v-icon>{{ t('power.chk_' + c.id) }}</li>
						</ul>
						<div v-if="view.resume.needsAck" class="d-flex flex-column mb-1">
							<v-checkbox v-for="k in ackKeys" :key="k" v-model="ack[k]" dense hide-details class="mt-0" :label="t('power.ack_' + k)" :disabled="!canResume" />
						</div>
						<div class="d-flex align-center flex-wrap" style="gap:8px">
							<v-btn small :color="armed ? 'error' : 'primary'" :disabled="!canResume || !!resumeWhy || resuming" @click="resumeTap()"><v-icon small left>mdi-play-circle-outline</v-icon>{{ t(armed ? 'power.resume_confirm' : 'power.resume_btn') }}</v-btn>
							<span v-if="canResume && resumeWhy" class="text-caption machine-faint">{{ t(resumeWhy) }}</span>
						</div>
						<error-notice :error="resumeError" />
						<v-alert v-if="resumeSent" dense outlined type="success" class="mt-2 mb-0">{{ t('power.resume_sent') }}</v-alert>
					</div>
				</template>
				<div v-else class="text-caption machine-faint">{{ t('power.resurrect_none_help') }}</div>
			</div>

			<div class="power-file">
				<div class="text-subtitle-2">{{ t('power.prologue_title') }}</div>
				<div class="text-caption machine-faint mb-1">{{ t('power.prologue_what') }}</div>
				<div class="text-body-2"><code>resurrect-prologue.g</code>: {{ view.prologue.exists ? t('power.prologue_yes') : t('power.prologue_no') }}</div>
				<template v-if="view.prologue.exists">
					<div class="text-caption mb-1">{{ t(view.prologue.isStandard ? 'power.standard_yes' : 'power.standard_no') }}</div>
					<ul class="text-body-2 power-facts power-facts-icons">
						<li v-for="f in facts" :key="f.key"><v-icon small :color="f.color" class="mr-1">{{ f.icon }}</v-icon>{{ t('power.fact_' + f.key) }}</li>
					</ul>
					<v-btn small text @click="show.prologue = !show.prologue"><v-icon small left>mdi-file-eye-outline</v-icon>{{ t(show.prologue ? 'power.hide_content' : 'power.view_content') }}</v-btn>
					<div v-if="show.prologue" class="power-code mt-1"><div v-for="l in prologueLines" :key="l.n" :class="'power-line power-' + l.kind"><span class="power-n">{{ l.n }}</span><span class="power-txt">{{ l.text }}</span></div></div>
					<div v-if="show.prologue && view.prologue.truncated" class="text-caption machine-faint">{{ t('power.truncated', { n: view.prologue.text.length }) }}</div>
				</template>
				<template v-else>
					<v-alert dense outlined type="warning" class="mt-1 mb-2"><b>{{ t('power.missing_title') }}.</b> {{ t('power.missing_text') }}</v-alert>
					<div class="d-flex align-center flex-wrap" style="gap:8px">
						<v-btn small color="primary" :disabled="!canCreate || flowBusy" @click="proposePrologue()"><v-icon small left>mdi-file-plus-outline</v-icon>{{ t('power.create') }}</v-btn>
						<span v-if="!canCreate" class="text-caption machine-faint">{{ t('power.create_admin_only') }}</span>
					</div>
				</template>
			</div>
			<plan-review v-if="ps.status !== 'idle'" class="mt-3" :state="ps" :title="t(planFor === 'prologue' ? 'power.prologue_plan_title' : 'power.plan_title')" :role-ok="planFor === 'prologue' ? canCreate : canEdit" @apply="applyPlan()" @reset="flow.reset()" />
		</template>
	</div>
</template>

<script>
'use strict'

// Power-loss module (DWC 3.6): the M911 line of the configuration (cut voltage S, restore voltage R, commands P) and the two files RepRapFirmware uses
// when a job is interrupted: resurrect.g (what it left) and resurrect-prologue.g (what runs before resuming). The page shows both with a technical summary
// and the content; the two voltages are edited through a plan (admin only: `canEdit`) and a missing prologue is created through a plan (`canCreate`, admin).
// The server enforces both.

import ErrorNotice from '../ErrorNotice.vue' // vue/_shared
import PlanReview from './PlanReview.vue'
import { textMixin } from './text-mixin.js'
import { createPlanFlow } from '../state/plan-flow.js'
import { isWorking } from '../state/plan-state.js'
import { KIND_POWER, KIND_PROLOGUE, POWER_RANGE, ACK_KEYS, powerDraft, powerChange, powerState, fileLines, prologueFacts, resumeRows, resumeBlock } from '../lib/power.js'
import RoleNote from './RoleNote.vue'

export default {
	mixins: [textMixin],
	components: { RoleNote, ErrorNotice, PlanReview },
	props: {
		api: { type: Object, required: true },
		canEdit: { type: Boolean, default: false }, // admin (workshopCan): the two voltages
		canCreate: { type: Boolean, default: false }, // admin: creates the standard prologue when there is none
		canResume: { type: Boolean, default: false } // technician: resumes the interrupted job (the service checks again)
	},
	data() {
		return { view: null, loadError: null, draft: { s: '', r: '' }, ps: null, flow: null, range: POWER_RANGE, show: { resurrect: false, prologue: false }, planFor: 'm911', ackKeys: ACK_KEYS, ack: { piece: false, tool: false, area: false }, armed: false, resuming: false, resumeError: null, resumeSent: false, armTimer: null }
	},
	computed: {
		state() {
			return powerState(this.view)
		},
		change() {
			return powerChange(this.view && this.view.m911, this.draft)
		},
		hasChange() {
			return !this.change.errorKey && Object.keys(this.change.values).length > 0
		},
		flowBusy() {
			return isWorking(this.ps)
		},
		axes() {
			const g = (this.view && this.view.resurrect.g92) || {}
			return Object.keys(g).map(k => k + g[k]).join('  ')
		},
		resurrectLines() {
			return this.show.resurrect ? fileLines(this.view.resurrect.text) : []
		},
		prologueLines() {
			return this.show.prologue ? fileLines(this.view.prologue.text) : []
		},
		facts() {
			return prologueFacts(this.view && this.view.prologue.summary)
		},
		resumeList() {
			return resumeRows(this.view && this.view.resume)
		},
		resumeWhy() {
			return resumeBlock(this.view && this.view.resume, this.ack)
		}
	},
	watch: {
		// whatever changes in the list or the acknowledgements disarms the button
		ack: { deep: true, handler() { this.disarm() } },
		resumeWhy() { this.disarm() }
	},
	created() {
		this.flow = createPlanFlow({ apply: plan => this.api.config.apply(plan.id, plan.kind) })
		this.ps = this.flow.state
		this.load()
	},
	methods: {
		async load() {
			try {
				this.view = await this.api.power.get()
				this.draft = powerDraft(this.view.m911)
				this.loadError = null
			} catch (e) {
				this.loadError = e
			}
		},
		propose() {
			const values = this.change.values
			this.planFor = 'm911'
			return this.flow.propose(async () => ({ plan: await this.api.config.plan(KIND_POWER, values), conflict: null }))
		},
		proposePrologue() {
			this.planFor = 'prologue'
			return this.flow.propose(async () => ({ plan: await this.api.config.plan(KIND_PROLOGUE, {}), conflict: null }))
		},
		disarm() {
			this.armed = false
			if (this.armTimer) clearTimeout(this.armTimer)
			this.armTimer = null
		},
		// the first tap arms the button for five seconds; the second one sends
		async resumeTap() {
			if (this.resumeWhy || this.resuming) return
			if (!this.armed) {
				this.armed = true
				this.armTimer = setTimeout(() => this.disarm(), 5000)
				return
			}
			this.disarm()
			this.resuming = true
			this.resumeError = null
			this.resumeSent = false
			try {
				await this.api.power.resume(Object.assign({}, this.ack))
				this.resumeSent = true
				ACK_KEYS.forEach(k => { this.ack[k] = false })
				await this.load()
			} catch (e) {
				this.resumeError = e
			} finally {
				this.resuming = false
			}
		},
		async applyPlan() {
			await this.flow.apply(this.planFor === 'prologue' ? this.canCreate : this.canEdit)
			if (this.ps.status === 'done') {
				await this.load()
				this.$emit('changed')
			}
		}
	}
}
</script>

<style>
.power-field { max-width: 150px; }
.power-facts { padding-left: 18px; }
.power-facts-icons { list-style: none; padding-left: 0; }
.power-code { font-family: monospace; font-size: 12px; max-height: 320px; overflow: auto; border-radius: 4px; padding: 6px 0; background: rgba(128, 128, 128, 0.12); }
.power-line { display: flex; }
.power-n { min-width: 40px; padding-right: 10px; text-align: right; opacity: 0.45; user-select: none; }
.power-txt { white-space: pre-wrap; word-break: break-word; }
.power-comment { opacity: 0.6; }
.power-blank .power-txt { min-height: 1em; }
</style>
