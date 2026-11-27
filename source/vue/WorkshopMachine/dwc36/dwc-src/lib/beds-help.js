'use strict'

// The help of a bed card (the heater assistant and the Edit form of a bed): ONE fold per card with what the card's fields mean, in the order of the form, instead of a "?" next
// to each field. Pure over the translator `t` (the plugin catalog, `beds.help.<topic>_<part>`). Each item is { title, what, why, ifMissing, how } for <help-fold :items>.
//   bedHelpItems(bed, t)   the assistant's card of one bed to define: its sensor type decides which extra fields exist, so which help is listed
//   editHelpItems(t)       the Edit form of a bed the board already has (heater, sensor)

const PARTS = [['what', 'what'], ['why', 'why'], ['ifMissing', 'missing'], ['how', 'how']]

function item(t, title, prefix) {
	const out = { title }
	PARTS.forEach(([name, part]) => { out[name] = t('beds.help.' + prefix + '_' + part) })
	return out
}

// the extra fields of each sensor type: [label key, help topic]
function sensorExtras(bed) {
	switch (bed.sensorPreset) {
		case 'thermistor': return bed.thermistorKind === 'custom' ? [['f_therm_c', 'therm_c']] : []
		case 'tc_max31856': return [['f_tc_type', 'tc_type'], ['f_mains', 'mains']]
		case 'pt100': return [['f_wires', 'wires'], ['f_rtd_ref', 'rtd_ref'], ['f_mains', 'mains']]
		case 'linear_analog': return [['f_analog_low', 'analog_range'], ['f_analog_filtered', 'analog_filtered']]
		default: return []
	}
}

export function bedHelpItems(bed, t) {
	const items = [item(t, t('beds.f_bed'), 'bed')]
	items.push(item(t, t('beds.preset_' + bed.sensorPreset), 'sensor_' + bed.sensorPreset))
	sensorExtras(bed).forEach(([label, topic]) => {
		// the low and the high end of the analog range share one explanation
		const title = topic === 'analog_range' ? t('beds.f_analog_low') + ' / ' + t('beds.f_analog_high') : t('beds.' + label)
		items.push(item(t, title, topic))
	})
	items.push(item(t, t('beds.f_pins'), 'pins'))
	items.push(item(t, t('beds.f_output_pin'), 'output'))
	items.push(item(t, t('beds.f_output_kind'), 'kind'))
	items.push(item(t, t('beds.f_max_temp'), 'max'))
	return items
}

export function editHelpItems(t) {
	return [item(t, t('beds.edit_f_heater'), 'edit_heater'), item(t, t('beds.edit_f_sensor'), 'edit_sensor')]
}
