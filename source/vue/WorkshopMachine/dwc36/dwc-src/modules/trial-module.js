'use strict'

// What a module that offers "try now" shares: the try flow (state/try-flow.js), the seconds field, the reload recovery and the settle at
// the end of the countdown. The component declares the props api (createMachineApi), now (seconds) and adds the values to try.
//
//   mixins: [planModule(), trialModule()]     this.tryNow(gcodeKind, values)   this.tf (try state)   this.trySeconds   this.persistTrial()

import { createTryFlow } from '../state/try-flow.js'
import { TRY_SECONDS } from '../api/machine-api-p3.js'
import { textMixin } from './text-mixin.js'

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

export function trialModule() {
	return {
		mixins: [textMixin],
		data() {
			return { tf: null, tryFlow: null, trySeconds: TRY_SECONDS.default }
		},
		created() {
			this.tryFlow = createTryFlow({ api: this.api.motion.trial, store: browserStore })
			this.tf = this.tryFlow.state
			this.tryFlow.restore(Math.floor(Date.now() / 1000)) // a trial left running before a reload (or a restart of the service) is found again
		},
		watch: {
			now(value) {
				this.tryFlow.settle(value)
			}
		},
		methods: {
			tryNow(gcodeKind, values) {
				return this.tryFlow.start(gcodeKind, values, this.trySeconds)
			},
			// a kept trial becomes permanent through the plan the service gave (persist)
			persistTrial() {
				const p = this.tf.persist
				return p ? this.propose(p.kind, p.values) : null
			}
		}
	}
}
