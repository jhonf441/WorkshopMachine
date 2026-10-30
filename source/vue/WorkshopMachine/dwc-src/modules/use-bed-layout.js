'use strict'

// What the pages with a bed view (Mesh, Level, Probe) share: the explicit layout state (state/bed-state.js), the merged model the views
// draw, and the call that asks the service for the layout (optionally with a draft to confirm). The component declares the props `api`
// and `axes`, a constant `layoutMode` ('mesh' | 'level') and, for Mesh, the data `grid` (the mixin reads them by name). The component calls refreshLayout() when it is created.

import { computed, onBeforeUnmount, reactive } from 'vue'
import { createBedState, loadLayout, modelOf, draftKeyOf } from '../state/bed-state.js'

export function useBedLayout(props, layoutMode, grid) {
	const bedState = reactive(createBedState())
	let draftTimer = null
	const bedModel = computed(() => modelOf(bedState, props.axes, (grid && grid.value) || null))
	onBeforeUnmount(() => clearTimeout(draftTimer))
	function refreshLayout(draft) {
		if (bedState.status === 'unavailable' && draft) return Promise.resolve('unavailable') // the service has no machine.layout: drafts are not asked again
		return loadLayout(bedState, props.api, layoutMode, draft)
	}
	return {
		bedState, bedModel, refreshLayout,
		// the layout answer only when it answered the given draft (an older answer must not draw the points of another region)
		layoutFor(draft) {
			const lay = bedState.layout
			return lay && bedState.status === 'ready' && bedState.draftKey === draftKeyOf(layoutMode, draft) ? lay : null
		},
		// a draft that changes while the person drags is asked once it stops (400 ms)
		askDraft(draft) {
			clearTimeout(draftTimer)
			draftTimer = setTimeout(() => refreshLayout(draft), 400)
		}
	}
}
