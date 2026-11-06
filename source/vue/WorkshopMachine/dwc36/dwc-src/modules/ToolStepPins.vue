<template>
	<div class="tool-step-pins">
		<div class="text-h6 mb-1">{{ t('toolwiz.pins_title') }}</div>
		<p class="text-body-2 machine-faint">{{ t('toolwiz.pins_intro') }}</p>
		<v-alert v-if="!slots.length" dense outlined type="info">{{ t('toolwiz.pins_none') }}</v-alert>
		<tool-row v-for="s in slots" :key="s.id" :label="slotLabel(s)" :topic="s.role === 'sensor' ? 'pin_sensor' : 'pin'" :field="s.id" :issues="issues" :show="show">
			<v-select
				:value="s.value" :items="optionsOf(s)" dense outlined hide-details :placeholder="t('toolwiz.pin_pick')" :error="show && !s.value"
				:no-data-text="t('toolwiz.pin_no_free')" @change="choose(s.id, $event)"
			/>
			<div v-if="s.preset" class="text-caption machine-faint">{{ t('toolwiz.pin_for_preset', { preset: t('toolwiz.preset_' + s.preset) }) }}</div>
		</tool-row>
		<v-expansion-panels v-if="pins.used.length" flat class="mt-2">
			<v-expansion-panel>
				<v-expansion-panel-header class="text-body-2">{{ t('toolwiz.pins_used_title', { n: pins.used.length }) }}</v-expansion-panel-header>
				<v-expansion-panel-content>
					<div class="text-caption machine-faint mb-1">{{ t('toolwiz.pins_used_note') }}</div>
					<v-chip v-for="u in pins.used" :key="u.pin" small outlined color="error" class="mr-1 mb-1"><code>{{ u.pin }}</code>&nbsp;{{ u.by }}</v-chip>
				</v-expansion-panel-content>
			</v-expansion-panel>
		</v-expansion-panels>
	</div>
</template>

<script>
'use strict'

import ToolRow from './ToolRow.vue'
import { textMixin } from './text-mixin.js'
import { pinSlots, pinOptions, setPin } from '../lib/toolwiz-pins.js'
import { pinOptionText } from '../lib/pin-kinds.js'

export default {
	mixins: [textMixin],
	components: { ToolRow },
	props: { w: { type: Object, required: true }, ctx: { type: Object, required: true }, issues: { type: Array, default: () => [] }, show: { type: Boolean, default: false } },
	computed: {
		pins() {
			return this.ctx.pins
		},
		slots() {
			return pinSlots(this.w.draft)
		}
	},
	methods: {
		slotLabel(s) {
			const m = /(\d+)/.exec(s.id)
			return this.t('toolwiz.slot_' + s.role, { n: m ? Number(m[1]) + 1 : 1 })
		},
		optionsOf(s) {
			return pinOptions(this.pins, s, this.slots).map(p => ({ text: pinOptionText(p.name + (p.board ? ' (' + p.board + ')' : ''), p.capabilities, key => this.t(key)), value: p.pin }))
		},
		choose(id, pin) {
			setPin(this.w.draft, id, pin)
		}
	}
}
</script>
