'use strict'

// What a module that offers "try now" shares: the try flow (state/try-flow.js), the seconds field, the reload recovery and the settle at
// the end of the countdown. The component declares the props api (createMachineApi), now (seconds) and adds the values to try.
//
//   const plan = usePlanModule(props)
//   const { tf, tryFlow, trySeconds, tryNow, persistTrial } = useTrialModule(props, plan.propose)

import { reactive, ref, watch } from 'vue'
import { createTryFlow } from '../state/try-flow.js'
import { createTryState } from '../state/try-state.js'
import { TRY_SECONDS } from '../api/machine-api-p3.js'

const STORE_KEY = 'workshopMachineTrial'

// the trial this browser started: a per-viewer convenience to find it after a reload (the service is asked first). Never throws.
export const browserStore = {
	load() {
		try {
			const t = JSON.parse(localStorage.getItem(STORE_KEY) || 'null')
			return t && typeof t === 'object' && t.id && t.gcodeKind ? t : null
		} catch (e) {
			return null
		}
	},
	save(trial) {
		try {
			if (trial) localStorage.setItem(STORE_KEY, JSON.stringify(trial))
			else localStorage.removeItem(STORE_KEY)
		} catch (e) {
			/* private window: the trial is just not remembered */
		}
	}
}

export function useTrialModule(props, propose) {
	const tf = reactive(createTryState())
	const trySeconds = ref(TRY_SECONDS.default)
	const tryFlow = createTryFlow({ api: props.api.motion.trial, store: browserStore, state: tf })
	tryFlow.restore(Math.floor(Date.now() / 1000)) // a trial left running before a reload (or a restart of the service) is found again
	watch(() => props.now, value => tryFlow.settle(value))
	return {
		tf, tryFlow, trySeconds,
		tryNow(gcodeKind, values) {
			return tryFlow.start(gcodeKind, values, trySeconds.value)
		},
		// a kept trial becomes permanent through the plan the service gave (persist)
		persistTrial() {
			const p = tf.persist
			return p ? propose(p.kind, p.values) : null
		}
	}
}
