<template>
	<div class="offsets-snapshots">
		<div class="d-flex align-center flex-wrap" style="gap:8px">
			<v-btn size="small" variant="outlined" :disabled="!canWrite || busy" :loading="busy" @click="$emit('snapshot')"><v-icon size="small" start>mdi-camera-outline</v-icon>{{ t('offsets.snapshot_now') }}</v-btn>
			<span v-if="last" class="text-body-small machine-faint">{{ t('offsets.last_snapshot', { when: dateOf(last.ts), user: last.user || '-' }) }}</span>
		</div>
		<!-- the difference with the previous snapshot, as the service computed it when the snapshot was taken -->
		<div v-if="taken" class="mt-3">
			<div class="text-body-medium">{{ taken.previous ? t('offsets.taken_diff', { n: taken.changed === null ? 0 : taken.changed }) : t('offsets.taken_first') }}</div>
			<diff-table v-if="taken.diff" :rows="takenRows" :changed="taken.diff.changed" :cut="taken.diff.cut" :a-label="t('offsets.col_before')" :b-label="t('offsets.col_now')" />
		</div>
		<div v-if="!snapshots.length" class="text-body-medium machine-faint mt-3">{{ t('offsets.no_snapshots') }}</div>
		<template v-else>
			<div class="text-body-medium font-weight-medium mt-4">{{ t('offsets.compare_title') }}</div>
			<div class="d-flex align-center flex-wrap mt-1" style="gap:8px">
				<v-select v-model="pick.a" :items="items" item-title="text" :label="t('offsets.compare_a')" density="compact" variant="outlined" hide-details clearable style="max-width:300px" />
				<v-select v-model="pick.b" :items="items" item-title="text" :label="t('offsets.compare_b')" density="compact" variant="outlined" hide-details clearable style="max-width:300px" />
			</div>
			<v-alert v-if="failed" density="compact" variant="outlined" type="error" class="mt-2">{{ t(failed) }}</v-alert>
			<diff-table v-if="comparison" class="mt-2" :rows="comparisonRows" :changed="comparison.results.changed + comparison.inputs.changed" :cut="comparison.results.cut || comparison.inputs.cut" :a-label="t('offsets.col_a')" :b-label="t('offsets.col_b')" />
		</template>
		<div class="text-body-small machine-faint mt-2">{{ t('offsets.restore_hint') }}</div>
	</div>
</template>

<script setup>
// Snapshots of the offsets: take one now (the service stores it in the calibration history and tells what changed since the previous
// one) and compare any two of them (machine.history.compare). A snapshot is for comparing, it is not restored: the work offsets are the
// work zones of the Workbench (edited there), the tool offsets are edited in this module.

import { computed, ref, watch } from 'vue'
import DiffTable from './DiffTable.vue'
import { t } from '../text.js'
import { diffRows } from '../lib/record-compare.js'
import { pickedPair } from '../state/offsets-state.js'
import { planErrorKey } from '../lib/plan-diff.js'
import { refusalOf } from '../api/machine-api.js'
import { formatDate } from '../lib/format.js'

const props = defineProps({
	api: { type: Object, required: true },
	snapshots: { type: Array, default: () => [] }, // Briefs of kind offsets.snapshot, newest first
	pick: { type: Object, required: true }, // state.pick {a, b}, edited in place
	last: { type: Object, default: null }, // the last snapshot as machine.offsets.get tells
	taken: { type: Object, default: null }, // the answer of the snapshot just taken (normalizeSnapshot)
	canWrite: { type: Boolean, default: false },
	busy: { type: Boolean, default: false }
})
defineEmits(['snapshot'])

const comparison = ref(null)
const failed = ref('')

const items = computed(() => props.snapshots.map(r => ({ value: r.id, text: formatDate(r.ts) + (r.user ? ' - ' + r.user : '') })))
const takenRows = computed(() => diffRows(props.taken.diff, ''))
const comparisonRows = computed(() => diffRows(comparison.value.results, 'results').concat(diffRows(comparison.value.inputs, 'inputs')))

const dateOf = formatDate

watch(() => props.pick.a, () => compare())
watch(() => props.pick.b, () => compare())

async function compare() {
	comparison.value = null
	failed.value = ''
	const pair = pickedPair({ pick: props.pick })
	if (!pair) return
	try {
		comparison.value = await props.api.history.compare(pair[0], pair[1])
	} catch (e) {
		failed.value = planErrorKey(refusalOf(e))
	}
}
</script>
