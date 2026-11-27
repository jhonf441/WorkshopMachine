<template>
	<v-card outlined class="bedv-detail pa-3" role="region" :aria-label="t('bed.screw_detail_title')">
		<div class="d-flex align-center mb-2" style="gap:8px">
			<div class="text-subtitle-2">{{ t('bed.screw_detail_title') }}: Z{{ screw.index }}</div>
			<v-spacer />
			<v-btn icon small :aria-label="t('bed.detail_close')" @click="$emit('close')"><v-icon small>mdi-close</v-icon></v-btn>
		</div>
		<table class="bedv-detail-table">
			<tr v-for="r in rows" :key="r.label"><td class="machine-faint">{{ r.label }}</td><td class="text-right">{{ r.value }}</td></tr>
		</table>
	</v-card>
</template>

<script>
'use strict'

// Side panel with the detail of a tapped leadscrew (nothing is hover only): where it physically is, whether the probe can reach that spot,
// what the last pass says to do with it and the measurement point nearest to it.

import { textMixin } from '../modules/text-mixin.js'
import { insideRect } from '../lib/bed-frame.js'

export default {
	mixins: [textMixin],
	props: {
		screw: { type: Object, required: true }, // {index, x, y} mm
		reach: { type: Object, default: null }, // {xmin, xmax, ymin, ymax}
		correction: { type: Object, default: null }, // correctionsOf(...) entry of this leadscrew
		nearest: { type: Object, default: null } // {point, mm}: the measurement point nearest to it
	},
	computed: {
		rows() {
			const s = this.screw
			const rows = [
				{ label: this.t('bed.screw_position'), value: s.x.toFixed(1) + ' / ' + s.y.toFixed(1) + ' mm' },
				{ label: this.t('bed.screw_probe_area'), value: this.t(insideRect(this.reach, s) ? 'bed.screw_inside_reach' : 'bed.screw_outside_reach') }
			]
			if (this.correction) rows.push({ label: this.t('bed.corr_title'), value: this.correction.direction === 'none' ? this.t('bed.corr_none') : this.t('bed.corr_' + this.correction.direction, { mm: Math.abs(this.correction.mm).toFixed(3) }) })
			if (this.nearest) rows.push({ label: this.t('bed.nearest_point'), value: this.nearest.point.x.toFixed(1) + ' / ' + this.nearest.point.y.toFixed(1) + ' (' + this.nearest.mm.toFixed(0) + ' mm)' })
			return rows
		}
	}
}
</script>
