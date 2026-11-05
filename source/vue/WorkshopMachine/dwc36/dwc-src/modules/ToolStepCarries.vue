<template>
	<div class="tool-step-carries">
		<div class="text-h6 mb-1">{{ t('toolwiz.carries_title') }}</div>
		<p class="text-body-2 machine-faint">{{ t('toolwiz.carries_intro', { type: t('toolwiz.type_' + d.type) }) }}</p>

		<tool-row v-if="info.drive" :label="t('toolwiz.driver_row')" topic="driver" field="driver" :issues="issues" :show="show">
			<v-select v-if="ctx.freeDrivers" v-model="d.driver" :items="ctx.freeDrivers" dense outlined hide-details style="max-width: 200px" :placeholder="t('toolwiz.driver_pick')" />
			<v-text-field v-else v-model="d.driver" dense outlined hide-details style="max-width: 200px" placeholder="0.3" />
		</tool-row>

		<template v-if="info.output">
			<tool-row :label="t('toolwiz.output_row')" topic="output" field="output.*" :issues="issues" :show="show">
				<div class="d-flex flex-wrap align-center" style="gap: 12px">
					<v-text-field v-model="d.output.freq" type="number" :label="t('toolwiz.freq')" suffix="Hz" dense outlined hide-details style="max-width: 160px" @keydown="blockKey" />
					<v-switch v-model="d.output.inverted" :label="t('toolwiz.inverted')" dense hide-details class="mt-0" />
				</div>
			</tool-row>
			<tool-row v-if="d.type === 'spindle'" :label="t('toolwiz.rpm_row')" topic="rpm" field="rpm_max" :issues="issues" :show="show">
				<v-text-field v-model="d.rpmMax" type="number" suffix="rpm" dense outlined hide-details style="max-width: 200px" @keydown="blockKey" />
			</tool-row>
			<tool-row v-if="d.type === 'laser'" :label="t('toolwiz.power_row')" topic="power" field="power_max" :issues="issues" :show="show">
				<v-text-field v-model="d.powerMax" type="number" suffix="%" dense outlined hide-details style="max-width: 200px" @keydown="blockKey" />
			</tool-row>
		</template>

		<div v-if="info.heaters" class="mt-4">
			<div class="d-flex align-center flex-wrap" style="gap: 8px">
				<div class="text-subtitle-1 font-weight-medium"><v-icon small color="error" class="mr-1">mdi-fire</v-icon>{{ t('toolwiz.heaters_title') }}</div>
				<v-btn small outlined color="primary" :disabled="d.heaters.length >= info.heaters || !!w.applied" @click="add('heaters')"><v-icon small left>mdi-plus</v-icon>{{ t('toolwiz.add_heater') }}</v-btn>
			</div>
			<v-alert dense outlined type="warning" class="mt-2 text-body-2">{{ t('toolwiz.heaters_rule') }}</v-alert>
			<div class="toolwiz-cards toolwiz-cards--wide mt-2">
				<tool-choice-card v-for="(h, i) in d.heaters" :key="'h' + i" accent="#e53935">
					<div class="d-flex align-center mb-1">
						<span class="text-subtitle-2 flex-grow-1">{{ t('toolwiz.heater_n', { n: i + 1 }) }}</span>
						<v-btn small icon :title="t('toolwiz.remove')" @click="remove('heaters', i)"><v-icon small>mdi-delete-outline</v-icon></v-btn>
					</div>
					<tool-row :label="t('toolwiz.sensor_row')" topic="sensor" :field="'heater.' + i + '.sensor'" :issues="issues" :show="show">
						<v-select v-model="h.sensorPreset" :items="presetItems" dense outlined hide-details :placeholder="t('toolwiz.sensor_pick')" :error="show && !h.sensorPreset" />
					</tool-row>
					<tool-row :label="t('toolwiz.max_row')" topic="maxtemp" :field="'heater.' + i + '.max'" :issues="issues" :show="show">
						<div style="max-width: 200px">
							<v-text-field v-model="h.maxTemp" type="number" suffix="C" dense outlined hide-details @keydown="blockKey" />
							<div class="wf-field-msg is-hint">{{ hintOf(h) }}</div>
						</div>
					</tool-row>
				</tool-choice-card>
			</div>
			<div v-if="!d.heaters.length" class="text-caption machine-faint">{{ t('toolwiz.heaters_none') }}</div>
		</div>

		<div v-if="info.sensors > info.heaters" class="mt-4">
			<div class="d-flex align-center flex-wrap" style="gap: 8px">
				<div class="text-subtitle-1 font-weight-medium"><v-icon small color="info" class="mr-1">mdi-thermometer</v-icon>{{ t('toolwiz.sensors_title') }}</div>
				<v-btn small outlined color="primary" :disabled="d.sensors.length >= info.sensors || !!w.applied" @click="add('sensors')"><v-icon small left>mdi-plus</v-icon>{{ t('toolwiz.add_sensor') }}</v-btn>
			</div>
			<div class="toolwiz-cards toolwiz-cards--wide mt-2">
				<tool-choice-card v-for="(s, i) in d.sensors" :key="'s' + i" accent="#1e88e5">
					<div class="d-flex align-center mb-1">
						<span class="text-subtitle-2 flex-grow-1">{{ t('toolwiz.sensor_n', { n: i + 1 }) }}</span>
						<v-btn small icon :title="t('toolwiz.remove')" @click="remove('sensors', i)"><v-icon small>mdi-delete-outline</v-icon></v-btn>
					</div>
					<tool-row :label="t('toolwiz.sensor_row')" topic="sensor" :field="'sensor.' + i + '.preset'" :issues="issues" :show="show">
						<v-select v-model="s.preset" :items="presetItems" dense outlined hide-details :placeholder="t('toolwiz.sensor_pick')" />
					</tool-row>
				</tool-choice-card>
			</div>
		</div>

		<div v-if="info.fans" class="mt-4">
			<div class="d-flex align-center flex-wrap" style="gap: 8px">
				<div class="text-subtitle-1 font-weight-medium"><v-icon small color="teal" class="mr-1">mdi-fan</v-icon>{{ t('toolwiz.fans_title') }}</div>
				<v-btn small outlined color="primary" :disabled="d.fans.length >= info.fans || !!w.applied" @click="add('fans')"><v-icon small left>mdi-plus</v-icon>{{ t('toolwiz.add_fan') }}</v-btn>
			</div>
			<div class="toolwiz-cards toolwiz-cards--wide mt-2">
				<tool-choice-card v-for="(f, i) in d.fans" :key="'f' + i" accent="#00897b">
					<div class="d-flex align-center mb-1">
						<span class="text-subtitle-2 flex-grow-1">{{ t('toolwiz.fan_n', { n: i + 1 }) }}</span>
						<v-btn small icon :title="t('toolwiz.remove')" @click="remove('fans', i)"><v-icon small>mdi-delete-outline</v-icon></v-btn>
					</div>
					<tool-row :label="t('toolwiz.fan_row')" topic="fan" :field="'fan.' + i + '.freq'" :issues="issues" :show="show">
						<div class="d-flex flex-wrap align-center" style="gap: 12px">
							<v-text-field v-model="f.freq" type="number" :label="t('toolwiz.freq')" suffix="Hz" dense outlined hide-details style="max-width: 160px" @keydown="blockKey" />
							<v-switch v-model="f.inverted" :label="t('toolwiz.inverted')" dense hide-details class="mt-0" />
						</div>
					</tool-row>
				</tool-choice-card>
			</div>
		</div>
	</div>
</template>

<script>
'use strict'

import ToolRow from './ToolRow.vue'
import ToolChoiceCard from './ToolChoiceCard.vue'
import { textMixin } from './text-mixin.js'
import { blockKey } from '../lib/number-field.js'
import { SENSOR_PRESETS, presetOf, typeInfo } from '../lib/toolwiz-spec.js'
import { addItem, removeItem } from '../state/toolwiz-state.js'

export default {
	mixins: [textMixin],
	components: { ToolRow, ToolChoiceCard },
	props: { w: { type: Object, required: true }, ctx: { type: Object, required: true }, issues: { type: Array, default: () => [] }, show: { type: Boolean, default: false } },
	computed: {
		d() {
			return this.w.draft
		},
		info() {
			return typeInfo(this.w.draft.type) || { drive: false, heaters: 0, fans: 0, sensors: 0, output: false }
		},
		presetItems() {
			return SENSOR_PRESETS.map(p => ({ text: this.t('toolwiz.preset_' + p.id), value: p.id }))
		}
	},
	methods: {
		blockKey,
		add(kind) {
			addItem(this.w, kind)
		},
		remove(kind, i) {
			removeItem(this.w, kind, i)
		},
		hintOf(h) {
			const p = presetOf(h.sensorPreset)
			return p ? this.t('toolwiz.max_hint', { n: p.hint }) : this.t('toolwiz.max_hint_none')
		}
	}
}
</script>
