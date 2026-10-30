<template>
	<div class="history-module">
		<div class="text-h6 mb-1">{{ t('history.title') }}</div>
		<p class="text-body-2 machine-faint">{{ t('history.intro') }}</p>
		<error-notice :error="loadError" retry @retry="load()" />
		<history-list :filters="hs.filters" :records="hs.records" :selected="hs.selected" :total="hs.total" :loading="hs.status === 'loading'" @apply="load()" @toggle="toggle" @open="open" />
		<div class="d-flex align-center flex-wrap mt-3" style="gap:8px">
			<v-btn small outlined :disabled="!pair" @click="comparing = true"><v-icon small left>mdi-compare</v-icon>{{ t('history.compare') }}</v-btn>
			<span v-if="hs.selected.length === 2 && !pair" class="text-caption warning--text">{{ t('history.err_kind_mismatch') }}</span>
			<span v-else-if="hs.selected.length < 2" class="text-caption machine-faint">{{ t('history.compare_hint') }}</span>
		</div>
		<record-compare v-if="comparing && pair" class="mt-3" :a="pair[0]" :b="pair[1]" :api="api" :axes="axes" :quality="quality" @close="comparing = false" />
		<record-detail v-if="hs.detail" class="mt-3" :record="hs.detail.record" :restore="hs.detail.restore" :allowed="allowedFor(hs.detail.record.kind)" @close="closeRecord()" @report="$emit('report', $event)" @restore="restore" />
		<!-- restore: only builds a plan; the diff is reviewed here and the service asks its own confirmation when it is applied -->
		<plan-review v-if="ps.status !== 'idle'" class="mt-3" :state="ps" :title="t('history.restore_title')" :role-ok="restoreAllowed" @set-accept="flow.accept($event)" @replan="flow.proposeAccepted()" @apply="applyPlan()" @reset="flow.reset()" />
	</div>
</template>

<script>
'use strict'

// History module (design 2.11): list with filters, one record, comparison of two records of the same kind (value table and height-map
// difference) and restore. The restore flow is state/plan-flow.js: it asks the service for a plan (machine.history.restore never writes),
// shows the diff, handles "the file changed on the SD" with the comparison and an explicit acceptance, and applies only through
// machine.config.apply, which the service confirms.

import ErrorNotice from '../ErrorNotice.vue' // vue/_shared
import HistoryList from './HistoryList.vue'
import RecordDetail from './RecordDetail.vue'
import RecordCompare from './RecordCompare.vue'
import PlanReview from './PlanReview.vue'
import { textMixin } from './text-mixin.js'
import { createHistoryState, loadBegin, loaded, loadFailed, toggleSelected, comparePair, openDetail, closeDetail } from '../state/history-state.js'
import { createPlanFlow } from '../state/plan-flow.js'
import { listArgs } from '../lib/history.js'
import { planErrorKey } from '../lib/plan-diff.js'
import { refusalOf } from '../api/machine-api.js'

export default {
	components: { ErrorNotice, HistoryList, RecordDetail, RecordCompare, PlanReview },
	mixins: [textMixin],
	props: {
		api: { type: Object, required: true }, // createMachineApi(...)
		configure: { type: Function, required: true }, // kind -> may this person apply a plan of that kind (workshopCan)
		axes: { type: Array, default: () => [] }, // move.axes of the DWC model
		quality: { type: Object, default: null } // profile mesh.quality
	},
	data() {
		return { hs: createHistoryState(), ps: null, flow: null, loadError: null, comparing: false, restoreKind: '' }
	},
	computed: {
		pair() {
			return comparePair(this.hs)
		},
		restoreAllowed() {
			return this.restoreKind ? this.configure(this.restoreKind) : false
		}
	},
	created() {
		this.flow = createPlanFlow({ apply: plan => this.api.config.apply(plan.id, plan.kind) })
		this.ps = this.flow.state
		this.load()
	},
	methods: {
		allowedFor(kind) {
			return this.configure(kind)
		},
		async load() {
			loadBegin(this.hs)
			try {
				loaded(this.hs, await this.api.history.list(listArgs(this.hs.filters)))
				this.loadError = null
			} catch (e) {
				loadFailed(this.hs, planErrorKey(refusalOf(e)), e && e.message)
				this.loadError = e
			}
		},
		toggle(id) {
			toggleSelected(this.hs, id)
			this.comparing = false
		},
		async open(id) {
			try {
				openDetail(this.hs, await this.api.history.get(id))
			} catch (e) {
				this.loadError = e
			}
		},
		closeRecord() {
			closeDetail(this.hs)
			this.flow.reset()
		},
		restore(which) {
			const record = this.hs.detail.record
			this.restoreKind = record.kind
			return this.flow.propose(accept => this.api.history.restore(record.id, which, record.kind, accept))
		},
		async applyPlan() {
			await this.flow.apply(this.restoreAllowed)
			if (this.ps.status === 'done') this.load()
		}
	}
}
</script>
