<template>
	<div class="gcode-block">
		<div class="d-flex align-center" style="gap:8px">
			<div class="text-body-medium font-weight-medium">{{ title }}</div>
			<v-spacer />
			<v-btn size="x-small" variant="outlined" :disabled="!text" @click="copy()"><v-icon size="x-small" start>mdi-content-copy</v-icon>{{ copied ? t('common.copied') : t('common.copy') }}</v-btn>
		</div>
		<pre class="gcode-text">{{ text || '-' }}</pre>
		<div class="text-body-small machine-faint">{{ t('common.gcode_not_sent') }}</div>
	</div>
</template>

<script setup>
// A G-code text that is SHOWN and COPIED, never sent by the page (the person runs it where and when the machine is free).

import { ref } from 'vue'
import { t } from '../text.js'

const props = defineProps({
	title: { type: String, default: '' },
	text: { type: String, default: '' }
})

const copied = ref(false)

async function copy() {
	try {
		await navigator.clipboard.writeText(props.text)
		copied.value = true
		setTimeout(() => { copied.value = false }, 2000)
	} catch (e) {
		copied.value = false // no clipboard permission: the text stays selectable in the box
	}
}
</script>

<style>
.gcode-block .gcode-text { font-family: monospace; font-size: 12px; white-space: pre; overflow-x: auto; padding: 8px; margin: 4px 0; border: 1px solid rgba(128, 128, 128, 0.4); border-radius: 4px; user-select: all; }
</style>
