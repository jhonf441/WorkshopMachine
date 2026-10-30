<template>
	<div class="height-szp">
		<div class="text-body-medium mb-2">
			SZP:
			<span class="machine-faint">{{ summary }}</span>
		</div>
		<div class="d-flex flex-wrap mb-1" style="gap:8px">
			<v-btn size="small" color="primary" :disabled="off" :title="block" @click="$emit('run', 1)">{{ t('height.szp_drive') }}</v-btn>
			<v-btn size="small" variant="outlined" :disabled="off" :title="block" @click="$emit('run', 2)">{{ t('height.szp_height') }}</v-btn>
		</div>
		<div class="text-body-small machine-faint mb-2">{{ block || t('height.szp_tip') }}</div>
		<pre v-if="out" class="height-out">{{ out }}</pre>
		<div class="d-flex align-center flex-wrap" style="gap:8px">
			<span class="text-body-medium">{{ t('height.szp_save') }}</span>
			<v-text-field v-model="s" type="number" density="compact" variant="outlined" hide-details class="height-field" label="S" :disabled="!canWrite" />
			<v-text-field v-model="r" type="number" density="compact" variant="outlined" hide-details class="height-field" label="R" :disabled="!canWrite" />
			<v-btn size="small" :disabled="!canWrite || busy" @click="$emit('save', { s, r })">{{ t('height.save') }}</v-btn>
		</div>
	</div>
</template>

<script setup>
// The SZP (scanning Z probe, probe K1) of FFF: the two calibrations of the Duet guide (drive level, height against reading) and the S / R to save.

import { computed, ref, watch } from 'vue'
import { t } from '../text.js'

const props = defineProps({
	view: { type: Object, required: true }, // lib/height.js modeView of FFF
	canWrite: { type: Boolean, default: false },
	busy: { type: Boolean, default: false },
	block: { type: String, default: '' }, // why the assistants cannot run now ('' = they can)
	out: { type: String, default: '' }, // the last reply of the macro
	sr: { type: Object, default: null } // {s, r} read from that reply
})
const emit = defineEmits(['run', 'save'])

const cur = props.sr || props.view.data.szp
const s = ref(cur ? String(cur.s) : '')
const r = ref(cur ? String(cur.r) : '')

const off = computed(() => !props.canWrite || props.busy || !!props.block)
const summary = computed(() => {
	const p = props.view.szpProbe
	const saved = props.view.data.szp
	const trig = p && p.triggerHeight !== null ? t('height.szp_trigger', { h: p.triggerHeight, x: p.offsetX, y: p.offsetY }) : ''
	return trig + (saved ? ' · S' + saved.s + ' R' + saved.r + ' (' + saved.date + ')' : ' ' + t('height.szp_not_calibrated'))
})

watch(() => props.sr, v => {
	if (v) {
		s.value = String(v.s)
		r.value = String(v.r)
	}
})
</script>

<style>
.height-out { white-space: pre-wrap; font-size: 12px; padding: 6px 8px; background: rgba(0, 0, 0, 0.25); border-radius: 4px; margin-bottom: 8px; }
</style>
