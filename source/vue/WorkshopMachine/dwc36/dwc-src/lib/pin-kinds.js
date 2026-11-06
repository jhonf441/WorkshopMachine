'use strict'

// What a pin of the board can do, in a short text: the lists of pins show the name of the pin and this text, never the raw capabilities
// ("io0.in - digital/adc"). machine.tool.pins gives each pin its capabilities; the most specific one names it (a temperature input is also analog,
// a servo output is also PWM). The texts are the keys common.pin_kind_<kind> (es.json and en.json). Pure.

export const PIN_KINDS = ['temp', 'spi', 'servo', 'pwm', 'adc', 'digital']

// the kind that names a pin, from its capabilities; '' when it has none of the known ones
export function pinKind(capabilities) {
	const caps = Array.isArray(capabilities) ? capabilities : []
	return PIN_KINDS.find(k => caps.indexOf(k) >= 0) || ''
}

// the text key of a pin kind, relative to the plugin texts ('' for a pin that has none)
export function pinKindKey(capabilities) {
	const kind = pinKind(capabilities)
	return kind ? 'common.pin_kind_' + kind : ''
}

// the text of an option of a pin list: the pin and what it is ("temp2 - temperature input"); `t` turns a text key into the text of the language
export function pinOptionText(name, capabilities, t) {
	const key = pinKindKey(capabilities)
	return key ? name + ' - ' + t(key) : name
}
