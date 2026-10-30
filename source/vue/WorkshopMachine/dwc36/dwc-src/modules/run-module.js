'use strict'

// What every module that runs procedures shares: the explicit state of its runs (state/run-state.js), the follower that starts, stops
// and re-attaches (state/run-follower.js) and the props it needs. The module component adds its own inputs and result view.
//
//   mixins: [runModule(['probe.repeat'], { probe: 0, samples: 10 })]     (inputs may be a function when it holds nested objects)
//
// The component declares the props api (createMachineApi), published (normalizeRuns of the plugin data `machine`, or null) and canRun
// (technician) itself: the bindings test reads the props of the component, not of its mixins.

import { createRunState, canStart, isBusy } from '../state/run-state.js'
import { createFollower } from '../state/run-follower.js'
import { errorKey, refusalKey } from '../lib/runs.js'
import { textMixin } from './text-mixin.js'

export function runModule(kinds, inputs) {
	return {
		mixins: [textMixin],
		data() {
			return { rs: createRunState(kinds, typeof inputs === 'function' ? inputs() : inputs), tick: 0 }
		},
		computed: {
			busy() {
				void this.tick
				return isBusy(this.rs)
			},
			startAllowed() {
				void this.tick
				return canStart(this.rs, this.canRun)
			},
			runErrorText() {
				if (this.rs.error) return this.t(this.rs.error.key || refusalKey('other')) + (this.rs.error.detail ? ' (' + this.rs.error.detail + ')' : '')
				const key = errorKey(this.rs.run)
				return key && this.rs.run.state !== 'done' ? this.t(key) : ''
			},
			foreignKind() {
				return this.rs.foreign ? this.t('kinds.' + this.rs.foreign.kind.replace('.', '_')) : ''
			}
		},
		created() {
			this.follower = createFollower({ api: this.api, state: this.rs, onChange: () => { this.tick++ } })
			this.follower.reattach() // a run in progress (also one started before a reload) is taken again
		},
		beforeDestroy() {
			this.follower.dispose()
		},
		watch: {
			published(view) {
				this.follower.onPublished(view)
			}
		},
		methods: {
			start(kind, params) {
				return this.follower.start(kind, params)
			},
			stop() {
				return this.follower.stop()
			}
		}
	}
}
