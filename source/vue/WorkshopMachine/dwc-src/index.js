'use strict'

// WorkshopMachine v2 -- "Machine" page (development source, see ../README.md). Calibration procedures run in the
// WorkshopService backend (machine.*); this page asks for them, follows them and shows the results.
// The route is /Plugins/Machine, the same one of the 0.3.x plugin.

import './i18n-register.js'
import { registerRoute } from 'DuetWebControl'
import { onPluginUnload, removePluginRoute } from './dwc-host.js'
import './language-reload.js' // the page loads again when the DWC language changes (vue/_shared)
import './safe-saving.js' // power cut: save with a backup and in one step (vue/_shared)

import machine from './Machine.vue'
import './theme.css'

registerRoute(machine, {
	Plugins: {
		WorkshopMachine: {
			icon: 'mdi-tune-variant',
			caption: 'plugins.WorkshopMachine.common.machine',
			path: '/Plugins/Machine'
		}
	}
})

// DWC 3.7 does not undo anything when the plugin is stopped: take the page out and stop what runs by itself, so that a
// later start registers the new component and a single recorder (review #4)
onPluginUnload('WorkshopMachine', () => {
	removePluginRoute('/Plugins/Machine')
})
