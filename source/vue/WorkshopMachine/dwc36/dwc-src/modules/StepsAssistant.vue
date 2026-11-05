<template>
	<div class="steps-assistant">
		<p class="text-body-2 machine-faint">{{ t('calibration.steps_intro') }}</p>
		<role-note v-if="!canEdit" min="admin" class="mb-3" />
		<div v-if="!rows.length" class="text-body-2 machine-faint">{{ t('calibration.no_axes') }}</div>
		<template v-else>
			<div class="d-flex flex-wrap align-center" style="gap:12px">
				<v-select v-model="axis" :items="axisItems" :label="t('calibration.axis')" dense outlined hide-details style="max-width:120px" />
				<v-text-field v-model="commanded" type="number" :min="1" :max="5000" step="any" inputmode="decimal" :label="t('calibration.commanded')" dense outlined hide-details="auto" style="max-width:170px" suffix="mm" :error-messages="msg(commanded, RANGE_COMMANDED)" @keydown="blockKey" />
				<v-text-field v-model="measured" type="number" :min="0.001" step="any" inputmode="decimal" :label="t('calibration.measured')" dense outlined hide-details="auto" style="max-width:170px" suffix="mm" :error-messages="msg(measured, RANGE_POSITIVE)" @keydown="blockKey" />
			</div>
			<div class="text-body-2 mt-2">{{ t('calibration.steps_current', { axis, value: old === null ? '-' : old }) }}</div>
			<gcode-block class="mt-2" :title="t('calibration.steps_test')" :text="gcode" :hide-note="canMove" />
			<div v-if="canMove" class="d-flex align-center flex-wrap mt-1" style="gap:8px">
				<v-btn small outlined color="primary" :disabled="!!sendWhy || moving" :loading="moving" @click="move()"><v-icon small left>mdi-arrow-right-bold-circle-outline</v-icon>{{ t('calibration.steps_send') }}</v-btn>
				<span class="text-caption machine-faint">{{ sendWhy ? t(sendWhy, { max: TEST_MOVE_MAX_MM }) : t('calibration.steps_send_help') }}</span>
			</div>
			<error-notice :error="moveError" />
			<v-alert v-if="moved" dense outlined type="success" class="mt-2 mb-0">{{ t('calibration.steps_sent', moved) }}</v-alert>
			<v-alert v-if="result.errorKey && !fieldError(result.errorKey)" dense outlined type="warning" class="mt-3">{{ t(result.errorKey) }}</v-alert>
			<v-card v-if="result.formula" outlined class="mt-3">
				<v-card-text>
					<div class="text-body-2">{{ t('calibration.steps_formula', result.formula) }}</div>
					<div class="text-subtitle-1 mt-1">{{ t('calibration.steps_new', { axis, next: result.next, change: signed(result.change) }) }}</div>
					<v-alert v-if="result.bigChange && result.ok" dense outlined type="warning" class="mt-2 mb-0">{{ t('calibration.steps_big') }}</v-alert>
				</v-card-text>
			</v-card>
			<div class="d-flex align-center flex-wrap mt-3" style="gap:8px">
				<v-btn small color="primary" :disabled="!result.ok || flowBusy" @click="review()">{{ t('calibration.review') }}</v-btn>
				<span class="text-caption machine-faint">{{ t('calibration.steps_hint') }}</span>
			</div>
		</template>
		<calc-warnings :rows="calcWarnings" />
		<plan-review v-if="ps.status !== 'idle'" class="mt-3" :state="ps" :title="t('calibration.steps_plan')" :role-ok="canEdit" @apply="applied()" @reset="flow.reset()" />
	</div>
</template>

<script>
'use strict'

// Steps per mm assistant (design 2.6): commanded vs measured -> the new value with its formula (preview), then machine.calc and the plan
// (admin class: M92). Pure logic in lib/steps-calc.js; the review and the apply are the shared plan flow.

import PlanReview from './PlanReview.vue'
import GcodeBlock from './GcodeBlock.vue'
import CalcWarnings from './CalcWarnings.vue'
import ErrorNotice from '../ErrorNotice.vue' // vue/_shared
import { FIELD_ERRORS, fieldInvalid, fieldMessage, blockKey, numberOf, TEST_MOVE_MAX_MM } from '../lib/number-field.js'
import { planModule } from './plan-module.js'
import { stepsResult, stepsInput, testMoveGcode, CALC_STEPS } from '../lib/steps-calc.js'
import RoleNote from './RoleNote.vue'

export default {
	components: { RoleNote, PlanReview, GcodeBlock, CalcWarnings, ErrorNotice },
	mixins: [planModule()],
	props: {
		api: { type: Object, required: true }, // createMachineApi(...)
		rows: { type: Array, default: () => [] }, // lib/motion-table.js tableRows (axes and extruders)
		canEdit: { type: Boolean, default: false }, // workshopCan machine.config.apply for config.m92 (admin)
		canMove: { type: Boolean, default: false } // technician: the test move can be sent from here (machine.test_move: the service checks and asks to confirm)
	},
	data() {
		return { axis: '', commanded: '100', measured: '', feed: '600', moving: false, moveError: null, moved: null, TEST_MOVE_MAX_MM, RANGE_COMMANDED: { min: 1, max: 5000 }, RANGE_POSITIVE: { positive: true } }
	},
	computed: {
		axisItems() {
			return this.rows.map(r => r.letter)
		},
		old() {
			const r = this.rows.find(x => x.letter === this.axis)
			return r && typeof r.stepsPerMm === 'number' ? r.stepsPerMm : null
		},
		result() {
			return stepsResult(this.old, this.commanded, this.measured)
		},
		gcode() {
			return testMoveGcode(this.axis, this.commanded, this.feed)
		},
		// why the move cannot be sent from here ('' = it can): only an axis (an extruder is calibrated by extruding), a good distance and up to the limit of the service
		sendWhy() {
			const d = numberOf(this.commanded)
			if (!/^[XYZUVWABC]$/.test(this.axis)) return 'calibration.steps_send_axis'
			if (d === null || d <= 0 || fieldInvalid(this.commanded, this.RANGE_COMMANDED)) return 'calibration.field_positive'
			if (d > TEST_MOVE_MAX_MM) return 'calibration.steps_send_max'
			return ''
		}
	},
	watch: {
		rows: {
			immediate: true,
			handler(rows) {
				if (!rows.some(r => r.letter === this.axis) && rows.length) this.axis = rows[0].letter
			}
		}
	},
	methods: {
		async applied() {
			await this.applyPlan(this.canEdit)
			if (this.ps.status === 'done') this.$emit('changed')
		},
		blockKey,
		fieldError(key) {
			return FIELD_ERRORS.indexOf(key) >= 0
		},
		msg(v, range) {
			const m = fieldMessage(range)
			return fieldInvalid(v, range) ? [this.t(m.key, m.params)] : []
		},
		// the service asks the confirmation itself (confirm_required: the dialog of the page) and checks the machine again before it moves
		async move() {
			this.moving = true
			this.moveError = null
			this.moved = null
			try {
				const r = await this.api.testMove(this.axis, Number(this.commanded), Number(this.feed))
				this.moved = { axis: r.axis, distance: r.distance }
			} catch (e) {
				this.moveError = e
			} finally {
				this.moving = false
			}
		},
		signed(v) {
			return (v > 0 ? '+' : '') + v
		},
		review() {
			return this.proposeCalc(CALC_STEPS, stepsInput(this.axis, this.old, this.result))
		}
	}
}
</script>
