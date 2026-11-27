<template>
	<div class="bedv-positions">
		<div class="text-subtitle-2 mb-1">{{ t('bed.positions_title') }}</div>
		<table class="bedv-pos-table">
			<caption class="sr-only">{{ t('bed.positions_caption') }}</caption>
			<thead>
				<tr>
					<th scope="col">{{ t('bed.col_item') }}</th>
					<th scope="col" class="bedv-num">X (mm)</th>
					<th scope="col" class="bedv-num">Y (mm)</th>
					<th scope="col">{{ t('bed.col_note') }}</th>
				</tr>
			</thead>
			<tbody>
				<tr v-for="r in rows" :key="r.id">
					<th scope="row">{{ r.name }}</th>
					<td class="bedv-num">{{ r.x }}</td>
					<td class="bedv-num">{{ r.y }}</td>
					<td>{{ r.note }}</td>
				</tr>
			</tbody>
		</table>
	</div>
</template>

<script>
'use strict'

// The positions of the levelling bed as text (the same facts as the drawing, for a screen reader and for reading the numbers off): every
// leadscrew (its physical spot) and every measurement point (its step and its nearest leadscrew). Colour is never the only signal.

import { textMixin } from '../modules/text-mixin.js'
import { insideRect } from '../lib/bed-frame.js'
import { nearestScrew } from '../lib/bed-level-plan.js'

export default {
	mixins: [textMixin],
	props: {
		screws: { type: Array, default: () => [] }, // [{index, x, y}]
		points: { type: Array, default: () => [] }, // [{id, x, y, order}]
		reach: { type: Object, default: null }
	},
	computed: {
		rows() {
			const out = this.screws.map(s => ({ id: 's' + s.index, name: this.t('bed.kind_screw', { n: s.index }), x: s.x.toFixed(1), y: s.y.toFixed(1), note: this.t(insideRect(this.reach, s) ? 'bed.screw_inside_reach' : 'bed.screw_outside_reach') }))
			this.points.forEach((p, i) => {
				const s = this.screws.length ? nearestScrew(p, this.screws) : null
				out.push({ id: 'p' + p.id, name: this.t('bed.kind_probe', { n: p.order > 0 ? p.order : i + 1 }), x: p.x.toFixed(1), y: p.y.toFixed(1), note: s ? this.t('bed.nearest_screw') + ': Z' + s.index : '' })
			})
			return out
		}
	}
}
</script>

<style>
.bedv-pos-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.bedv-pos-table th, .bedv-pos-table td { text-align: left; padding: 4px 8px; border-bottom: 1px solid rgba(128, 128, 128, 0.25); font-weight: normal; }
.bedv-pos-table thead th { font-weight: 600; }
.bedv-pos-table .bedv-num { text-align: right; font-variant-numeric: tabular-nums; width: 5.5em; }
.bedv-positions .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
</style>
