<template>
	<div class="bedv-legend bedv" role="list">
		<template v-if="stops">
			<span class="text-caption machine-faint">{{ t('bed.heat_legend') }}</span>
			<span v-for="s in stops" :key="s.value" class="text-caption bedv-legend-item" role="listitem">
				<span class="bedv-swatch" :style="{ background: s.color }" />{{ fmt(s.value) }}
			</span>
		</template>
		<span v-for="s in items" :key="s.id" class="text-body-2 bedv-legend-item" role="listitem">
			<svg width="20" height="20" viewBox="-10 -10 20 20" aria-hidden="true" class="bedv-legend-glyph">
				<circle v-if="s.shape === 'disc'" r="7" :class="s.cls" />
				<rect v-else-if="s.shape === 'diamond'" x="-6" y="-6" width="12" height="12" transform="rotate(45)" :class="s.cls" />
				<g v-else-if="s.shape === 'cross'"><circle r="7" :class="s.cls" /><path d="M-3,-3 L3,3 M3,-3 L-3,3" class="bedv-mark" /></g>
				<circle v-else r="7" :class="s.cls" />
			</svg>
			{{ t('bed.status_' + s.id) }}<span v-if="s.count !== null"> ({{ s.count }})</span>
		</span>
		<span v-for="m in marks" :key="m" class="text-body-2 bedv-legend-item" role="listitem">
			<svg width="26" height="26" viewBox="-13 -13 26 26" aria-hidden="true" class="bedv-legend-glyph">
				<g v-if="m === 'snapped' || m === 'ignored'" :class="m === 'ignored' ? 'bedv-ignored-mark' : 'bedv-snap-mark'">
					<circle r="7" />
					<path d="M-4,-4 L4,4 M4,-4 L-4,4" />
				</g>
				<template v-else>
					<circle v-if="m === 'chosen'" r="11" class="bedv-chosen-ring" />
					<circle :r="m === 'chosen' ? 7 : 5.6" class="bedv-st-measure" />
				</template>
			</svg>
			{{ t('bed.mark_' + m) }}
		</span>
	</div>
</template>

<script>
'use strict'

// Legend of the bed view: the glyph AND the word of every status (with how many points have it), and, for a heat map, the colour stops with
// their numbers. Colour is never the only signal.

import { textMixin } from '../modules/text-mixin.js'

const SHAPES = { measure: 'disc', measured: 'disc', clipped: 'diamond', outside_reach: 'cross', unknown: 'dash', missing: 'dash', duplicate: 'dash' }

export default {
	mixins: [textMixin],
	props: {
		ids: { type: Array, required: true }, // statuses to list, e.g. ['measure', 'outside_reach']
		counts: { type: Object, default: () => ({}) },
		stops: { type: Array, default: null }, // [{value, color}] of a heat map
		marks: { type: Array, default: () => [] } // 'chosen' | 'derived' (who decided the node: a ring, a plain smaller disc) | 'snapped' | 'ignored' (the marks of BedSnapped: a chosen point that is measured at the nearest node / that is not measured)
	},
	computed: {
		items() {
			return this.ids.map(id => ({ id, shape: SHAPES[id] || 'dash', cls: 'bedv-st-' + id, count: typeof this.counts[id] === 'number' ? this.counts[id] : null }))
		}
	},
	methods: {
		fmt(v) {
			return (Math.abs(v) < 0.0005 ? 0 : v).toFixed(3)
		}
	}
}
</script>

<style>
.bedv-legend { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 16px; }
.bedv-legend-item { display: inline-flex; align-items: center; gap: 5px; }
.bedv-swatch { display: inline-block; width: 14px; height: 14px; border: 1px solid rgba(128, 128, 128, 0.6); }
</style>
