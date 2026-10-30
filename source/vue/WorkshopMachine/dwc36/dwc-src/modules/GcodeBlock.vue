<template>
	<div class="gcode-block">
		<div class="d-flex align-center" style="gap:8px">
			<div class="text-body-2 font-weight-medium">{{ title }}</div>
			<v-spacer />
			<v-btn x-small outlined :disabled="!text" @click="copy()"><v-icon x-small left>mdi-content-copy</v-icon>{{ copied ? t('common.copied') : t('common.copy') }}</v-btn>
		</div>
		<pre class="gcode-text">{{ text || '-' }}</pre>
		<div class="text-caption machine-faint">{{ t('common.gcode_not_sent') }}</div>
	</div>
</template>

<script>
'use strict'

// A G-code text that is SHOWN and COPIED, never sent by the page (the person runs it where and when the machine is free).

import { textMixin } from './text-mixin.js'

export default {
	mixins: [textMixin],
	props: {
		title: { type: String, default: '' },
		text: { type: String, default: '' }
	},
	data() {
		return { copied: false }
	},
	methods: {
		async copy() {
			try {
				await navigator.clipboard.writeText(this.text)
				this.copied = true
				setTimeout(() => { this.copied = false }, 2000)
			} catch (e) {
				this.copied = false // no clipboard permission: the text stays selectable in the box
			}
		}
	}
}
</script>

<style>
.gcode-block .gcode-text { font-family: monospace; font-size: 12px; white-space: pre; overflow-x: auto; padding: 8px; margin: 4px 0; border: 1px solid rgba(128, 128, 128, 0.4); border-radius: 4px; user-select: all; }
</style>
