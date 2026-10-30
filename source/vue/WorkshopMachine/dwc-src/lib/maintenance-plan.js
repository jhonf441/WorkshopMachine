'use strict'

// Editing the maintenance plan (technician, machine.maintenance.plan.set): draft items and checks that mirror the service's
// (dsf/machine_profile.py _m_maintenance) so the person sees a problem before sending. Pure.
// Draft item: {id, label, axis, unit, value, basis} with text fields as typed; `basis` ('power_on' | 'moving') matters for the hours only.

export const UNITS = ['hours', 'km', 'days']
export const BASES = ['power_on', 'moving']
export const AXES = ['', 'X', 'Y', 'Z', 'U', 'V', 'W', 'A', 'B', 'C']
export const MAX_ITEMS = 40
export const ID_RX = /^[a-z][a-z0-9_.-]{0,39}$/

// error codes -> keys maintenance.err_<code>
export const ERROR_CODES = ['id', 'duplicate', 'label', 'value', 'too_many']

export function errorKey(code) {
	return 'maintenance.err_' + (ERROR_CODES.indexOf(code) >= 0 ? code : 'id')
}

// `labelText`: the name to show when the item has none of its own (a default item's translated name)
export function draftFromItem(item, labelText) {
	return {
		id: item.id, label: item.label || labelText || '', axis: item.axis || '', unit: item.interval.unit, value: String(item.interval.value || ''),
		basis: item.interval.basis === 'moving' ? 'moving' : 'power_on'
	}
}

export function newDraft() {
	return { id: '', label: '', axis: '', unit: 'hours', value: '', basis: 'power_on' }
}

export function parseValue(text) {
	const n = Number(String(text).replace(',', '.'))
	return String(text).trim() !== '' && isFinite(n) && n >= 0.01 && n <= 1000000 ? n : null
}

// -> [{row, code}] one entry per problem found
export function draftErrors(drafts) {
	const errors = []
	const seen = new Set()
	if (drafts.length > MAX_ITEMS) errors.push({ row: -1, code: 'too_many' })
	drafts.forEach((d, row) => {
		if (!ID_RX.test(d.id)) errors.push({ row, code: 'id' })
		else if (seen.has(d.id)) errors.push({ row, code: 'duplicate' })
		seen.add(d.id)
		if (String(d.label).length > 80 || !String(d.label).trim()) errors.push({ row, code: 'label' })
		if (parseValue(d.value) === null) errors.push({ row, code: 'value' })
	})
	return errors
}

// the drafts as plan items (api/machine-api-p4.js itemToService takes them)
export function itemsFromDrafts(drafts) {
	return drafts.map(d => ({
		id: d.id, label: String(d.label).trim(), axis: d.axis || null, hoursBasis: d.basis,
		everyHours: d.unit === 'hours' ? parseValue(d.value) : null, everyKm: d.unit === 'km' ? parseValue(d.value) : null, everyDays: d.unit === 'days' ? parseValue(d.value) : null
	}))
}

export function isChanged(drafts, original) {
	return JSON.stringify(drafts) !== JSON.stringify(original)
}
