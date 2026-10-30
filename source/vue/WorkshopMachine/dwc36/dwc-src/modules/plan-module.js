'use strict'

// What every module that proposes ONE configuration plan at a time shares: the plan flow (state/plan-flow.js), the review state and the
// two methods. The component declares the props api (createMachineApi) itself, adds its inputs and renders <plan-review>.
//
//   mixins: [planModule()]      this.propose(kind, values)   this.proposeCalc(calc, input)   this.applyPlan(roleOk)
//   (`calc` keeps the last machine.calc answer, with its warning codes)

import { createPlanFlow } from '../state/plan-flow.js'
import { isWorking } from '../state/plan-state.js'
import { textMixin } from './text-mixin.js'
import { warningRows } from '../lib/calc-warnings.js'

export function planModule() {
	return {
		mixins: [textMixin],
		data() {
			return { ps: null, flow: null, calc: null }
		},
		computed: {
			flowBusy() {
				return !!this.ps && isWorking(this.ps)
			},
			calcWarnings() {
				return warningRows(this.calc ? this.calc.warnings : [])
			}
		},
		created() {
			this.flow = createPlanFlow({ apply: plan => this.api.config.apply(plan.id, plan.kind) })
			this.ps = this.flow.state
		},
		methods: {
			propose(kind, values) {
				return this.flow.propose(async () => ({ plan: await this.api.motion.plan(kind, values), conflict: null }))
			},
			// the arithmetic is the service's (machine.calc): its plan values, unchanged, go to the plan; a refusal (out_of_range, implausible...) is shown as a plan error
			proposeCalc(name, input) {
				this.calc = null
				return this.flow.propose(async () => {
					const c = await this.api.motion.calc(name, input)
					if (!c.plan) throw Object.assign(new Error('no_value'), { reason: 'no_value' })
					this.calc = c
					return { plan: await this.api.motion.plan(c.plan.kind, c.plan.values), conflict: null }
				})
			},
			// the component emits its own 'changed' when the plan was applied (this.ps.status === 'done'): events of a mixin are not seen by the bindings test
			applyPlan(roleOk) {
				return this.flow.apply(roleOk)
			}
		}
	}
}
