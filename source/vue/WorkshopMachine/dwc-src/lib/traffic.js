'use strict'

// Overview card logic (design 2.1): traffic lights per kind of calibration and the readiness list. Pure.

// the kinds the card always lists (the service also reports "never" for the ones without a record); label keys under `kinds.`
export const CARD_KINDS = ['probe.repeat', 'level.g32', 'mesh.probe']

const COLORS = { ok: 'success', old: 'warning', never: 'grey' }
const ICONS = { ok: 'mdi-check-circle', old: 'mdi-alert', never: 'mdi-help-circle-outline' }

// colour is never the only signal: the icon and the text key change with the light too
export function lightView(entry) {
	const light = entry && COLORS[entry.light] ? entry.light : 'never'
	return { light, color: COLORS[light], icon: ICONS[light], textKey: 'overview.light_' + light, ageDays: entry ? entry.ageDays : null }
}

// [{kind, labelKey, light, color, icon, textKey, ageDays}] for the card kinds followed by any other kind the service reports
export function kindRows(overview) {
	const kinds = (overview && overview.kinds) || {}
	const order = CARD_KINDS.concat(Object.keys(kinds).filter(k => CARD_KINDS.indexOf(k) < 0).sort())
	return order.map(kind => Object.assign({ kind, labelKey: 'kinds.' + kind.replace('.', '_') }, lightView(kinds[kind])))
}

// the readiness list: [{id, ok, textKey}]; `ok` null means "does not apply" (shown with its reason, never hidden)
export function readyItems(overview) {
	const r = (overview && overview.ready) || {}
	return [
		{ id: 'homed', ok: !!r.homed },
		{ id: 'probe', ok: !!r.probe },
		{ id: 'mesh', ok: !!r.meshActive },
		{ id: 'kinematics', ok: r.kinematicsSupported !== false }
	].map(i => Object.assign(i, { textKey: 'overview.ready_' + i.id + (i.ok ? '_yes' : '_no') }))
}

// the worst light of the card kinds, for the header chip: old > never > ok
export function worstLight(overview) {
	const rows = kindRows(overview).filter(r => CARD_KINDS.indexOf(r.kind) >= 0)
	if (rows.some(r => r.light === 'old')) return 'old'
	if (rows.some(r => r.light === 'never')) return 'never'
	return 'ok'
}
