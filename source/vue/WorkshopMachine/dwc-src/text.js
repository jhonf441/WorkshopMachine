'use strict'

// t('group.key', params): the text of this plugin in the language of DWC (plugins.WorkshopMachine.<group>.<key>).
// The keys that pure modules return (textKey, labelKey, reasonKey, errors...) are relative to the same root.
// A page that changes language is loaded again (language-reload.js), so no component has to follow the locale.
//
// tx('group.key', params): the same for a text that names another plugin (lib/plugin-texts.js): when that plugin is not installed or not
// enabled the variant without its name is shown. Reactive (pluginActive reads the model and the enabled list): use it in a template or computed().

import { i18n } from './dwc-host.js'
import { pluginActive } from './workshop-ids.js' // vue/_shared
import { textKey } from './lib/plugin-texts.js'

export function t(key, params) {
	return i18n.t('plugins.WorkshopMachine.' + key, params)
}

export function tx(key, params) {
	return t(textKey(key, pluginActive), params)
}
