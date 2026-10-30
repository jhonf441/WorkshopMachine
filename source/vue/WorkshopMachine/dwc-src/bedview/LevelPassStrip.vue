<template>
	<div class="level-pass-strip" role="list" :aria-label="t('bed.passes_title')">
		<div v-for="r in rows" :key="r.n" class="level-pass-card" role="listitem">
			<div class="text-body-small">{{ t('bed.pass_n', { n: r.n }) }}</div>
			<svg width="96" height="34" viewBox="0 0 96 34" aria-hidden="true">
				<rect x="0" y="3" :width="r.wBefore" height="10" class="level-bar-before" />
				<rect x="0" y="19" :width="r.wAfter" height="10" :class="r.within ? 'level-bar-ok' : 'level-bar-after'" />
			</svg>
			<div class="text-body-small">{{ r.before }} &rarr; {{ r.after }} mm</div>
			<div v-if="r.within !== null" class="text-body-small d-flex align-center">
				<v-icon size="x-small" :color="r.within ? 'success' : 'warning'" class="mr-1">{{ r.within ? 'mdi-check-circle' : 'mdi-alert-circle-outline' }}</v-icon>{{ t(r.within ? 'bed.pass_within' : 'bed.pass_above') }}
			</div>
		</div>
	</div>
</template>

<script setup>
// Pass history as small cards under the bed: deviation before (grey) and after (colour) each pass as two bars drawn to the same scale,
// the numbers, and the word + icon of whether the pass ended within tolerance. The full table stays in LevelPasses.

import { computed } from 'vue'
import { t } from '../text.js'
import { passRows } from '../lib/level.js'

const props = defineProps({
	result: { type: Object, default: null }
})

const rows = computed(() => {
	const list = passRows(props.result)
	const max = Math.max.apply(null, [0.0001].concat(list.map(r => Math.max(r.before || 0, r.after || 0))))
	const mm = v => (typeof v === 'number' ? v.toFixed(3) : '-')
	return list.map(r => ({ n: r.n, before: mm(r.before), after: mm(r.after), within: r.withinTolerance, wBefore: ((r.before || 0) / max) * 96, wAfter: ((r.after || 0) / max) * 96 }))
})
</script>

<style>
.level-pass-strip { display: flex; flex-wrap: wrap; gap: 8px; }
.level-pass-card { border: 1px solid rgba(128, 128, 128, 0.4); border-radius: 6px; padding: 6px 8px; min-width: 112px; }
.level-bar-before { fill: rgba(128, 128, 128, 0.6); }
.level-bar-after { fill: #ffb74d; }
.level-bar-ok { fill: #66bb6a; }
</style>
