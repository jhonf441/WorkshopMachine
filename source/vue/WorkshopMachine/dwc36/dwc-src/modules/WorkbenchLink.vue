<template>
	<div v-if="exists" class="d-flex align-center flex-wrap" style="gap:8px">
		<v-btn small outlined :disabled="closed" :title="t('offsets.edit_in_workbench_tip')" @click="go()"><v-icon small left>mdi-grid-large</v-icon>{{ t('offsets.edit_in_workbench') }}</v-btn>
		<!-- the reason is written next to the disabled button: a disabled button shows no tooltip on touch screens -->
		<span v-if="closed" class="text-caption machine-faint">{{ t('offsets.edit_in_workbench_closed', { mode }) }}</span>
	</div>
</template>

<script>
'use strict'

// "Edit in the Workbench": the work offsets G54..G59.3 are the work zones of the Workbench (WorkshopWorkbench), so this page offers the
// way there instead of an editor (the Offsets module and the detail of an offsets.snapshot record). Rule of the family: a plugin that refers
// to another one shows nothing about it when the other one is not installed or not enabled (the button is hidden, not disabled).
// The Workbench page only opens in Laser or CNC mode: while the machine is in another one the button is disabled and says why (the Workbench
// would only show its "this is not for 3D printing" panel).

import { textMixin } from './text-mixin.js'
import { pluginActive } from '../workshop-ids.js' // vue/_shared36
import { currentMode, workbenchClosedIn } from '../current-mode.js' // vue/_shared36
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
		},
		mode() {
			const s = this.$store && this.$store.state
			return currentMode(s && s.machine && s.machine.model)
		},
		closed() {
			return workbenchClosedIn(this.mode)
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
