<template>
	<div class="limits-module">
		<div class="text-h6 mb-1">{{ t('limits.title') }}</div>
		<p class="text-body-2 machine-faint">{{ t('limits.intro') }}</p>
		<error-notice :error="loadError" retry @retry="load()" />
		<v-alert v-if="!canEdit" dense outlined type="info" class="mb-3">{{ t('limits.read_only') }}</v-alert>
		<v-alert v-for="w in warnings" :key="w.code + w.axis" dense outlined type="warning" class="mb-2">{{ t(w.textKey) }}<span v-if="w.axis"> ({{ w.axis }})</span></v-alert>
		<v-alert v-if="limits && !limits.configRead" dense outlined type="info" class="mb-2">{{ t('limits.config_unread') }}</v-alert>
		<div v-if="!rows.length" class="text-body-2 machine-faint">{{ t('limits.no_axes') }}</div>
		<v-simple-table v-else dense>
			<thead>
				<tr>
					<th class="text-left">{{ t('limits.col_axis') }}</th>
					<th class="text-right">{{ t('limits.col_min') }}</th>
					<th class="text-right">{{ t('limits.col_max') }}</th>
					<th class="text-right">{{ t('limits.col_travel') }}</th>
					<th class="text-left">{{ t('limits.col_homed') }}</th>
				</tr>
			</thead>
			<tbody>
				<tr v-for="r in rows" :key="r.letter">
					<td>{{ r.letter }}</td>
					<td class="text-right">
						<v-text-field v-if="canEdit" v-model="draft[r.letter].min" dense outlined hide-details class="limits-field" :error="bad(r.letter)" :aria-label="r.letter + ' ' + t('limits.col_min')" />
						<span v-else>{{ r.min }}</span>
					</td>
					<td class="text-right">
						<v-text-field v-if="canEdit" v-model="draft[r.letter].max" dense outlined hide-details class="limits-field" :error="bad(r.letter)" :aria-label="r.letter + ' ' + t('limits.col_max')" />
						<span v-else>{{ r.max }}</span>
					</td>
					<td class="text-right">{{ travelOf(r) }}</td>
					<td>{{ r.homed === null ? '-' : r.homed ? t('common.yes') : t('common.no') }}</td>
				</tr>
			</tbody>
		</v-simple-table>
		<div v-for="c in problems" :key="c.letter" class="text-caption error--text mt-1">{{ c.letter }}: {{ t(c.errorKey) }}</div>
		<div v-if="canEdit && rows.length" class="d-flex align-center flex-wrap mt-3" style="gap:8px">
			<v-btn small color="primary" :disabled="!valid || flowBusy" @click="propose()">{{ t('limits.review') }}</v-btn>
			<span class="text-caption machine-faint">{{ t('limits.admin_hint') }}</span>
		</div>
		<plan-review v-if="ps.status !== 'idle'" class="mt-3" :state="ps" :title="t('limits.plan_title')" :role-ok="canEdit" @apply="applyPlan()" @reset="flow.reset()" />

		<div class="text-subtitle-1 mt-6 mb-1">{{ t('limits.verify_title') }}</div>
		<p class="text-body-2 machine-faint">{{ t('limits.verify_intro') }}</p>
		<run-start v-if="canRun" :allowed="canRun" :busy="!startAllowed" :starting="rs.status === 'starting'" :label="t('limits.verify_start')" @start="start(kind, {})" />
		<div v-else class="text-caption machine-faint">{{ t('run.needs_technician') }}</div>
		<run-progress class="mt-3" :run="rs.run" :error-text="runErrorText" :foreign-text="foreignText" :now="now" @stop="stop()" />
		<endstop-result v-if="verify" class="mt-3" :result="verify" />
		<div v-else-if="!busy" class="text-body-2 machine-faint mt-2">{{ t('limits.verify_none') }}</div>
	</div>
</template>

<script>
'use strict'

// Limits module (design 2.5): the M208 table of the machine (view for everybody who sees the module), the edit through a plan (admin
// only: `canEdit` is workshopCan('machine.config.apply') for config.m208, the server enforces it), and the endstop verification run
// (homes the axes: technician, with the pre-check list) with its result table.

import ErrorNotice from '../ErrorNotice.vue' // vue/_shared
import { runModule } from './run-module.js'
import RunStart from './RunStart.vue'
import RunProgress from './RunProgress.vue'
import PlanReview from './PlanReview.vue'
import EndstopResult from './EndstopResult.vue'
import { RUN_KINDS2, normalizeVerify } from '../api/machine-api-p2.js'
import { createPlanFlow } from '../state/plan-flow.js'
import { isWorking } from '../state/plan-state.js'
import { limitRows, draftOf, changedLimits, limitsValid, planValues, travel, warningRows, KIND_LIMITS } from '../lib/limits.js'

export default {
	components: { ErrorNotice, RunStart, RunProgress, PlanReview, EndstopResult },
	mixins: [runModule([RUN_KINDS2.homingVerify], {})],
	props: {
		api: { type: Object, required: true }, // createMachineApi(...)
		published: { type: Object, default: null }, // normalizeRuns of the plugin data `machine`
		canEdit: { type: Boolean, default: false }, // admin (workshopCan)
		canRun: { type: Boolean, default: false }, // technician
		now: { type: Number, default: 0 }
	},
	data() {
		return { limits: null, loadError: null, draft: {}, ps: null, flow: null }
	},
	computed: {
		kind() {
			return RUN_KINDS2.homingVerify
		},
		rows() {
			return limitRows(this.limits ? this.limits.axes : [])
		},
		warnings() {
			return warningRows(this.limits ? this.limits.warnings : [])
		},
		changes() {
			return changedLimits(this.rows, this.draft)
		},
		valid() {
			return limitsValid(this.changes)
		},
		problems() {
			return this.changes.filter(c => c.errorKey)
		},
		flowBusy() {
			return isWorking(this.ps)
		},
		verify() {
			return this.rs.result ? normalizeVerify(this.rs.result) : null
		},
		foreignText() {
			return this.rs.foreign ? this.t('run.another_running', { kind: this.foreignKind }) : ''
		}
	},
	created() {
		this.flow = createPlanFlow({ apply: plan => this.api.config.apply(plan.id, plan.kind) })
		this.ps = this.flow.state
		this.load()
	},
	methods: {
		travelOf: travel,
		async load() {
			try {
				this.limits = await this.api.limits.get()
				this.draft = draftOf(limitRows(this.limits.axes))
				this.loadError = null
			} catch (e) {
				this.loadError = e
			}
		},
		bad(letter) {
			return this.problems.some(c => c.letter === letter)
		},
		propose() {
			const values = planValues(this.changes)
			return this.flow.propose(async () => ({ plan: await this.api.config.plan(KIND_LIMITS, values), conflict: null }))
		},
		async applyPlan() {
			await this.flow.apply(this.canEdit)
			if (this.ps.status === 'done') {
				await this.load()
				this.$emit('changed')
			}
		}
	}
}
</script>

<style>
.limits-field { max-width: 120px; margin-left: auto; }
</style>
