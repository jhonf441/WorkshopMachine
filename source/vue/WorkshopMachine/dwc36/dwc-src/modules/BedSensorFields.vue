<template>
	<!-- the extra fields of the chosen sensor type of one zone (the grid of BedsModule lays them out: this root takes no box of its own) -->
	<div class="beds-sensor-fields">
		<div v-if="bed.sensorPreset === 'thermistor'" class="beds-field">
			<div class="beds-label"><label :for="'bd-therm-' + index" class="text-caption">{{ t('beds.f_thermistor_kind') }}</label></div>
			<v-select :id="'bd-therm-' + index" v-model="bed.thermistorKind" :items="thermistorItems" dense outlined hide-details :disabled="disabled" :aria-label="t('beds.f_thermistor_kind')" />
		</div>
		<template v-if="bed.sensorPreset === 'thermistor' && bed.thermistorKind === 'custom'">
			<div class="beds-field">
				<div class="beds-label"><label :for="'bd-tt-' + index" class="text-caption">{{ t('beds.f_therm_t') }}</label></div>
				<v-text-field :id="'bd-tt-' + index" v-model="bed.thermT" dense outlined hide-details inputmode="numeric" :disabled="disabled" :error="shown(index, 'thermT')" :aria-label="t('beds.f_therm_t')" />
				<div v-if="shown(index, 'thermT')" class="text-caption error--text">{{ message(index, 'thermT') }}</div>
			</div>
			<div class="beds-field">
				<div class="beds-label"><label :for="'bd-tb-' + index" class="text-caption">{{ t('beds.f_therm_b') }}</label></div>
				<v-text-field :id="'bd-tb-' + index" v-model="bed.thermB" dense outlined hide-details inputmode="numeric" :disabled="disabled" :error="shown(index, 'thermB')" :aria-label="t('beds.f_therm_b')" />
				<div v-if="shown(index, 'thermB')" class="text-caption error--text">{{ message(index, 'thermB') }}</div>
			</div>
			<div class="beds-field">
				<div class="beds-label"><label :for="'bd-tc-' + index" class="text-caption">{{ t('beds.f_therm_c') }}</label><help-tip :title="t('beds.f_therm_c')" :what="t('beds.help.therm_c_what')" :why="t('beds.help.therm_c_why')" :if-missing="t('beds.help.therm_c_missing')" :how="t('beds.help.therm_c_how')" /></div>
				<v-text-field :id="'bd-tc-' + index" v-model="bed.thermC" dense outlined hide-details placeholder="7.06e-8" :disabled="disabled" :error="shown(index, 'thermC')" :aria-label="t('beds.f_therm_c')" />
				<div v-if="shown(index, 'thermC')" class="text-caption error--text">{{ message(index, 'thermC') }}</div>
			</div>
		</template>
		<template v-if="bed.sensorPreset === 'tc_max31856'">
		<div class="beds-field">
			<div class="beds-label"><label :for="'bd-tct-' + index" class="text-caption">{{ t('beds.f_tc_type') }}</label><help-tip :title="t('beds.f_tc_type')" :what="t('beds.help.tc_type_what')" :why="t('beds.help.tc_type_why')" :if-missing="t('beds.help.tc_type_missing')" :how="t('beds.help.tc_type_how')" /></div>
			<v-select :id="'bd-tct-' + index" v-model="bed.tcType" :items="tcItems" dense outlined hide-details :disabled="disabled" :error="shown(index, 'tcType')" :aria-label="t('beds.f_tc_type')" />
			<div v-if="shown(index, 'tcType')" class="text-caption error--text">{{ message(index, 'tcType') }}</div>
		</div>
		</template>
		<template v-if="bed.sensorPreset === 'pt100'">
		<div class="beds-field">
			<div class="beds-label"><label :for="'bd-wires-' + index" class="text-caption">{{ t('beds.f_wires') }}</label><help-tip :title="t('beds.f_wires')" :what="t('beds.help.wires_what')" :why="t('beds.help.wires_why')" :if-missing="t('beds.help.wires_missing')" :how="t('beds.help.wires_how')" /></div>
			<v-select :id="'bd-wires-' + index" v-model="bed.wires" :items="wiresItems" dense outlined hide-details :disabled="disabled" :error="shown(index, 'wires')" :aria-label="t('beds.f_wires')" />
			<div v-if="shown(index, 'wires')" class="text-caption error--text">{{ message(index, 'wires') }}</div>
		</div>
		<div class="beds-field">
			<div class="beds-label"><label :for="'bd-ref-' + index" class="text-caption">{{ t('beds.f_rtd_ref') }}</label><help-tip :title="t('beds.f_rtd_ref')" :what="t('beds.help.rtd_ref_what')" :why="t('beds.help.rtd_ref_why')" :if-missing="t('beds.help.rtd_ref_missing')" :how="t('beds.help.rtd_ref_how')" /></div>
			<v-text-field :id="'bd-ref-' + index" v-model="bed.rtdRef" dense outlined hide-details inputmode="decimal" :placeholder="t('beds.rtd_ref_default')" :disabled="disabled" :error="shown(index, 'rtdRef')" :aria-label="t('beds.f_rtd_ref')" />
			<div v-if="shown(index, 'rtdRef')" class="text-caption error--text">{{ message(index, 'rtdRef') }}</div>
		</div>
		</template>
		<template v-if="bed.sensorPreset === 'tc_max31856' || bed.sensorPreset === 'pt100'">
		<div class="beds-field">
			<div class="beds-label"><label :for="'bd-mains-' + index" class="text-caption">{{ t('beds.f_mains') }}</label><help-tip :title="t('beds.f_mains')" :what="t('beds.help.mains_what')" :why="t('beds.help.mains_why')" :if-missing="t('beds.help.mains_missing')" :how="t('beds.help.mains_how')" /></div>
			<v-select :id="'bd-mains-' + index" v-model="bed.mains" :items="mainsItems" dense outlined hide-details :disabled="disabled" :error="shown(index, 'mains')" :aria-label="t('beds.f_mains')" />
			<div v-if="shown(index, 'mains')" class="text-caption error--text">{{ message(index, 'mains') }}</div>
		</div>
		</template>
		<template v-if="bed.sensorPreset === 'linear_analog'">
		<div class="beds-field">
			<div class="beds-label"><label :for="'bd-alow-' + index" class="text-caption">{{ t('beds.f_analog_low') }}</label><help-tip :title="t('beds.f_analog_low')" :what="t('beds.help.analog_range_what')" :why="t('beds.help.analog_range_why')" :if-missing="t('beds.help.analog_range_missing')" :how="t('beds.help.analog_range_how')" /></div>
			<v-text-field :id="'bd-alow-' + index" v-model="bed.analogLow" dense outlined hide-details inputmode="decimal" :disabled="disabled" :error="shown(index, 'analogLow')" :aria-label="t('beds.f_analog_low')" />
			<div v-if="shown(index, 'analogLow')" class="text-caption error--text">{{ message(index, 'analogLow') }}</div>
		</div>
		<div class="beds-field">
			<div class="beds-label"><label :for="'bd-ahigh-' + index" class="text-caption">{{ t('beds.f_analog_high') }}</label><help-tip :title="t('beds.f_analog_high')" :what="t('beds.help.analog_range_what')" :why="t('beds.help.analog_range_why')" :if-missing="t('beds.help.analog_range_missing')" :how="t('beds.help.analog_range_how')" /></div>
			<v-text-field :id="'bd-ahigh-' + index" v-model="bed.analogHigh" dense outlined hide-details inputmode="decimal" :disabled="disabled" :error="shown(index, 'analogHigh')" :aria-label="t('beds.f_analog_high')" />
			<div v-if="shown(index, 'analogHigh')" class="text-caption error--text">{{ message(index, 'analogHigh') }}</div>
		</div>
		<div class="beds-field">
			<div class="beds-label"><label :for="'bd-afilt-' + index" class="text-caption">{{ t('beds.f_analog_filtered') }}</label><help-tip :title="t('beds.f_analog_filtered')" :what="t('beds.help.analog_filtered_what')" :why="t('beds.help.analog_filtered_why')" :if-missing="t('beds.help.analog_filtered_missing')" :how="t('beds.help.analog_filtered_how')" /></div>
			<v-checkbox :id="'bd-afilt-' + index" v-model="bed.analogFiltered" dense hide-details class="mt-0 pt-1" :disabled="disabled" :error="shown(index, 'analogFiltered')" :label="t('beds.f_analog_filtered')" />
			<div v-if="shown(index, 'analogFiltered')" class="text-caption error--text">{{ message(index, 'analogFiltered') }}</div>
		</div>
		</template>
	</div>
</template>

<script>
import HelpTip from '../HelpTip.vue' // vue/_shared36
import { textMixin } from './text-mixin.js'
import { THERMISTOR_KINDS, TC_TYPES, MAINS_HZ, RTD_WIRES } from '../lib/beds-spec.js'

export default {
	mixins: [textMixin],
	components: { HelpTip },
	props: {
		bed: { type: Object, required: true }, // the draft row (the fields are edited in place, like the rest of the form)
		index: { type: Number, required: true },
		disabled: { type: Boolean, default: false },
		shown: { type: Function, required: true }, // (row, key) -> whether the message of that field is shown
		message: { type: Function, required: true } // (row, key) -> the message of that field
	},
	computed: {
		thermistorItems() {
			return THERMISTOR_KINDS.map(k => ({ value: k, text: this.t('beds.therm_' + k) }))
		},
		tcItems() {
			return Object.keys(TC_TYPES).map(k => ({ value: k, text: this.t('beds.tc_option', { letter: k, alloy: TC_TYPES[k] }) }))
		},
		mainsItems() {
			return MAINS_HZ.map(hz => ({ value: String(hz), text: this.t('beds.mains_option', { hz }) }))
		},
		wiresItems() {
			return RTD_WIRES.map(n => ({ value: String(n), text: this.t('beds.wires_option', { n }) }))
		}
	}
}
</script>

<style scoped>
.beds-sensor-fields { display: contents; }
.beds-field { min-width: 0; display: flex; flex-direction: column; }
.beds-label { display: flex; align-items: center; gap: 4px; min-height: 28px; }
</style>
