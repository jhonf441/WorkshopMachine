'use strict'

// t('group.key', params): the text of this plugin in the language of DWC (plugins.WorkshopMachine.<group>.<key>).
// The keys that pure modules return (textKey, labelKey, reasonKey...) are relative to the same root.
// A page that changes language is loaded again (language-reload.js), so no component has to follow the locale.

import { i18n } from './dwc-host.js'

export function t(key, params) {
	return i18n.t('plugins.WorkshopMachine.' + key, params)
}
