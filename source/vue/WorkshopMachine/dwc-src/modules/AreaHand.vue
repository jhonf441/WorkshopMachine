<template>
	<div class="area-hand">
		<div class="text-title-small mb-1">{{ t('workarea.corners_title') }}</div>
		<details class="wf-more">
			<summary>{{ t('common.how_it_works') }}</summary>
		<p class="text-body-medium machine-faint">{{ t('workarea.corners_intro') }}</p>
		</details>
		<div class="d-flex flex-wrap mb-2" style="gap:16px">
			<div v-for="c in cornerList" :key="c.id" class="area-corner">
				<span class="text-body-medium">{{ t(c.label) }}:</span>
				<b v-if="c.point"> X {{ c.point.x }}  Y {{ c.point.y }}</b>
				<span v-else class="machine-faint"> {{ t('workarea.corner_unset') }}</span>
			</div>
		</div>
		<div class="d-flex align-center flex-wrap" style="gap:8px">
			<v-btn size="small" variant="outlined" color="warning" :disabled="!canWrite || !!releaseBlock" :loading="working === 'release'" :title="releaseBlock || t('workarea.release_hint')" @click="$emit('release')">
				<v-icon size="small" start>mdi-engine-off-outline</v-icon>{{ t('workarea.release') }}
			</v-btn>
			<v-btn v-for="c in cornerList" :key="c.id" size="small" color="primary" :disabled="!canWrite || !!captureBlock" :loading="working === 'capture'" :title="captureBlock" @click="$emit('capture', c.id)">
				{{ t(c.measure) }}
			</v-btn>
		</div>
		<div class="text-body-medium mt-3 mb-1">{{ t('workarea.here_title') }}</div>
		<p class="text-body-small machine-faint mb-1">{{ t('workarea.here_intro') }}</p>
		<div class="d-flex align-center flex-wrap" style="gap:8px">
			<v-btn v-for="c in cornerList" :key="c.id" size="small" variant="outlined" color="primary" :disabled="!canWrite || !hereOk" :title="hereOk ? '' : t('workarea.err_not_homed_here')" @click="$emit('here', c.id)">
				{{ t(c.here) }}
			</v-btn>
		</div>
		<div v-if="captureBlock && !working" class="text-body-small machine-faint mt-1">{{ captureBlock }}</div>
		<v-alert v-if="released" density="compact" variant="outlined" type="warning" class="mt-2 text-body-small">{{ t('workarea.released_note') }}</v-alert>
	</div>
</template>

<script setup>
// The hand measurement of the corners: release X and Y, take the pointer to the corner by hand, measure against the end stops. The service
// does each step (machine.workarea.release / step capture); this shows the two corners and the buttons.

import { computed } from 'vue'
import { t } from '../text.js'

const props = defineProps({
	corners: { type: Object, required: true }, // {a, b} each {x, y} or null
	releaseBlock: { type: String, default: '' }, // why X and Y cannot be released now, written ('' = they can)
	captureBlock: { type: String, default: '' }, // why a corner cannot be measured now, written
	released: { type: Boolean, default: false },
	working: { type: String, default: '' },
	canWrite: { type: Boolean, default: false },
	hereOk: { type: Boolean, default: false } // the tool has a position (X and Y homed)
})
defineEmits(['release', 'capture', 'here'])

const cornerList = computed(() => [
	{ id: 'a', label: 'workarea.corner_a', measure: 'workarea.measure_a', here: 'workarea.here_a', point: props.corners.a },
	{ id: 'b', label: 'workarea.corner_b', measure: 'workarea.measure_b', here: 'workarea.here_b', point: props.corners.b }
])
</script>
