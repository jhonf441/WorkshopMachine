'use strict'

// WorkshopMachine v2 -- "Machine" page (development source, see ../README.md). Calibration procedures run in the
// WorkshopService backend (machine.*); this page asks for them, follows them and shows the results.
// The route is /Plugins/Machine, the same one of the 0.3.x plugin.

import './i18n-register.js'
import { registerRoute } from '../../routes'
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
});
