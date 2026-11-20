'use strict'

// The operations each group of sensitive buttons of the Machine page asks of the service (auth.can), so ONE sentence under the group says why it is
// locked (reason-mixin.js, access-reason.js). Pure: no imports. The names are the ones of dsf/permissions.json; a test compares both and the API contract.
//
//   RUN_OPS         start a procedure (probe, level, mesh probe, endstop and offsets verification, safety check, shaping tune)   machine.run
//   MESH_OPS        load, clear, save, taper and delete a stored mesh                                                             machine.mesh.*
//   HEIGHT_OPS      the Z height: save, hook, step                                                                                machine.height.*
//   AREA_OPS        the work area: save, release, step                                                                            machine.workarea.*
//   MAINTENANCE_OPS mark a task done, edit the plan                                                                               machine.maintenance.done, .plan.set
//   RESUME_OPS      resume the interrupted job after a power cut                                                                  machine.power.resume
//   MARK_OPS        the laser cross (mark, capture, clear)                                                                        machine.mark_cross
//   SHAPING_TEST_OPS the ringing test file                                                                                        machine.shaping.test
//   TEST_MOVE_OPS   the test move of the steps assistant                                                                          machine.test_move
//   READ_OPS        the readings of the modules: no group of buttons, asked once so the page opens with one call
//   SCREEN_OPS      everything the page asks when it opens, in one call
//
// NOT here, on purpose:
//   machine.stop                                  a stop: never asked, never gated, no sentence (the STOP button of the header)
//   machine.config.apply / .plan / .history.restore  they change the configuration of the machine and their answer depends on the ARGUMENTS (the kind of
//                                                 plan): the groups that use them (offsets table, limits, calibration, motion, power voltages, tool and bed
//                                                 plans, restore) keep the role sentence and the confirmations exactly as they were, until the answers of
//                                                 auth.can can carry arguments (a note of the step 8 document, section 3)
//   profile.set (the Modes switches)              it is not an operation of this plugin (dsf/permissions.json): that group keeps its role sentence

export const RUN_OPS = Object.freeze(['machine.run'])
export const MESH_OPS = Object.freeze(['machine.mesh.load', 'machine.mesh.clear', 'machine.mesh.save', 'machine.mesh.taper', 'machine.mesh.delete'])
export const HEIGHT_OPS = Object.freeze(['machine.height.save', 'machine.height.hook', 'machine.height.step'])
export const AREA_OPS = Object.freeze(['machine.workarea.save', 'machine.workarea.release', 'machine.workarea.step'])
export const MAINTENANCE_OPS = Object.freeze(['machine.maintenance.done', 'machine.maintenance.plan.set'])
export const RESUME_OPS = Object.freeze(['machine.power.resume'])
export const MARK_OPS = Object.freeze(['machine.mark_cross'])
export const SHAPING_TEST_OPS = Object.freeze(['machine.shaping.test'])
export const TEST_MOVE_OPS = Object.freeze(['machine.test_move'])
export const READ_OPS = Object.freeze([
	'machine.state', 'machine.overview', 'machine.mesh.list', 'machine.height.get', 'machine.workarea.get', 'machine.maintenance.get',
	'machine.power.get', 'machine.offsets.get', 'machine.limits.get', 'machine.motion.get', 'machine.shaping.get'
])

// the groups that carry a sentence, by name: the structure test walks this list
export const GROUPS = Object.freeze({
	run: RUN_OPS, mesh: MESH_OPS, height: HEIGHT_OPS, area: AREA_OPS, maintenance: MAINTENANCE_OPS, resume: RESUME_OPS,
	mark: MARK_OPS, shapingTest: SHAPING_TEST_OPS, testMove: TEST_MOVE_OPS
})

export const SCREEN_OPS = Object.freeze(Array.from(new Set([].concat(...Object.values(GROUPS), READ_OPS))))

// every operation of the group is allowed by `can` (a function op -> boolean)
export function groupAllowed(ops, can) {
	return ops.every(op => can(op))
}
