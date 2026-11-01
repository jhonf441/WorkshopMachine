'use strict'

// Rule of the family: a plugin that refers to another one shows nothing about it (no button, link, text or card: hidden, not
// disabled) when the other one is not installed or not enabled in DWC. A text of this page that names another plugin has a variant
// WITHOUT the name for the case the plugin is missing; this module says which variant to show. Pure: the page tells which plugins are
// active (workshop-ids.js pluginActive) and the text is looked up with the key that comes back.
//
// TEXT_VARIANTS: the key of the full text -> { <missing plugins, sorted, joined with '+'>: key of the variant }. The plugin names are the
// keys of IDS in workshop-ids.js. The keys are written out (not built) so a test finds every one of them in both catalogs.

export const TEXT_VARIANTS = {
	'offsets.intro': { workbench: 'offsets.intro_no_workbench' },
	'offsets.work_hint': { workbench: 'offsets.work_hint_no_workbench' },
	'offsets.restore_hint': { workbench: 'offsets.restore_hint_no_workbench' },
	'offsets.pointer_step_2': { jog: 'offsets.pointer_step_2_no_jog' },
	'offsets.pointer_saved': {
		jog: 'offsets.pointer_saved_no_jog',
		workbench: 'offsets.pointer_saved_no_workbench',
		'jog+workbench': 'offsets.pointer_saved_no_jog_no_workbench'
	},
	'history.reason_work_offsets_in_workbench': { workbench: 'history.reason_work_offsets_in_workbench_no_workbench' },
	'height.block_macro_missing': { workbench: 'height.block_macro_missing_no_workbench' },
	'workarea.intro': { workbench: 'workarea.intro_no_workbench' },
	'workarea.macros_missing': { workbench: 'workarea.macros_missing_no_workbench' },
	'workarea.block_macro_missing': { workbench: 'workarea.block_macro_missing_no_workbench' },
	'modes.fff_about': { printing: 'modes.fff_about_no_printing' }
}

// the plugins a text names (the keys of IDS), from its variants
export function namesOf(key) {
	const v = TEXT_VARIANTS[key]
	if (!v) return []
	const names = []
	Object.keys(v).forEach(k => k.split('+').forEach(n => { if (names.indexOf(n) < 0) names.push(n) }))
	return names.sort()
}

// the key to show: `key` itself when every plugin it names is active (or it names none), else its variant for the ones that are missing.
// active(name) -> boolean, normally n => pluginActive(n)
export function textKey(key, active) {
	const v = TEXT_VARIANTS[key]
	if (!v) return key
	const missing = namesOf(key).filter(n => !active(n)).join('+')
	return missing ? v[missing] || key : key
}

// a built-in plugin of DWC itself (HeightMap) is not in the machine model: it is enabled when the global list of DWC settings has it.
// list = that list (3.7: the settings store; 3.6: store.state.settings.enabledPlugins); not loaded yet = do not hide.
export const HEIGHT_MAP_ID = 'HeightMap'

export function builtinEnabled(list, id) {
	if (!Array.isArray(list)) return true
	const want = String(id).toLowerCase()
	return list.some(p => String(p).toLowerCase() === want)
}
