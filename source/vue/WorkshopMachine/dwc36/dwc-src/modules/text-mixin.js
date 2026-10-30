'use strict'

// t('group.key', params): the text of this plugin in the language of DWC (plugins.WorkshopMachine.<group>.<key>).
// The keys that pure modules return (textKey, labelKey, reasonKey...) are relative to the same root.

export const textMixin = {
	methods: {
		t(key, params) {
			return this.$t('plugins.WorkshopMachine.' + key, params)
		}
	}
}
