<template>
	<div class="point-mode-bar mb-2">
		<div v-if="showModes" class="mb-2">
			<v-btn-toggle :model-value="mode" mandatory density="compact" role="group" :aria-label="t('bed.mode_label')" @update:model-value="$emit('mode', $event)">
				<v-btn value="region" style="min-height:44px"><v-icon size="small" start>mdi-vector-rectangle</v-icon>{{ t('bed.mode_region') }}</v-btn>
				<v-btn value="points" style="min-height:44px"><v-icon size="small" start>mdi-map-marker-plus-outline</v-icon>{{ t('bed.mode_points') }}</v-btn>
			</v-btn-toggle>
			<div class="text-body-medium mt-1" role="status">{{ t(mode === 'points' ? 'bed.mode_points_help' : 'bed.mode_region_help') }}</div>
		</div>
		<div v-if="!showModes || mode === 'points'" class="d-flex align-center flex-wrap" style="gap:8px">
			<v-chip label variant="outlined"><v-icon size="small" start>mdi-map-marker-multiple-outline</v-icon>{{ t('bed.points_count', { n: count }) }}</v-chip>
			<v-btn size="small" variant="outlined" :disabled="!canUndo" style="min-height:44px" @click="$emit('undo')"><v-icon size="small" start>mdi-undo</v-icon>{{ t('bed.undo') }}</v-btn>
			<v-btn size="small" variant="outlined" :disabled="!canRedo" style="min-height:44px" @click="$emit('redo')"><v-icon size="small" start>mdi-redo</v-icon>{{ t('bed.redo') }}</v-btn>
			<v-btn size="small" variant="outlined" :disabled="!canReset" style="min-height:44px" @click="$emit('reset')"><v-icon size="small" start>mdi-restore</v-icon>{{ showModes ? t('bed.clear_points') : t('bed.reset_points') }}</v-btn>
			<v-btn v-if="canSeed" size="small" variant="outlined" style="min-height:44px" :title="t('bed.seed_tip')" @click="$emit('seed')"><v-icon size="small" start>mdi-grid</v-icon>{{ t('bed.seed') }}</v-btn>
		</div>
		<details v-if="!showModes || mode === 'points'" class="mt-2 point-mode-coords">
			<summary class="text-body-medium" style="min-height:44px">{{ t('bed.add_by_position') }}</summary>
			<form class="d-flex align-center flex-wrap mt-1" style="gap:8px" @submit.prevent="add()">
				<v-text-field v-model="x" :label="'X'" type="number" suffix="mm" density="compact" variant="outlined" hide-details style="max-width:130px" />
				<v-text-field v-model="y" :label="'Y'" type="number" suffix="mm" density="compact" variant="outlined" hide-details style="max-width:130px" />
				<v-btn size="small" variant="outlined" type="submit" :disabled="!valid" style="min-height:44px"><v-icon size="small" start>mdi-plus</v-icon>{{ t('bed.add_point') }}</v-btn>
			</form>
		</details>
		<div v-if="notice" class="text-body-medium text-warning mt-1" role="status">{{ notice }}</div>
	</div>
</template>

<script setup>
// The editing controls of the points on the bed, the same in Mesh and Level: the mode switch (Mesh only: REGION = drag the rectangle,
// POINTS = choose points), the counter, undo / redo / clear and, for the keyboard and for exact numbers, "Add a point by its position".
// The bed itself does the tapping and dragging. Every button is 44 px, with icon AND word. `notice` is a short sentence from the caller
// (limit reached, a point already there).

import { computed, ref } from 'vue'
import { t } from '../text.js'

defineProps({
	showModes: { type: Boolean, default: false },
	mode: { type: String, default: 'points' }, // 'region' | 'points'
	count: { type: Number, default: 0 },
	canUndo: { type: Boolean, default: false },
	canRedo: { type: Boolean, default: false },
	canReset: { type: Boolean, default: false },
	canSeed: { type: Boolean, default: false },
	notice: { type: String, default: '' }
})
const emit = defineEmits(['mode', 'undo', 'redo', 'reset', 'seed', 'add'])

const x = ref('')
const y = ref('')
const valid = computed(() => String(x.value).trim() !== '' && String(y.value).trim() !== '' && isFinite(Number(x.value)) && isFinite(Number(y.value)))

function add() {
	if (valid.value) emit('add', { x: Number(x.value), y: Number(y.value) })
}
</script>
