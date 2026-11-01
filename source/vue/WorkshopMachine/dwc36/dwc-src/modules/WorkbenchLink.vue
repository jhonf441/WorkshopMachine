<template>
	<v-btn v-if="exists" small outlined :title="t('offsets.edit_in_workbench_tip')" @click="go()"><v-icon small left>mdi-grid-large</v-icon>{{ t('offsets.edit_in_workbench') }}</v-btn>
</template>

<script>
'use strict'

// "Edit in the Workbench": the work offsets G54..G59.3 are the work zones of the Workbench (WorkshopWorkbench), so this page offers the
// way there instead of an editor (the Offsets module and the detail of an offsets.snapshot record). Rule of the family: a plugin that refers
// to another one shows nothing about it when the other one is not installed or not enabled (the button is hidden, not disabled).

import { textMixin } from './text-mixin.js'
import { pluginActive } from '../workshop-ids.js' // vue/_shared36
import { workbenchZonesRoute } from '../lib/cross-page.js'

export default {
	mixins: [textMixin],
	props: {
		zone: { type: String, default: '' } // the work system (G54..G59.3) the Workbench opens on; empty = the Zones tab only
	},
	computed: {
		// the plugin lists, not the route: DWC 3.6 cannot remove the route of a plugin that was stopped
		exists() {
			return pluginActive(this.$store, 'workbench')
		}
	},
	methods: {
		go() {
			const p = this.$router ? this.$router.push(workbenchZonesRoute(this.zone)) : null
			if (p && typeof p.catch === 'function') p.catch(() => {})
		}
	}
}
</script>
