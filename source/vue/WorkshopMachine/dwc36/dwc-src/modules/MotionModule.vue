<template>
	<div class="motion-module">
		<div class="text-h6 mb-1">{{ t('motion.title') }}</div>
		<p class="text-body-2 machine-faint">{{ t('motion.intro') }}</p>
		<error-notice :error="loadError" retry @retry="load()" />
		<v-alert v-if="!canEdit" dense outlined type="info" class="mb-3">{{ t('motion.read_only') }}</v-alert>
		<v-alert v-if="motion && !motion.configRead" dense outlined type="info" class="mb-3">{{ t('motion.config_unread') }}</v-alert>
		<div v-if="!rows.length" class="text-body-2 machine-faint">{{ t('motion.no_axes') }}</div>
		<div v-else style="overflow-x:auto"><motion-table :rows="rows" :highlight="param" /></div>
		<div v-if="motion" class="text-body-2 mt-2">{{ t('motion.idle_now', { percent: show(motion.idle.percent), timeout: show(motion.idle.timeoutS) }) }}</div>
		<details class="wf-more">
			<summary>{{ t('common.how_it_works') }}</summary>
		<div class="text-caption machine-faint mt-1">{{ t('motion.units') }}</div>
		</details>
		<div class="mt-2">
			<span class="text-body-2">{{ t('motion.motors_question') }}</span>
			<v-btn x-small outlined class="ml-2" to="/Plugins/Motors"><v-icon x-small left>mdi-engine</v-icon>{{ t('motion.open_motors') }}</v-btn>
		</div>

		<template v-if="canEdit && rows.length">
			<div class="text-subtitle-1 mt-6 mb-1">{{ t('motion.edit_title') }}</div>
			<p class="text-body-2 machine-faint">{{ t('motion.edit_intro') }}</p>
			<v-select v-model="param" :items="paramItems" :label="t('motion.parameter')" dense outlined hide-details style="max-width:300px" @change="resetDraft()" />
			<div class="d-flex flex-wrap mt-3" style="gap:12px">
				<template v-for="r in edit">
					<v-select v-if="p.choices" :key="r.key" v-model="draft[r.key]" :items="modeItems" :label="r.label" dense outlined hide-details style="max-width:220px" />
					<v-text-field v-else :key="r.key" v-model="draft[r.key]" :label="labelOf(r)" :suffix="unitText" dense outlined hide-details style="max-width:170px" :error="bad(r.key)" />
				</template>
			</div>
			<div v-for="c in problems" :key="c.key" class="text-caption error--text mt-1">{{ c.key }}: {{ t(c.errorKey, c.range || {}) }}</div>
			<div v-if="p.id === 'current'" class="text-caption warning--text mt-2">{{ t('motion.current_warn', { max: range ? range.max : '-' }) }}</div>
			<div v-if="p.id === 'mode'" class="text-caption machine-faint mt-2">{{ t('motion.mode_hint') }}</div>
			<div class="d-flex align-center flex-wrap mt-3" style="gap:8px">
				<v-btn small color="primary" :disabled="!ok || flowBusy" @click="review()">{{ t('motion.review') }}</v-btn>
				<span class="text-caption machine-faint">{{ t('motion.admin_hint') }}</span>
			</div>
			<plan-review v-if="ps.status !== 'idle'" class="mt-3" :state="ps" :title="t('motion.plan_title')" :role-ok="canEdit" @apply="applied()" @reset="flow.reset()" />
			<try-panel
				v-if="p.gcode" class="mt-4" :state="tf" :now="now" :role-ok="trial(p.gcode)" :has-values="ok" :can-persist="canEdit" :line="line" :seconds.sync="trySeconds"
				@start="tryNow(p.gcode, values)" @keep="tryFlow.keep()" @revert="tryFlow.revert()" @reset="tryFlow.reset()" @persist="persistTrial()"
			/>
			<div v-else class="text-caption machine-faint mt-3">{{ t('motion.no_trial') }}</div>
		</template>
		<!-- a trial left running by another page or before a reload is shown here, whatever the parameter selected -->
		<try-panel v-else-if="tf.status !== 'idle'" class="mt-4" :state="tf" :now="now" :role-ok="false" :seconds.sync="trySeconds" @reset="tryFlow.reset()" />
	</div>
</template>

<script>
'use strict'

// Motion parameters (design 2.8): the table of the axes (read-only for everybody who sees the module), the edit of ONE parameter at a
// time through a plan (administrator only; `canEdit` is workshopCan for the kind, the server enforces it), and "try now" with the
// auto-revert countdown for the parameters machine.try accepts. The trial survives a page reload (state/try-flow.js).
// Microstepping is shown but not edited here (the service has no plan kind for it).

import ErrorNotice from '../ErrorNotice.vue' // vue/_shared
import MotionTable from './MotionTable.vue'
import PlanReview from './PlanReview.vue'
import TryPanel from './TryPanel.vue'
import { planModule } from './plan-module.js'
import { trialModule } from './trial-module.js'
import { tableRows, PARAMS, DRIVER_MODES, paramOf, editRows, draftOf, changes, valid, planValues, previewLine, rangeOf } from '../lib/motion-table.js'

export default {
	components: { ErrorNotice, MotionTable, PlanReview, TryPanel },
	mixins: [planModule(), trialModule()],
	props: {
		api: { type: Object, required: true }, // createMachineApi(...)
		configure: { type: Function, required: true }, // capabilitiesOf(...).configure(kind)
		trial: { type: Function, required: true }, // capabilitiesOf(...).trial(gcodeKind)
		isAdmin: { type: Boolean, default: false }, // the module edits for an administrator only
		now: { type: Number, default: 0 } // epoch seconds, ticks every second
	},
	data() {
		return { motion: null, loadError: null, param: PARAMS[0].id, draft: {} }
	},
	computed: {
		rows() {
			return tableRows(this.motion ? this.motion.rows : [])
		},
		p() {
			return paramOf(this.param)
		},
		canEdit() {
			return this.configure(this.p.kind)
		},
		paramItems() {
			return PARAMS.map(x => ({ value: x.id, text: this.t('motion.param_' + x.id) }))
		},
		modeItems() {
			return DRIVER_MODES.map(m => ({ value: m, text: this.t('motion.mode_' + m) }))
		},
		edit() {
			return editRows(this.rows, this.param, this.motion && this.motion.idle)
		},
		limits() {
			return this.motion ? this.motion.limits : null
		},
		range() {
			return rangeOf(this.param, this.limits)
		},
		list() {
			return changes(this.edit, this.param, this.draft, this.limits)
		},
		ok() {
			return valid(this.list)
		},
		problems() {
			return this.list.filter(c => c.errorKey)
		},
		values() {
			return planValues(this.param, this.list)
		},
		line() {
			return previewLine(this.param, this.list)
		},
		unitText() {
			return this.p.unit ? this.t('motion.unit_' + this.p.unit) : ''
		}
	},
	created() {
		this.load()
	},
	methods: {
		show(v) {
			return v === null || v === undefined ? '-' : v
		},
		labelOf(r) {
			return r.labelKey ? this.t(r.labelKey) : r.label
		},
		async load() {
			try {
				this.motion = await this.api.motion.get()
				this.loadError = null
				this.resetDraft()
			} catch (e) {
				this.loadError = e
			}
		},
		resetDraft() {
			this.draft = draftOf(this.edit, this.param)
		},
		bad(key) {
			return this.problems.some(c => c.key === key)
		},
		review() {
			return this.propose(this.p.kind, this.values)
		},
		async applied() {
			await this.applyPlan(this.canEdit)
			if (this.ps.status === 'done') await this.load()
		}
	}
}
</script>
