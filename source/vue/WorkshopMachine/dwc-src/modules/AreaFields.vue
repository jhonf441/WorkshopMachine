<template>
	<div class="area-fields">
		<div class="d-flex align-center flex-wrap mb-2" style="gap:8px">
			<span class="text-title-small">{{ t('workarea.card_title', { mode }) }}</span>
			<v-chip size="x-small" label variant="outlined" :color="saved ? 'success' : 'info'">{{ saved ? t('workarea.saved') : t('workarea.not_measured') }}</v-chip>
			<span v-if="size" class="text-body-small machine-faint">{{ t('workarea.size', size) }}</span>
		</div>
		<v-table density="compact" class="area-table">
			<thead>
				<tr><th></th><th class="text-right">{{ t('workarea.col_min') }}</th><th class="text-right">{{ t('workarea.col_max') }}</th></tr>
			</thead>
			<tbody>
				<tr v-for="row in rows" :key="row.axis">
					<td>{{ t(row.label) }}</td>
					<td v-for="k in row.keys" :key="k" class="text-right">
						<v-text-field
							:model-value="draft[k]" density="compact" variant="outlined" hide-details class="area-field" inputmode="decimal" :error="invalid"
							:disabled="!canWrite" :aria-label="row.axis + ' ' + k.slice(1).toLowerCase()" suffix="mm" @update:model-value="v => $emit('field', k, v)"
						/>
					</td>
				</tr>
			</tbody>
		</v-table>
		<div v-for="p in problems" :key="p" class="text-body-small text-error mt-1">{{ t(p, { min: minMm, reach: reachText }) }}</div>
		<div v-if="dirty && !problems.length" class="text-body-small machine-faint mt-1">{{ t('workarea.unsaved') }}</div>
		<div v-if="canWrite" class="d-flex align-center flex-wrap mt-3" style="gap:8px">
			<v-btn size="small" color="primary" :disabled="!valid || !dirty || busy" :loading="working === 'save'" @click="$emit('save')">{{ t('workarea.save') }}</v-btn>
			<v-btn size="small" variant="text" :disabled="!dirty || busy" @click="$emit('undo')">{{ t('workarea.undo') }}</v-btn>
			<v-spacer />
			<v-btn size="small" variant="outlined" color="error" :disabled="!saved || busy" :loading="working === 'remove'" @click="$emit('remove')">{{ t('workarea.remove') }}</v-btn>
		</div>
	</div>
</template>

<script setup>
// The numbers of the area of one mode: four boxes (X and Y, minimum and maximum), what is wrong with them and the buttons that save, undo or remove.

import { computed } from 'vue'
import { t } from '../text.js'
import { sizeOf } from '../lib/workarea.js'

const props = defineProps({
	mode: { type: String, required: true },
	draft: { type: Object, required: true }, // {xMin, xMax, yMin, yMax} as text
	saved: { type: Object, default: null }, // the saved rectangle of the mode or null
	problems: { type: Array, default: () => [] }, // keys of workarea.err_*
	reach: { type: Object, default: null },
	minMm: { type: Number, default: 10 },
	dirty: { type: Boolean, default: false },
	valid: { type: Boolean, default: false },
	working: { type: String, default: '' },
	canWrite: { type: Boolean, default: false }
})
defineEmits(['field', 'save', 'undo', 'remove'])

const rows = [{ axis: 'X', label: 'workarea.x', keys: ['xMin', 'xMax'] }, { axis: 'Y', label: 'workarea.y', keys: ['yMin', 'yMax'] }]
const busy = computed(() => !!props.working)
const invalid = computed(() => props.problems.length > 0)
const size = computed(() => sizeOf(props.saved))
const reachText = computed(() => (props.reach ? 'X ' + props.reach.xMin + ' / ' + props.reach.xMax + ', Y ' + props.reach.yMin + ' / ' + props.reach.yMax : ''))
</script>

<style>
.area-field { max-width: 150px; margin-left: auto; }
</style>
