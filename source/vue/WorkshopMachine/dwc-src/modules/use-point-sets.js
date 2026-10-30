'use strict'

// What Mesh and Level share for the named point sets: the explicit state (state/pointsets-state.js), the view the card shows (with the
// notice and the error already translated) and the three calls. The component declares the props `api` and `canWrite` and calls
// loadPointSets() when it is created.
//
//   const { psState, setsView, loadPointSets, saveSet, deleteSet } = usePointSets(props)

import { computed, reactive } from 'vue'
import { t } from '../text.js'
import { createPointSets, loadSets, saveSetAs, removeSetById, viewOf } from '../state/pointsets-state.js'

export function usePointSets(props) {
	const psState = reactive(createPointSets())
	const setsView = computed(() => {
		const key = psState.noticeKey
		return Object.assign(viewOf(psState, props.canWrite), {
			notice: key ? t(key) : '',
			error: psState.errorKey ? t(psState.errorKey) + (psState.errorDetail ? ' (' + psState.errorDetail + ')' : '') : ''
		})
	})
	return {
		psState, setsView,
		loadPointSets: () => loadSets(psState, props.api),
		saveSet: (name, points) => saveSetAs(psState, props.api, name, points, ''),
		deleteSet: id => removeSetById(psState, props.api, id)
	}
}
