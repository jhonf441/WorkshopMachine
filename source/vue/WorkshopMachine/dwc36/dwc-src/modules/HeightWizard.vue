<template>
	<div class="height-wizard">
		<div class="text-subtitle-2 mb-2">{{ t(kind === 'k0' ? 'height.wizard_k0_title' : 'height.wizard_paper_title', { mode: view.mode }) }}</div>
		<div v-for="(s, i) in steps" :key="s" class="height-step" :class="{ cur: i === step, done: i < step }">
			<div class="d-flex align-center flex-wrap" style="gap:8px">
				<span class="height-n">{{ i < step ? '✓' : i + 1 }}</span>
				<span class="text-body-2">{{ stepText(s) }}</span>
			</div>
			<div v-if="i === step" class="height-actions">
				<template v-if="s === 'goto'">
					<div class="d-flex align-center flex-wrap" style="gap:8px">
						<v-text-field v-model="px" type="number" dense outlined hide-details class="height-field" label="X" />
						<v-text-field v-model="py" type="number" dense outlined hide-details class="height-field" label="Y" />
						<v-btn color="primary" small :disabled="busy" @click="go()">{{ t('height.go') }}</v-btn>
					</div>
					<div v-if="pointNote" class="text-caption machine-faint mt-1">{{ pointNote }}</div>
				</template>
				<template v-else-if="s === 'lower'">
					<div class="d-flex flex-wrap" style="gap:6px">
						<v-btn v-for="d in steps_dz" :key="d" small outlined :disabled="busy" style="min-width:56px;min-height:44px" @click="jog(d)">{{ (d > 0 ? '+' : '') + d }}</v-btn>
					</div>
					<v-btn color="primary" small class="mt-2" :disabled="busy" @click="mark()">{{ t(kind === 'k0' ? 'height.mark_k0' : 'height.mark_paper', { paper: paper }) }}</v-btn>
				</template>
				<template v-else-if="s === 'measure'">
					<v-btn color="primary" small :disabled="busy" @click="measure()">{{ t('height.measure') }}</v-btn>
				</template>
				<template v-else>
					<div class="text-body-2 mb-1">{{ t('height.measured_text', { med: measured, prev: prevText, mode: view.mode }) }}</div>
					<v-alert v-if="shift.suspicious" dense outlined type="warning" class="mb-2">{{ t('height.shift_warning', { d: shift.diff }) }}</v-alert>
					<v-btn color="primary" small :disabled="busy" @click="$emit('save-k0', record)">{{ t('height.save_k0') }}</v-btn>
				</template>
			</div>
		</div>
		<div v-if="error" class="text-body-2 error--text mt-2">{{ error }}</div>
		<v-btn small text class="mt-2" @click="$emit('close')">{{ t(step >= steps.length ? 'height.close' : 'height.cancel') }}</v-btn>
	</div>
</template>

<script>
'use strict'

// The assistants of the height calibration: BLTouch (bring the tool over the point, lower it to the paper, mark Z0, measure with the probe, save the
// trigger height) and paper (the same without the probe). Every movement is one step of the service (machine.height.step: reserved, refused during a
// job); the numbers and the decisions are in lib/height.js.

import { textMixin } from './text-mixin.js'
import { WIZARD_STEPS, JOG_STEPS, MARK_HEIGHT, clampPoint, k0Record, triggerShift, todayText } from '../lib/height.js'

export default {
	mixins: [textMixin],
	props: {
		api: { type: Object, required: true },
		kind: { type: String, required: true }, // 'k0' | 'paper'
		view: { type: Object, required: true }, // lib/height.js modeView
		reach: { type: Object, default: null },
		z: { type: Number, default: null }, // Z of the tool now (the page reloads it after each jog)
		point: { type: Object, required: true }, // {x, y}
		paper: { type: Number, default: 0.1 }
	},
	data() {
		return { step: 0, busy: false, error: '', measured: null, px: String(this.point.x), py: String(this.point.y), pointNote: '', steps_dz: JOG_STEPS }
	},
	computed: {
		steps() {
			return WIZARD_STEPS[this.kind]
		},
		shift() {
			return this.measured === null ? { diff: null, suspicious: false } : triggerShift(this.measured, this.view.probe)
		},
		prevText() {
			return this.view.probe && this.view.probe.triggerHeight !== null ? String(this.view.probe.triggerHeight) : '--'
		},
		record() {
			return this.measured === null ? null : k0Record(this.measured, this.view.probe, todayText())
		}
	},
	methods: {
		stepText(s) {
			return this.t('height.step_' + s, { z: this.z === null ? '--' : this.z, x: this.px, y: this.py })
		},
		// one step of the service; the answer is the next thing to do
		async run(action, args) {
			this.busy = true
			this.error = ''
			try {
				const r = await this.api.height.step(action, args)
				this.$emit('moved')
				return r
			} catch (e) {
				this.error = String((e && e.message) || e)
				return null
			} finally {
				this.busy = false
			}
		},
		async go() {
			const p = clampPoint({ x: this.px, y: this.py }, this.reach)
			this.px = String(p.x)
			this.py = String(p.y)
			this.pointNote = p.clamped ? this.t('height.point_clamped') : ''
			if (await this.run('goto', { x: p.x, y: p.y })) this.step = 1
		},
		async jog(d) {
			await this.run('jog', { dz: d })
		},
		async mark() {
			if (!(await this.run('mark', { paper: this.paper, h: MARK_HEIGHT }))) return
			if (this.kind === 'paper') {
				this.step = this.steps.length
				this.$emit('marked')
			} else {
				this.step = 2
			}
		},
		async measure() {
			const r = await this.run('measure', { x: Number(this.px), y: Number(this.py) })
			if (r && r.measured !== null) {
				this.measured = r.measured
				this.step = 3
			}
		}
	}
}
</script>

<style>
.height-step { padding: 6px 0 6px 4px; opacity: 0.6; }
.height-step.cur { opacity: 1; }
.height-actions { margin: 6px 0 4px 30px; }
.height-n { display: inline-flex; width: 22px; height: 22px; border-radius: 50%; align-items: center; justify-content: center; background: rgba(144, 202, 249, 0.25); font-size: 12px; }
.height-field { max-width: 120px; }
</style>
