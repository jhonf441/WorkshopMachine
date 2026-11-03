<template>
	<div class="run-start">
		<!-- DESIGN.md level 3: a motion procedure asks for an explicit tick of the checklist, then the button -->
		<div v-if="allowed" class="mb-2">
			<!-- what the machine answers by itself: nobody ticks it (lib/precheck.js); a failure blocks Start and says why -->
			<div v-if="autoRows.length" class="mb-2 run-auto">
				<div class="text-body-2 font-weight-medium mb-1">{{ t('run.auto_title') }}</div>
				<div v-for="r in autoRows" :key="r.id" class="d-flex align-center text-body-2" :class="r.ok ? '' : 'error--text'" style="gap:6px">
					<v-icon small :color="r.ok ? 'success' : 'error'">{{ r.ok ? 'mdi-check-circle' : 'mdi-close-circle' }}</v-icon><span>{{ r.text }}</span>
				</div>
			</div>
			<div v-if="manualChecks.length" class="text-body-2 font-weight-medium mb-1">{{ t('run.checklist_title') }}</div>
			<v-checkbox v-for="item in manualChecks" :key="item" v-model="ticked[item]" dense hide-details class="mt-0 pt-0" :disabled="busy" :label="t('run.check_' + item)" />
		</div>
		<div class="d-flex align-center flex-wrap" style="gap:8px">
			<v-btn color="primary" :disabled="!ready" :loading="starting" @click="go()">
				<v-icon left>mdi-play</v-icon>{{ starting ? t('run.starting') : label || t('run.start') }}
			</v-btn>
			<span v-if="!allowed" class="text-caption machine-faint">{{ t('run.needs_technician') }}</span>
			<span v-else-if="disabledText" class="text-caption warning--text">{{ disabledText }}</span>
			<span v-else-if="!autoOk" class="text-caption error--text">{{ t('run.auto_blocked') }}</span>
		</div>
	</div>
</template>

<script>
'use strict'

// "Start" with its pre-check list (design 5.1): the person ticks every item and then presses the button. The service still asks its own
// confirmation (level 3, confirm_required) and refuses with the reason when something is not met; this list is the human part.

import { textMixin } from './text-mixin.js'
import { AUTO_CHECKS, homedCheck, probeCheck } from '../lib/precheck.js'

export const DEFAULT_CHECKS = ['homed', 'probe', 'clear', 'bed', 'estop']

export default {
	mixins: [textMixin],
	props: {
		allowed: { type: Boolean, default: false }, // the role may start (technician)
		busy: { type: Boolean, default: false }, // something is running already
		starting: { type: Boolean, default: false },
		disabledText: { type: String, default: '' }, // why it cannot start now (inputs wrong, other run...)
		label: { type: String, default: '' },
		checks: { type: Array, default: () => DEFAULT_CHECKS },
		probe: { type: Number, default: 0 } // the probe the procedure uses (its index in the model)
	},
	data() {
		const ticked = {}
		this.checks.forEach(c => { ticked[c] = false })
		return { ticked }
	},
	computed: {
		// the points of the list that the machine answers by itself are not ticked
		manualChecks() {
			return this.checks.filter(c => AUTO_CHECKS.indexOf(c) < 0)
		},
		model() {
			return (this.$store && this.$store.state && this.$store.state.machine && this.$store.state.machine.model) || null
		},
		autoRows() {
			const rows = []
			if (this.checks.indexOf('homed') >= 0) {
				const h = homedCheck(this.model)
				rows.push({ id: 'homed', ok: h.ok, text: h.ok ? this.t('run.auto_ok_homed', { axes: h.axes.join(', ') }) : this.t('run.auto_bad_' + h.reason, { axes: h.axes.join(', ') }) })
			}
			if (this.checks.indexOf('probe') >= 0) {
				const p = probeCheck(this.model, this.probe)
				rows.push({ id: 'probe', ok: p.ok, text: p.ok ? this.t('run.auto_ok_probe', { n: p.index, type: p.type }) : this.t('run.auto_bad_' + p.reason, { n: p.index }) })
			}
			return rows
		},
		autoOk() {
			return this.autoRows.every(r => r.ok)
		},
		allTicked() {
			return this.manualChecks.every(c => this.ticked[c])
		},
		ready() {
			return this.allowed && !this.busy && !this.disabledText && this.autoOk && this.allTicked
		}
	},
	methods: {
		go() {
			if (!this.ready) return
			this.$emit('start')
			this.checks.forEach(c => { this.ticked[c] = false }) // the next run asks again
		}
	}
}
</script>
