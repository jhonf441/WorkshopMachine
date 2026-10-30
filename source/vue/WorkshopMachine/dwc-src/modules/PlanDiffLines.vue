<template>
	<pre class="plan-diff"><span v-for="l in rows" :key="l.i" :class="'plan-line plan-' + l.cls">{{ l.text }}
</span></pre>
</template>

<script setup>
// The lines of a unified diff. The first character (+ / -) is printed too: colour is never the only signal.

import { computed } from 'vue'
import { classifyLine } from '../lib/plan-diff.js'

const props = defineProps({ lines: { type: Array, required: true } })
const rows = computed(() => props.lines.map((text, i) => ({ i, text, cls: classifyLine(text) })))
</script>

<style>
.plan-diff { font-family: monospace; font-size: 12px; overflow-x: auto; margin: 4px 0; padding: 6px; border: 1px solid rgba(128, 128, 128, 0.4); border-radius: 4px; }
.plan-line { display: block; white-space: pre; }
.plan-add { background: rgba(76, 175, 80, 0.22); }
.plan-del { background: rgba(244, 67, 54, 0.22); }
.plan-hunk, .plan-file { opacity: 0.7; }
</style>
