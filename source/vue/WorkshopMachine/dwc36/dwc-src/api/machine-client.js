'use strict'

// The Machine api bound to the shared client of the workshop plugins (vue/_shared/workshop-api.js). Only the page shell imports this
// file; the modules receive `api` as a prop, so the pure code and its tests never load the browser client.

import { api } from '../workshop-api.js'
import { createMachineApi } from './machine-api.js'

export const machineApi = createMachineApi(api)
