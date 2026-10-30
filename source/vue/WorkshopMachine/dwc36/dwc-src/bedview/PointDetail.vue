<template>
	<v-card outlined class="bedv-detail pa-3" role="region" :aria-label="t('bed.detail_title')">
		<div class="text-subtitle-2 mb-1">{{ t('bed.detail_title') }}</div>
		<div v-if="!point" class="text-body-2 machine-faint">{{ t('bed.detail_empty') }}</div>
		<template v-else>
			<div class="d-flex align-center mb-2" style="gap:8px">
				<v-chip small outlined :color="view.color"><v-icon small left>{{ view.icon }}</v-icon>{{ t('bed.status_' + point.status) }}</v-chip>
				<span class="text-body-2">{{ title }}</span>
				<v-spacer />
				<v-btn icon small :aria-label="t('bed.detail_close')" @click="$emit('close')"><v-icon small>mdi-close</v-icon></v-btn>
			</div>
			<div v-if="point.reason" class="text-body-2 mb-2">{{ t('bed.reason_' + reasonCode) }}</div>
			<table class="bedv-detail-table">
				<tr v-for="r in rows" :key="r.label"><td class="machine-faint">{{ r.label }}</td><td class="text-right">{{ r.value }}</td></tr>
			</table>
			<slot />
			<!-- EXTENSION POINT `actions`: room for buttons that DO something with this point (go to it, measure it...). Nothing is wired here on
			     purpose: moving the machine, probing or firing the laser from the bed view needs the owner's explicit OK first. -->
			<slot name="actions" :point="point" />
		</template>
	</v-card>
</template>

<script>
'use strict'

// Side panel with the detail of the tapped point (nothing is hover only): its status with icon and word, the reason when it is not
// measured, and the rows the caller adds (position, head position, height, nearest leadscrew...). A slot takes extra actions (remove...).

import { textMixin } from '../modules/text-mixin.js'
import { REASONS } from '../lib/bed-mesh-plan.js'

const VIEW = {
	measure: { color: 'success', icon: 'mdi-check-circle' }, measured: { color: 'success', icon: 'mdi-check-circle' },
	clipped: { color: 'warning', icon: 'mdi-content-cut' }, outside_reach: { color: 'error', icon: 'mdi-close-circle' },
	duplicate: { color: 'warning', icon: 'mdi-content-duplicate' }, unknown: { color: 'grey', icon: 'mdi-help-circle-outline' }, missing: { color: 'grey', icon: 'mdi-help-circle-outline' }
}

export default {
	mixins: [textMixin],
	props: {
		point: { type: Object, default: null }, // {status, reason, order, ...}
		title: { type: String, default: '' },
		rows: { type: Array, default: () => [] } // [{label, value}]
	},
	computed: {
		view() {
			return VIEW[this.point && this.point.status] || VIEW.unknown
		},
		// a reason the page has no text for is shown as the generic one, never as a raw code
		reasonCode() {
			return REASONS.indexOf(this.point.reason) >= 0 ? this.point.reason : 'other'
		}
	}
}
</script>

<style>
.bedv-detail-table { width: 100%; border-collapse: collapse; }
.bedv-detail-table td { padding: 2px 0; font-size: 14px; }
</style>
