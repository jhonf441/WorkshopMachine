<template>
	<div class="mesh-region-fields">
		<div class="d-flex align-center flex-wrap" style="gap:8px">
			<span class="text-body-small machine-faint">{{ t('bed.fields_title') }}</span>
			<v-text-field
				v-for="f in fields" :key="f" :model-value="draft[f]" :label="t('bed.field_' + f)" suffix="mm" type="number" step="1" density="compact" variant="outlined" hide-details
				:disabled="disabled" style="max-width:128px" :data-field="f" @update:model-value="draft[f] = $event" @change="commit(f)" @keydown.enter="commit(f)"
			/>
		</div>
		<div v-if="reason" class="text-body-small text-warning mt-1">{{ reason }}</div>
		<div v-else-if="reach" class="text-body-small machine-faint mt-1">{{ reach }}</div>
	</div>
</template>

<script setup>
// Four numbers that say where the mesh area is (X min / X max / Y min / Y max), the same numbers the handles on the bed change. A typed
// number is kept inside the travel and at least MIN_SIZE wide, and the page SAYS when it had to change it (never silently); a region that
// goes beyond what the probe reaches is allowed but said: the run measures only up to the reach. 44 px tall for touch.

import { computed, reactive, ref, watch } from 'vue'
import { t } from '../text.js'
import { REGION_FIELDS, editField, reachNote } from '../lib/mesh-resize.js'

const show = v => String(Math.round(v * 10) / 10)

const props = defineProps({
	region: { type: Object, default: null }, // {xmin..ymax} in mm
	bed: { type: Object, default: null }, // the travel
	area: { type: Object, default: null }, // what a run accepts (reach minus margin)
	disabled: { type: Boolean, default: false }
})
const emit = defineEmits(['region'])

const fields = REGION_FIELDS
const draft = reactive({ xmin: '', xmax: '', ymin: '', ymax: '' })
const why = ref('')

const reason = computed(() => (why.value ? t('bed.resize_' + why.value) : ''))
const reach = computed(() => (reachNote(props.region, props.area) ? t('bed.resize_beyond_reach') : ''))

function sync(r) {
	REGION_FIELDS.forEach(f => { draft[f] = r ? show(r[f]) : '' })
}
watch(() => props.region, r => sync(r), { immediate: true })

function commit(field) {
	if (!props.region) return
	const out = editField(props.region, field, draft[field], props.bed)
	why.value = out.reason
	if (out.ok) emit('region', out.region)
	sync(out.ok ? out.region : props.region) // what was typed is replaced by what was kept
}
</script>
