<template>
	<div class="area-saved">
		<div class="text-subtitle-2 mb-1">{{ t('workarea.saved_title') }}</div>
		<p class="text-body-2 machine-faint">{{ t('workarea.saved_intro') }}</p>
		<div v-if="!positions.length" class="text-caption machine-faint">{{ t('workarea.saved_none') }}</div>
		<div v-else class="d-flex flex-wrap" style="gap:12px">
			<v-select
				v-for="c in cornerList" :key="c.id" :value="pick[c.id]" :items="items" item-text="label" item-value="index" :label="t(c.label)"
				:placeholder="t('workarea.saved_choose')" dense outlined hide-details clearable :disabled="!canWrite" style="max-width:320px"
				@change="v => $emit('pick', c.id, v === undefined ? null : v)"
			/>
		</div>
	</div>
</template>

<script>
'use strict'

// The saved positions of the jog as corners: take the tool to two opposite corners with the jog, save each position there and choose them here.
// Nothing moves: the numbers of the positions become the corners (machine.workarea.positions).

import { textMixin } from './text-mixin.js'

export default {
	mixins: [textMixin],
	props: {
		positions: { type: Array, default: () => [] }, // [{name, x, y, z}]
		pick: { type: Object, default: () => ({ a: null, b: null }) }, // the index chosen for each corner
		canWrite: { type: Boolean, default: false }
	},
	computed: {
		cornerList() {
			return [{ id: 'a', label: 'workarea.corner_a' }, { id: 'b', label: 'workarea.corner_b' }]
		},
		items() {
			return this.positions.map((q, index) => ({ index, label: (q.name || this.t('workarea.saved_unnamed')) + '  (X ' + q.x + ', Y ' + q.y + ')' }))
		}
	}
}
</script>
