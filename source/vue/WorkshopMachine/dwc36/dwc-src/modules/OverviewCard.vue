<template>
	<v-card outlined class="overview-card">
		<v-card-title class="text-subtitle-1 pb-1">{{ t('overview.title') }}</v-card-title>
		<v-card-text>
			<div v-if="!overview" class="text-body-2 machine-faint">{{ failed ? t('overview.no_data') : t('common.loading') }}</div>
			<template v-else>
				<v-alert v-if="!overview.ready.live" dense outlined type="warning" class="mb-3">{{ t('overview.no_live') }}</v-alert>
				<v-alert v-if="overview.run.active" dense outlined type="info" icon="mdi-cog-play-outline" class="mb-3">{{ t('overview.running', { kind: kindName(overview.run.kind) }) }}</v-alert>
				<!-- one row per kind of calibration: colour + icon + words + age (colour is never the only signal) -->
				<div v-for="row in rows" :key="row.kind" class="d-flex align-center flex-wrap py-1" style="gap:8px">
					<v-chip small outlined :color="row.color" style="min-width:150px">
						<v-icon x-small left>{{ row.icon }}</v-icon>{{ t(row.textKey) }}
					</v-chip>
					<span class="text-body-2">{{ t(row.labelKey) }}</span>
					<span class="text-caption machine-faint">{{ ageText(row) }}</span>
				</div>
				<div v-if="overview.ageOldDays" class="text-caption machine-faint mt-1">{{ t('overview.old_after', { days: overview.ageOldDays }) }}</div>
				<!-- maintenance light: only when the service sends it (machine.overview maintenance) -->
				<div v-if="maintenance" class="d-flex align-center flex-wrap py-1" style="gap:8px">
					<v-chip small outlined :color="maintenance.color" style="min-width:150px">
						<v-icon x-small left>{{ maintenance.icon }}</v-icon>{{ t(maintenance.textKey) }}
					</v-chip>
					<span class="text-body-2">{{ t('overview.maintenance') }}</span>
					<span v-if="maintenance.due" class="text-caption machine-faint">{{ t('overview.maintenance_due', { n: maintenance.due }) }}</span>
				</div>
				<div class="text-body-2 font-weight-medium mt-4 mb-1">{{ t('overview.ready_title') }}</div>
				<div class="d-flex flex-wrap" style="gap:6px">
					<v-chip v-for="item in ready" :key="item.id" small outlined :color="item.ok ? 'success' : 'warning'">
						<v-icon x-small left>{{ item.ok ? 'mdi-check' : 'mdi-alert-outline' }}</v-icon>{{ t(item.textKey) }}
					</v-chip>
				</div>
				<div v-if="overview.ready.kinematics" class="text-caption machine-faint mt-2">{{ t('overview.details', { name: overview.ready.kinematics, n: overview.ready.zMotors }) }}</div>
			</template>
		</v-card-text>
	</v-card>
</template>

<script>
'use strict'

// The entry card (design 2.1): a traffic light and the age of each calibration, and what the machine is ready for. It only needs
// machine.overview, which every role may read (no values of offsets or limits).

import { textMixin } from './text-mixin.js'
import { kindRows, readyItems } from '../lib/traffic.js'
import { overviewLight } from '../lib/maintenance.js'

export default {
	mixins: [textMixin],
	props: {
		failed: { type: Boolean, default: false }, // the load failed: say there is no data instead of "Loading..." forever
		overview: { type: Object, default: null } // normalizeOverview(...)
	},
	computed: {
		rows() {
			return kindRows(this.overview)
		},
		ready() {
			return readyItems(this.overview)
		},
		maintenance() {
			return overviewLight(this.overview)
		}
	},
	methods: {
		kindName(kind) {
			return this.t('kinds.' + String(kind || '').replace('.', '_'))
		},
		ageText(row) {
			if (row.ageDays === null || row.ageDays === undefined) return ''
			return row.ageDays < 1 ? this.t('overview.age_today') : this.t('overview.age_days', { days: Math.round(row.ageDays) })
		}
	}
}
</script>
