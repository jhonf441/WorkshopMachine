'use strict'

// What every module that runs procedures shares: the explicit state of its runs (state/run-state.js), the follower that starts, stops
// and re-attaches (state/run-follower.js). Call it once in <script setup> with the props of the component.
//
//   const { rs, busy, startAllowed, runErrorText, foreignKind, start, stop } = useRunModule(props, ['probe.repeat'], { probe: 0, samples: 10 })
//
// The component declares the props api (createMachineApi), published (normalizeRuns of the plugin data `machine`, or null) and canRun
// (technician) itself. `inputs` may be a function when it holds nested objects.

import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { createRunState, canStart, isBusy } from '../state/run-state.js'
import { createFollower } from '../state/run-follower.js'
import { errorKey, refusalKey } from '../lib/runs.js'
import { t } from '../text.js'

export function useRunModule(props, kinds, inputs) {
	const rs = reactive(createRunState(kinds, typeof inputs === 'function' ? inputs() : inputs))
	const tick = ref(0)
	const busy = computed(() => {
		void tick.value
		return isBusy(rs)
	})
	const startAllowed = computed(() => {
		void tick.value
		return canStart(rs, props.canRun)
	})
	const runErrorText = computed(() => {
		if (rs.error) return t(rs.error.key || refusalKey('other')) + (rs.error.detail ? ' (' + rs.error.detail + ')' : '')
		const key = errorKey(rs.run)
		return key && rs.run.state !== 'done' ? t(key) : ''
	})
	const foreignKind = computed(() => (rs.foreign ? t('kinds.' + rs.foreign.kind.replace('.', '_')) : ''))
	const follower = createFollower({ api: props.api, state: rs, onChange: () => { tick.value++ } })
	follower.reattach() // a run in progress (also one started before a reload) is taken again
	onBeforeUnmount(() => follower.dispose())
	watch(() => props.published, view => follower.onPublished(view))
	return {
		rs, busy, startAllowed, runErrorText, foreignKind,
		start: (kind, params) => follower.start(kind, params),
		stop: () => follower.stop()
	}
}
