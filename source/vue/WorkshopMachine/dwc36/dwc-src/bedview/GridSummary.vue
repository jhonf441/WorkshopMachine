<template>
	<div class="grid-summary" role="region" :aria-label="t('bed.grid_title')">
		<div class="text-subtitle-2">{{ t('bed.grid_title') }}</div>
		<div v-if="!derived" class="text-body-2 machine-faint">{{ t('bed.grid_none') }}</div>
		<div v-else-if="!derived.ok" class="text-body-2"><v-icon small color="warning" left>mdi-alert</v-icon>{{ t('bed.grid_none_' + derived.reason) }}</div>
		<template v-if="derived && derived.ok">
			<div class="text-body-1">{{ t('bed.grid_summary', { nodes: derived.nodes.length, nx: derived.nx, ny: derived.ny, sx: mm(derived.sx), sy: mm(derived.sy) }) }}</div>
			<div v-if="derived.extra > 0" class="text-body-2 mt-1">{{ t('bed.grid_extra', { n: derived.extra }) }}</div>
			<div v-if="derived.padded.x || derived.padded.y" class="text-body-2 mt-1">{{ t('bed.grid_padded') }}</div>
			<div v-if="derived.merged.length" class="text-body-2 mt-1">{{ t('bed.grid_merged', { n: derived.merged.length }) }}</div>
			<div class="d-flex align-center mt-2" style="gap:6px" role="status">
				<v-icon small :color="derived.exact ? 'success' : 'warning'">{{ derived.exact ? 'mdi-check-circle' : 'mdi-alert' }}</v-icon>
				<span class="text-body-2">{{ derived.exact ? t('bed.grid_exact') : t('bed.grid_inexact_' + why, need) }}</span>
			</div>
			<ul v-if="derived.snapped.length" class="grid-summary-list mt-2" :aria-label="t('bed.grid_snapped_title')">
				<li v-for="s in derived.snapped" :key="s.id" class="d-flex align-center" style="gap:6px">
					<span class="text-body-2 flex-grow-1">{{ t('bed.grid_snapped', { x: mm(s.x), y: mm(s.y), nx: mm(nodeOf(s).x), ny: mm(nodeOf(s).y), d: s.distance.toFixed(1) }) }}</span>
					<v-btn v-if="editable" small outlined style="min-height:44px" @click="$emit('use-node', s)"><v-icon small left>mdi-arrow-collapse</v-icon>{{ t('bed.grid_use_node') }}</v-btn>
					<v-btn v-if="editable" icon :aria-label="t('bed.remove_point')" style="min-width:44px;min-height:44px" @click="$emit('remove', s.id)"><v-icon small>mdi-delete-outline</v-icon></v-btn>
				</li>
			</ul>
		</template>
		<ul v-if="derived && derived.ignored.length" class="grid-summary-list mt-2" :aria-label="t('bed.grid_ignored_title')">
			<li v-for="g in derived.ignored" :key="g.id" class="d-flex align-center" style="gap:6px">
				<span class="text-body-2 flex-grow-1"><v-icon small color="error" left>mdi-close-circle</v-icon>{{ t('bed.grid_ignored', { x: mm(g.x), y: mm(g.y) }) }}</span>
				<v-btn v-if="editable" icon :aria-label="t('bed.remove_point')" style="min-width:44px;min-height:44px" @click="$emit('remove', g.id)"><v-icon small>mdi-delete-outline</v-icon></v-btn>
			</li>
		</ul>
	</div>
</template>

<script>
'use strict'

// The grid the chosen points imply, in words: how many nodes the run measures and the spacing, how many of them were not chosen (they
// complete the regular grid), whether every chosen point is on a node and, when not, WHY and which points move to which node and how far,
// with a button to take the node as the point or to remove the point; the chosen points outside what the run accepts are listed too.

import { textMixin } from '../modules/text-mixin.js'
import { inexactWhy, GRID_LIMITS } from '../lib/point-grid.js'

export default {
	mixins: [textMixin],
	props: {
		derived: { type: Object, default: null }, // lib/point-grid.js gridFromPoints(...) with ok true, or null
		editable: { type: Boolean, default: false }
	},
	computed: {
		why() {
			return inexactWhy(this.derived)
		},
		need() {
			const n = this.derived && this.derived.exactNeeds
			return { nodes: n ? n.nodes : 0, nx: n ? n.nx : 0, ny: n ? n.ny : 0, max: GRID_LIMITS.maxNodes }
		}
	},
	methods: {
		mm(v) {
			return (Math.round(v * 10) / 10).toFixed(1)
		},
		nodeOf(s) {
			return this.derived.nodes.find(n => n.id === s.node)
		}
	}
}
</script>

<style>
.grid-summary-list { list-style: none; padding-left: 0; }
</style>
