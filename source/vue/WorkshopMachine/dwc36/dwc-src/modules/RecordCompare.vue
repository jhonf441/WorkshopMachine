<template>
	<v-card outlined class="record-compare">
		<v-card-title class="text-subtitle-1 pb-1">
			{{ t('history.compare_title') }}
			<v-spacer />
			<v-btn x-small text @click="$emit('close')">{{ t('plan.close') }}</v-btn>
		</v-card-title>
		<v-card-text>
			<div class="text-caption machine-faint">{{ t('history.compare_ab', { a: label(a), b: label(b) }) }}</div>
			<v-alert v-if="!view.ok" dense outlined type="warning" class="mt-2">{{ t(view.reasonKey) }}</v-alert>
			<v-alert v-else-if="failed" dense outlined type="error" class="mt-2">{{ t(failed) }}</v-alert>
			<div v-else-if="loading" class="text-body-2 machine-faint">{{ t('common.loading') }}</div>
			<template v-else>
				<diff-table :rows="view.rows" :changed="view.changed" :cut="view.cut" />
				<!-- two height maps: the difference map (B - A) with the same view and colour scale of one mesh -->
				<div v-if="view.mesh" class="mt-4">
					<div class="text-body-2 font-weight-medium mb-1">{{ t('history.mesh_diff') }}</div>
					<div v-if="!view.mesh.ok" class="text-body-2 warning--text">{{ t(view.mesh.reasonKey) }}</div>
					<mesh-map v-else-if="diffGrid && bed" :grid="diffGrid" :bed="bed" :thresholds="thresholds" />
				</div>
			</template>
		</v-card-text>
	</v-card>
</template>

<script>
'use strict'

// Compare two records of the same kind: the service makes the comparison (machine.history.compare); this component shows the table of
// values (what changed first) and, for height maps, the difference map.

import MeshMap from './MeshMap.vue'
import DiffTable from './DiffTable.vue'
import { textMixin } from './text-mixin.js'
import { compareView } from '../lib/record-compare.js'
import { normalizeGrid, bedOf, qualityThresholds } from '../lib/mesh-grid.js'
import { planErrorKey } from '../lib/plan-diff.js'
import { refusalOf } from '../api/machine-api.js'
import { formatDate } from '../lib/format.js'

export default {
	components: { MeshMap, DiffTable },
	mixins: [textMixin],
	props: {
		a: { type: Object, required: true }, // Brief
		b: { type: Object, required: true }, // Brief
		api: { type: Object, required: true },
		axes: { type: Array, default: () => [] },
		quality: { type: Object, default: null }
	},
	data() {
		return { answer: null, loading: false, failed: '' }
	},
	computed: {
		view() {
			return compareView(this.answer, this.a, this.b)
		},
		diffGrid() {
			return this.view.mesh && this.view.mesh.grid ? normalizeGrid(this.view.mesh.grid) : null
		},
		bed() {
			return bedOf(this.axes, this.diffGrid)
		},
		thresholds() {
			return qualityThresholds(this.quality)
		}
	},
	watch: {
		a() {
			this.load()
		},
		b() {
			this.load()
		}
	},
	created() {
		this.load()
	},
	methods: {
		label(r) {
			return formatDate(r.ts) + (r.user ? ' ' + r.user : '')
		},
		async load() {
			this.answer = null
			this.failed = ''
			if (!compareView(null, this.a, this.b).ok) return
			this.loading = true
			try {
				this.answer = await this.api.history.compare(this.a.id, this.b.id)
			} catch (e) {
				this.failed = planErrorKey(refusalOf(e))
			} finally {
				this.loading = false
			}
		}
	}
}
</script>
