<template>
	<!-- the section's own content, not a card inside its card (FAMILIA-REDISENO 3): the family card head (icon in the section color, the name of the
	     section) with the sentence of the page as its one secondary line, then the groups (title 13/600 and a divider, no frame or fill of their own) -->
	<div class="overview-card">
		<card-head icon="mdi-view-dashboard-outline" :title="t('modules.overview')" />
		<!-- the page bar keeps this sentence for screen readers (its lead is read, not drawn): here it is only seen -->
		<div v-if="lead" class="machine-lead" aria-hidden="true">{{ lead }}</div>
		<session-notice v-if="!overview && lockKind" :kind="lockKind" needed="operator" :subject="$t('plugins.WorkshopMachine.subjects.overview')" />
		<div v-else-if="!overview" class="text-body-2 machine-faint">{{ failed ? t('overview.no_data') : t('common.loading') }}</div>
		<template v-else>
			<!-- one outlined line each, never a full-width band (FAMILIA-REDISENO 3) -->
			<div v-if="!overview.ready.live" class="machine-line-notice machine-line-notice--warn mb-3" role="status"><v-icon small color="warning" aria-hidden="true">mdi-lan-disconnect</v-icon><span>{{ t('overview.no_live') }}</span></div>
			<div v-if="overview.run.active" class="machine-line-notice machine-line-notice--info mb-3" role="status"><v-icon small color="info" aria-hidden="true">mdi-cog-play-outline</v-icon><span>{{ t('overview.running', { kind: kindName(overview.run.kind) }) }}</span></div>
			<div class="wf-group wf-group-divided overview-calibrations">
				<div class="wf-group-title">{{ t('overview.title') }}</div>
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
			</div>
			<div class="wf-group overview-ready">
				<div class="wf-group-title">{{ t('overview.ready_title') }}</div>
				<div class="d-flex flex-wrap" style="gap:6px">
					<v-chip v-for="item in ready" :key="item.id" small outlined :color="item.ok ? 'success' : 'warning'">
						<v-icon x-small left>{{ item.ok ? 'mdi-check' : 'mdi-alert-outline' }}</v-icon>{{ t(item.textKey) }}
					</v-chip>
				</div>
				<div v-if="overview.ready.kinematics" class="text-caption machine-faint mt-2">{{ t('overview.details', { name: overview.ready.kinematics, n: overview.ready.zMotors }) }}</div>
			</div>
		</template>
	</div>
</template>
		</div>
	</div>
</template>

<script>
'use strict'

// The entry card (design 2.1): a traffic light and the age of each calibration, and what the machine is ready for. It only needs
// machine.overview, which every role may read (no values of offsets or limits).

import { textMixin } from './text-mixin.js'
import SessionNotice from '../SessionNotice.vue' // vue/_shared36
import { kindRows, readyItems } from '../lib/traffic.js'
import { overviewLight } from '../lib/maintenance.js'
import CardHead from '../CardHead.vue' // vue/_shared36

export default {
	components: { CardHead, SessionNotice },
	mixins: [textMixin],
	props: {
		lead: { type: String, default: '' }, // the sentence of the page (its bar does not draw it)
		lockKind: { type: String, default: '' }, // the cause of a refusal ('session' | 'role'): the standard notice replaces "no data"
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
