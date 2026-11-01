'use strict'

// t('group.key', params): the text of this plugin in the language of DWC (plugins.WorkshopMachine.<group>.<key>).
// The keys that pure modules return (textKey, labelKey, reasonKey...) are relative to the same root.
//
// tx('group.key', params): the same for a text that names another plugin (lib/plugin-texts.js): when that plugin is not installed or not
// enabled the variant without its name is shown. Reactive (pluginActive reads the model and the enabled list of the store).

import { pluginActive } from '../workshop-ids.js' // vue/_shared36
import { textKey } from '../lib/plugin-texts.js'

export const textMixin = {
	methods: {
		t(key, params) {
			return this.$t('plugins.WorkshopMachine.' + key, params)
		},
		tx(key, params) {
			return this.t(textKey(key, name => pluginActive(this.$store, name)), params)
		}
	}
}
