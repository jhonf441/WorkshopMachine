<template>
	<v-card variant="outlined" class="record-compare">
		<v-card-title class="text-title-medium pb-1">
			{{ t('history.compare_title') }}
			<v-spacer />
			<v-btn size="x-small" variant="text" @click="$emit('close')">{{ t('plan.close') }}</v-btn>
		</v-card-title>
		<v-card-text>
			<div class="text-body-small machine-faint">{{ t('history.compare_ab', { a: label(a), b: label(b) }) }}</div>
			<v-alert v-if="!view.ok" density="compact" variant="outlined" type="warning" class="mt-2">{{ t(view.reasonKey) }}</v-alert>
			<v-alert v-else-if="failed" density="compact" variant="outlined" type="error" class="mt-2">{{ t(failed) }}</v-alert>
			<div v-else-if="loading" class="text-body-medium machine-faint">{{ t('common.loading') }}</div>
			<template v-else>
				<diff-table :rows="view.rows" :changed="view.changed" :cut="view.cut" />
				<!-- two height maps: the difference map (B - A) with the same view and colour scale of one mesh -->
				<div v-if="view.mesh" class="mt-4">
					<div class="text-body-medium font-weight-medium mb-1">{{ t('history.mesh_diff') }}</div>
					<div v-if="!view.mesh.ok" class="text-body-medium text-warning">{{ t(view.mesh.reasonKey) }}</div>
					<mesh-map v-else-if="diffGrid && bed" :grid="diffGrid" :bed="bed" :thresholds="thresholds" />
				</div>
			</template>
		</v-card-text>
	</v-card>
</template>

<script setup>
// Compare two records of the same kind: the service makes the comparison (machine.history.compare); this component shows the table of
// values (what changed first) and, for height maps, the difference map.

import { computed, ref, watch } from 'vue'
import MeshMap from './MeshMap.vue'
import DiffTable from './DiffTable.vue'
import { t } from '../text.js'
import { compareView } from '../lib/record-compare.js'
import { normalizeGrid, bedOf, qualityThresholds } from '../lib/mesh-grid.js'
import { planErrorKey } from '../lib/plan-diff.js'
import { refusalOf } from '../api/machine-api.js'
import { formatDate } from '../lib/format.js'

const props = defineProps({
	a: { type: Object, required: true }, // Brief
	b: { type: Object, required: true }, // Brief
	api: { type: Object, required: true },
	axes: { type: Array, default: () => [] },
	quality: { type: Object, default: null }
})
defineEmits(['close'])

const answer = ref(null)
const loading = ref(false)
const failed = ref('')

const view = computed(() => compareView(answer.value, props.a, props.b))
const diffGrid = computed(() => (view.value.mesh && view.value.mesh.grid ? normalizeGrid(view.value.mesh.grid) : null))
const bed = computed(() => bedOf(props.axes, diffGrid.value))
const thresholds = computed(() => qualityThresholds(props.quality))

function label(r) {
	return formatDate(r.ts) + (r.user ? ' ' + r.user : '')
}
async function load() {
	answer.value = null
	failed.value = ''
	if (!compareView(null, props.a, props.b).ok) return
	loading.value = true
	try {
		answer.value = await props.api.history.compare(props.a.id, props.b.id)
	} catch (e) {
		failed.value = planErrorKey(refusalOf(e))
	} finally {
		loading.value = false
	}
}

watch(() => props.a, () => load())
watch(() => props.b, () => load())
load()
</script>
