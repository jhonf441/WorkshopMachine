<template>
	<div class="offsets-snapshots">
		<div class="d-flex align-center flex-wrap" style="gap:8px">
			<v-btn small outlined :disabled="!canWrite || busy" :loading="busy" @click="$emit('snapshot')"><v-icon small left>mdi-camera-outline</v-icon>{{ t('offsets.snapshot_now') }}</v-btn>
			<span v-if="last" class="text-caption machine-faint">{{ t('offsets.last_snapshot', { when: dateOf(last.ts), user: last.user || '-' }) }}</span>
		</div>
		<!-- the difference with the previous snapshot, as the service computed it when the snapshot was taken -->
		<div v-if="taken" class="mt-3">
			<div class="text-body-2">{{ taken.previous ? t('offsets.taken_diff', { n: taken.changed === null ? 0 : taken.changed }) : t('offsets.taken_first') }}</div>
			<diff-table v-if="taken.diff" :rows="takenRows" :changed="taken.diff.changed" :cut="taken.diff.cut" :a-label="t('offsets.col_before')" :b-label="t('offsets.col_now')" />
		</div>
		<div v-if="!snapshots.length" class="text-body-2 machine-faint mt-3">{{ t('offsets.no_snapshots') }}</div>
		<template v-else>
			<div class="text-body-2 font-weight-medium mt-4">{{ t('offsets.compare_title') }}</div>
			<div class="d-flex align-center flex-wrap mt-1" style="gap:8px">
				<v-select v-model="pick.a" :items="items" :label="t('offsets.compare_a')" dense outlined hide-details clearable style="max-width:300px" />
				<v-select v-model="pick.b" :items="items" :label="t('offsets.compare_b')" dense outlined hide-details clearable style="max-width:300px" />
			</div>
			<v-alert v-if="failed" dense outlined type="error" class="mt-2">{{ t(failed) }}</v-alert>
			<diff-table v-if="comparison" class="mt-2" :rows="comparisonRows" :changed="comparison.results.changed + comparison.inputs.changed" :cut="comparison.results.cut || comparison.inputs.cut" :a-label="t('offsets.col_a')" :b-label="t('offsets.col_b')" />
		</template>
		<div class="text-caption machine-faint mt-2">{{ t('offsets.restore_hint') }}</div>
	</div>
</template>

<script>
'use strict'

// Snapshots of the offsets: take one now (the service stores it in the calibration history and tells what changed since the previous
// one) and compare any two of them (machine.history.compare). To bring a snapshot back, open it in the History module and restore it
// (a plan with a diff, never a silent write).

import DiffTable from './DiffTable.vue'
import { textMixin } from './text-mixin.js'
import { diffRows } from '../lib/record-compare.js'
import { pickedPair } from '../state/offsets-state.js'
import { planErrorKey } from '../lib/plan-diff.js'
import { refusalOf } from '../api/machine-api.js'
import { formatDate } from '../lib/format.js'

export default {
	components: { DiffTable },
	mixins: [textMixin],
	props: {
		api: { type: Object, required: true },
		snapshots: { type: Array, default: () => [] }, // Briefs of kind offsets.snapshot, newest first
		pick: { type: Object, required: true }, // state.pick {a, b}, edited in place
		last: { type: Object, default: null }, // the last snapshot as machine.offsets.get tells
		taken: { type: Object, default: null }, // the answer of the snapshot just taken (normalizeSnapshot)
		canWrite: { type: Boolean, default: false },
		busy: { type: Boolean, default: false }
	},
	data() {
		return { comparison: null, failed: '' }
	},
	computed: {
		items() {
			return this.snapshots.map(r => ({ value: r.id, text: formatDate(r.ts) + (r.user ? ' - ' + r.user : '') }))
		},
		takenRows() {
			return diffRows(this.taken.diff, '')
		},
		comparisonRows() {
			return diffRows(this.comparison.results, 'results').concat(diffRows(this.comparison.inputs, 'inputs'))
		}
	},
	watch: {
		'pick.a'() {
			this.compare()
		},
		'pick.b'() {
			this.compare()
		}
	},
	methods: {
		dateOf: formatDate,
		async compare() {
			this.comparison = null
			this.failed = ''
			const pair = pickedPair({ pick: this.pick })
			if (!pair) return
			try {
				this.comparison = await this.api.history.compare(pair[0], pair[1])
			} catch (e) {
				this.failed = planErrorKey(refusalOf(e))
			}
		}
	}
}
</script>
