'use strict'

// What Mesh and Level share for the named point sets: the explicit state (state/pointsets-state.js), the view the card shows (with the
// notice and the error already translated) and the three calls. The component declares the props `api` and `canWrite` and calls
// loadPointSets() when it is created.

import { createPointSets, loadSets, saveSetAs, removeSetById, viewOf } from '../state/pointsets-state.js'

export function pointSetsMixin() {
	return {
		data() {
			return { psState: createPointSets() }
		},
		computed: {
			setsView() {
				const st = this.psState
				const key = st.noticeKey
				return Object.assign(viewOf(st, this.canWrite), {
					notice: key ? this.t(key) : '',
					error: st.errorKey ? this.t(st.errorKey) + (st.errorDetail ? ' (' + st.errorDetail + ')' : '') : ''
				})
			}
		},
		methods: {
			loadPointSets() {
				return loadSets(this.psState, this.api)
			},
			saveSet(name, points) {
				return saveSetAs(this.psState, this.api, name, points, '')
			},
			deleteSet(id) {
				return removeSetById(this.psState, this.api, id)
			}
		}
	}
}
