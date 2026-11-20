'use strict'

// The modes a tool or a bed heater created from the page exists in (CAMBIO-CONFIG-INCLUDE). Pure.
// The service keeps them in sys/workshop/machine.g: the value of global.selectedMode ('FFF', 'Laser', 'CNC').

export const MODE_IDS = ['FFF', 'Laser', 'CNC']

// 'fff' | 'FFF' | 'laser' ... -> the id of the mode, or null when it is not one (an empty text: the machine mode is unknown)
export function modeOf(text) {
	const t = String(text || '').trim().toLowerCase()
	return MODE_IDS.find(m => m.toLowerCase() === t) || null
}

// the `modes` of a spec: only when it is NOT every mode (the service reads a missing value as every mode); a list that is empty is a check that stops the person
export function specModes(modes) {
	if (!Array.isArray(modes) || modes.length === 0 || modes.length >= MODE_IDS.length) return null
	return MODE_IDS.filter(m => modes.indexOf(m) >= 0)
}

export function checkModes(modes) {
	return Array.isArray(modes) && modes.length === 0 ? [{ field: 'modes', code: 'modes_none' }] : []
}

// where a tool of machine.g exists: the modes written in its block, else every mode
export function modesText(modes, nameOf) {
	return Array.isArray(modes) && modes.length ? modes.map(nameOf).join(', ') : ''
}
