'use strict'

// "New tool" assistant, guided tests after the plan is applied and the board restarted. The assistant NEVER switches anything on (contract section 5):
// the person does each test by hand in DWC and ticks it here. The order is safe by construction: a heater test is blocked until its sensor reads
// right, and the autotune comes after the heater test. Pure.

import { typeInfo } from './toolwiz-spec.js'

export const TEST_KINDS = ['restart', 'sensor', 'fan', 'output_off', 'drive', 'heater', 'autotune']

// [{id, kind, index, needs: [ids that must be done first], heat}] in the order they are done
export function testList(draft) {
	const info = typeInfo(draft.type)
	if (!info) return []
	const out = [{ id: 'restart', kind: 'restart', index: 0, needs: [], heat: false }]
	draft.heaters.forEach((h, i) => out.push({ id: 'sensor_h' + i, kind: 'sensor', index: i, needs: ['restart'], heat: false }))
	draft.sensors.forEach((s, i) => out.push({ id: 'sensor_x' + i, kind: 'sensor', index: i, needs: ['restart'], heat: false }))
	draft.fans.forEach((f, i) => out.push({ id: 'fan_' + i, kind: 'fan', index: i, needs: ['restart'], heat: false }))
	if (info.output) out.push({ id: 'output_off', kind: 'output_off', index: 0, needs: ['restart'], heat: false })
	if (info.drive) out.push({ id: 'drive', kind: 'drive', index: 0, needs: ['restart'], heat: false })
	draft.heaters.forEach((h, i) => out.push({ id: 'heater_' + i, kind: 'heater', index: i, needs: ['sensor_h' + i], heat: true }))
	draft.heaters.forEach((h, i) => out.push({ id: 'autotune_' + i, kind: 'autotune', index: i, needs: ['heater_' + i], heat: true }))
	return out
}

// 'done' | 'ready' | 'blocked'
export function testState(test, done) {
	if (done[test.id]) return 'done'
	return test.needs.every(n => done[n]) ? 'ready' : 'blocked'
}

export const TEST_COLORS = { done: 'success', ready: 'primary', blocked: 'grey' }
export const TEST_ICONS = { done: 'mdi-check-circle', ready: 'mdi-play-circle-outline', blocked: 'mdi-lock-outline' }

// the heater n may be used only once its autotune is done
export function heaterUsable(index, done) {
	return !!done['autotune_' + index]
}

export function testProgress(draft, done) {
	const tests = testList(draft)
	const n = tests.filter(t => done[t.id]).length
	return { done: n, total: tests.length, finished: tests.length > 0 && n === tests.length }
}

// ticking a test is allowed only when it is ready; un-ticking a test also clears the ones that depended on it
export function markTest(done, tests, id, value) {
	const t = tests.find(x => x.id === id)
	if (!t) return done
	if (value) {
		if (testState(t, done) === 'ready') done[id] = true
		return done
	}
	delete done[id]
	tests.filter(x => x.needs.indexOf(id) >= 0).forEach(x => markTest(done, tests, x.id, false))
	return done
}
