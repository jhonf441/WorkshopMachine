'use strict'

// The sentence of a role refusal (lock.role) names the role of the person: {role} is filled here, so every caller of t('lock.role') (the key
// mappers of lib/runs.js, lib/plan-diff.js, lib/refusal.js return that key) says "Tu rol: Operador" without passing anything. Pure: the page shell
// (Machine.vue) tells where the role name comes from with useRoleName(fn); until then (the unit tests render modules alone) nothing is added.

let roleName = null

export function useRoleName(fn) {
	roleName = typeof fn === 'function' ? fn : null
}

export function withLockParams(key, params) {
	if (key !== 'lock.role' || !roleName) return params
	return Object.assign({ role: roleName() }, params)
}
