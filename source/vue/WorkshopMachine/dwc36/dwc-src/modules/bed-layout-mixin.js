'use strict'

// What the pages with a bed view (Mesh, Level, Probe) share: the explicit layout state (state/bed-state.js), the merged model the views
// draw, and the call that asks the service for the layout (optionally with a draft to confirm). The component declares the props `api`
// and `axes`, a constant `layoutMode` ('mesh' | 'level') and, for Mesh, the data `grid` (the mixin reads them by name). The component calls refreshLayout() when it is created.

import { createBedState, loadLayout, modelOf, draftKeyOf } from '../state/bed-state.js'

export function bedLayoutMixin() {
	return {
		data() {
			return { bedState: createBedState(), draftTimer: null }
		},
		computed: {
			bedModel() {
				return modelOf(this.bedState, this.axes, this.grid || null)
			}
		},
		beforeDestroy() {
			clearTimeout(this.draftTimer)
		},
		methods: {
			refreshLayout(draft) {
				if (this.bedState.status === 'unavailable' && draft) return Promise.resolve('unavailable') // the service has no machine.layout: drafts are not asked again
				return loadLayout(this.bedState, this.api, this.layoutMode, draft)
			},
			// the layout answer only when it answered the given draft (an older answer must not draw the points of another region)
			layoutFor(draft) {
				const lay = this.bedState.layout
				return lay && this.bedState.status === 'ready' && this.bedState.draftKey === draftKeyOf(this.layoutMode, draft) ? lay : null
			},
			// a draft that changes while the person drags is asked once it stops (400 ms)
			askDraft(draft) {
				clearTimeout(this.draftTimer)
				this.draftTimer = setTimeout(() => this.refreshLayout(draft), 400)
			}
		}
	}
}
