'use strict'

// What each role sees and which modules the machine can use (design 5.5, 8.1 Q1/Q8). Pure; the role test is a function `atLeast(min)`
// (roleAtLeast of vue/_shared/role-view.js in the page, a fake in the tests).
//
//   viewer      the Overview card only (machine.overview is open to every role: traffic lights and ages, no values)
//   operator    every module in READ mode (machine.state): last results, the mesh library and its map; no buttons that move or write
//   technician  runs the procedures (machine.run) and loads / clears / saves / tapers the mesh
//   admin       the same, and the admin-class edits (M208, M92, M906/M913/M917, M569, M584); phase 2 offers M208 (limits)
// history and report are for a technician (machine.history.* and machine.report are technician operations); safety, offsets and limits
// are read by an operator, who sees the tables but not the buttons that write.

import { OPS2 } from '../api/machine-api-p2.js'
import { OPS3 } from '../api/machine-api-p3.js'
import { OPS4 } from '../api/machine-api-p4.js'

export const MODULES = [
	{ id: 'overview', icon: 'mdi-view-dashboard-outline', min: null },
	{ id: 'probe', icon: 'mdi-target', min: 'operator' },
	{ id: 'level', icon: 'mdi-stairs', min: 'operator' },
	{ id: 'mesh', icon: 'mdi-grid', min: 'operator' },
	{ id: 'offsets', icon: 'mdi-axis-arrow', min: 'operator' },
	{ id: 'height', icon: 'mdi-arrow-collapse-down', min: 'operator' },
	{ id: 'limits', icon: 'mdi-arrow-expand-horizontal', min: 'operator' },
	{ id: 'workarea', icon: 'mdi-vector-rectangle', min: 'operator' },
	{ id: 'calibration', icon: 'mdi-ruler-square', min: 'operator' },
	{ id: 'motion', icon: 'mdi-engine-outline', min: 'operator' },
	{ id: 'shaping', icon: 'mdi-sine-wave', min: 'operator' },
	{ id: 'safety', icon: 'mdi-shield-check-outline', min: 'operator' },
	{ id: 'maintenance', icon: 'mdi-wrench-clock', min: 'operator' },
	{ id: 'modes', icon: 'mdi-toggle-switch-outline', min: 'operator' },
	{ id: 'history', icon: 'mdi-history', min: 'technician' },
	{ id: 'report', icon: 'mdi-file-document-outline', min: 'technician' }
]

// admin-class configuration kinds (WorkshopService permissions.MACHINE_ADMIN_KINDS): hidden from everybody below an administrator
export const ADMIN_KINDS = ['config.m208', 'config.m92', 'config.m906', 'config.m913', 'config.m917', 'config.m569', 'config.m584']
// gcode_kind of machine.try that the administrator alone may try (permissions.ESCALATE_IN: M208, M92, M906, M913, M917)
export const ADMIN_TRY = ['M208', 'M92', 'M906', 'M913', 'M917']

export function canSeeModule(mod, atLeast) {
	return !mod.min || atLeast(mod.min)
}

// the side bar items: [{id, icon, labelKey, disabled, reasonKey}]. A module the machine cannot use stays in the bar, disabled, WITH the
// reason (code of machine.state modules[id].reason); a module the role cannot see is not listed.
export function moduleItems(modules, atLeast) {
	return MODULES.filter(m => canSeeModule(m, atLeast)).map(m => {
		const state = (modules && modules[m.id]) || null
		const off = !!state && state.available === false
		return { id: m.id, icon: m.icon, labelKey: 'modules.' + m.id, disabled: off, reasonKey: off ? 'reasons.' + (state.reason || 'unknown') : null }
	})
}

// `wanted` when the role may open it and the machine supports it, otherwise the first module that is usable
export function allowedModule(wanted, modules, atLeast) {
	const items = moduleItems(modules, atLeast)
	const hit = items.find(i => i.id === wanted && !i.disabled)
	if (hit) return hit.id
	const first = items.find(i => !i.disabled)
	return first ? first.id : 'overview'
}

// what the person can do in the modules. `can(op, ctx)` is workshopCan (the table the service sent in auth.whoami, with the rules that
// depend on the arguments); without it the roles are used. Hiding is a courtesy: the server refuses what the role cannot do.
export function capabilitiesOf(atLeast, can) {
	return {
		read: atLeast('operator'),
		run: atLeast('technician'),
		admin: atLeast('admin'), // the Motion module edits for an administrator only (owner decision, design 2.8), whatever the table says of speed or acceleration
		meshWrite: atLeast('technician'),
		history: atLeast('technician'),
		configure: kind => {
			if (can) return can(OPS2.configApply, { args: { kind } })
			return ADMIN_KINDS.indexOf(kind) >= 0 ? atLeast('admin') : atLeast('technician')
		},
		// maintenance (phase 4): "done" is a technician operation, the plan (plan.set) too
		maintenanceDone: can ? can(OPS4.maintenanceDone, { args: {} }) : atLeast('technician'),
		maintenanceEdit: can ? can(OPS4.planSet, { args: {} }) : atLeast('technician'),
		// "try now" of a gcode_kind (machine.try)
		trial: gcodeKind => {
			if (can) return can(OPS3.try, { args: { gcode_kind: gcodeKind } })
			return ADMIN_TRY.indexOf(gcodeKind) >= 0 ? atLeast('admin') : atLeast('technician')
		}
	}
}
