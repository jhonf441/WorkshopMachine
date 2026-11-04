'use strict'

// The Machine api bound to the shared client of the workshop plugins (vue/_shared/workshop-api.js). Only the page shell imports this
// file; the modules receive `api` as a prop, so the pure code and its tests never load the browser client.

import { api } from '../workshop-api.js'
import { createMachineApi } from './machine-api.js'
import { createToolWizardApi } from './machine-api-toolwiz.js'

export const machineApi = createMachineApi(api)
machineApi.toolwiz = createToolWizardApi(api, machineApi.config) // New tool assistant (mock switch: TOOLWIZ_USE_MOCK)
