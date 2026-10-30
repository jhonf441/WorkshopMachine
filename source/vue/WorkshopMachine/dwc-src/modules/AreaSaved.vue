<template>
	<div class="area-saved">
		<div class="text-title-small mb-1">{{ t('workarea.saved_title') }}</div>
		<p class="text-body-medium machine-faint">{{ t('workarea.saved_intro') }}</p>
		<div v-if="!positions.length" class="text-body-small machine-faint">{{ t('workarea.saved_none') }}</div>
		<div v-else class="d-flex flex-wrap" style="gap:12px">
			<v-select
				v-for="c in cornerList" :key="c.id" :model-value="pick[c.id]" :items="items" item-title="label" item-value="index" :label="t(c.label)"
				:placeholder="t('workarea.saved_choose')" density="compact" variant="outlined" hide-details clearable :disabled="!canWrite" style="max-width:320px"
				@update:model-value="v => $emit('pick', c.id, v === undefined ? null : v)"
			/>
		</div>
	</div>
</template>

<script setup>
// The saved positions of the jog as corners: take the tool to two opposite corners with the jog, save each position there and choose them here.
// Nothing moves: the numbers of the positions become the corners (machine.workarea.positions).

import { computed } from 'vue'
import { t } from '../text.js'

const props = defineProps({
	positions: { type: Array, default: () => [] }, // [{name, x, y, z}]
	pick: { type: Object, default: () => ({ a: null, b: null }) }, // the index chosen for each corner
	canWrite: { type: Boolean, default: false }
})
defineEmits(['pick'])

const cornerList = [{ id: 'a', label: 'workarea.corner_a' }, { id: 'b', label: 'workarea.corner_b' }]
const items = computed(() => props.positions.map((q, index) => ({ index, label: (q.name || t('workarea.saved_unnamed')) + '  (X ' + q.x + ', Y ' + q.y + ')' })))
</script>
