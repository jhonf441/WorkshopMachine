'use strict'

// What every module that proposes ONE configuration plan at a time shares: the plan flow (state/plan-flow.js), the review state and the
// calls. The component declares the prop api (createMachineApi) itself, adds its inputs and renders <plan-review>.
//
//   const { ps, flow, calc, flowBusy, calcWarnings, propose, proposeCalc, applyPlan } = usePlanModule(props)
//   (`calc` is a ref that keeps the last machine.calc answer, with its warning codes)

import { computed, reactive, ref } from 'vue'
import { createPlanFlow } from '../state/plan-flow.js'
import { createPlanState, isWorking } from '../state/plan-state.js'
import { warningRows } from '../lib/calc-warnings.js'

export function usePlanModule(props) {
	const calc = ref(null)
	const ps = reactive(createPlanState())
	const flow = createPlanFlow({ state: ps, apply: plan => props.api.config.apply(plan.id, plan.kind) })
	const flowBusy = computed(() => isWorking(ps))
	const calcWarnings = computed(() => warningRows(calc.value ? calc.value.warnings : []))
	return {
		ps, flow, calc, flowBusy, calcWarnings,
		propose(kind, values) {
			return flow.propose(async () => ({ plan: await props.api.motion.plan(kind, values), conflict: null }))
		},
		// the arithmetic is the service's (machine.calc): its plan values, unchanged, go to the plan; a refusal (out_of_range, implausible...) is shown as a plan error
		proposeCalc(name, input) {
			calc.value = null
			return flow.propose(async () => {
				const c = await props.api.motion.calc(name, input)
				if (!c.plan) throw Object.assign(new Error('no_value'), { reason: 'no_value' })
				calc.value = c
				return { plan: await props.api.motion.plan(c.plan.kind, c.plan.values), conflict: null }
			})
		},
		// the component emits its own 'changed' when the plan was applied (ps.status === 'done')
		applyPlan(roleOk) {
			return flow.apply(roleOk)
		}
	}
}
