<template>
	<v-card variant="outlined" class="job-fit pa-3" role="region" :aria-label="t('bed.job_title')">
		<div class="text-title-medium">{{ t('bed.job_title') }}</div>
		<p class="text-body-medium machine-faint mb-2">{{ t('bed.job_intro') }}</p>
		<v-row density="compact">
			<v-col v-for="f in fields" :key="f" cols="6" sm="3">
				<v-text-field v-model="job[f]" :label="t('bed.job_field_' + f)" type="number" suffix="mm" density="compact" variant="outlined" hide-details />
			</v-col>
		</v-row>
		<div class="d-flex flex-wrap mt-2" style="gap:8px">
			<v-btn v-if="!hasJob" size="small" variant="outlined" style="min-height:44px" @click="$emit('place')"><v-icon size="small" start>mdi-vector-rectangle</v-icon>{{ t('bed.job_place') }}</v-btn>
			<v-btn v-else size="small" variant="outlined" style="min-height:44px" @click="$emit('clear')"><v-icon size="small" start>mdi-close</v-icon>{{ t('bed.job_clear') }}</v-btn>
		</div>
		<div v-if="hasJob && !result.valid" class="text-body-medium mt-3">{{ t('bed.job_invalid') }}</div>
		<template v-if="result.valid">
			<div class="d-flex align-center mt-3" style="gap:8px" role="status">
				<v-icon :color="verdict.color">{{ verdict.icon }}</v-icon>
				<span class="text-title-medium">{{ t('bed.job_verdict_' + result.verdict) }}</span>
			</div>
			<ul class="job-fit-list mt-2">
				<li v-for="c in rows" :key="c.id" class="mb-2">
					<div class="d-flex align-center" style="gap:6px">
						<v-icon size="small" :color="c.color">{{ c.icon }}</v-icon>
						<span class="text-body-medium font-weight-medium">{{ t('bed.fit_' + c.id) }}:</span>
						<span class="text-body-medium">{{ t('bed.fit_state_' + c.state) }}</span>
					</div>
					<div v-if="c.state === 'unknown'" class="text-body-small machine-faint ml-7">{{ t('bed.fit_unknown_' + c.reason) }}</div>
					<div v-for="s in c.bad" :key="s" class="text-body-small ml-7">{{ t('bed.fit_side_over', { side: t('bed.fit_side_' + s), mm: c.sides[s].mm.toFixed(1) }) }}</div>
					<div v-if="c.id === 'mesh' && c.state !== 'unknown'" class="text-body-small machine-faint ml-7">
						{{ t('bed.fit_mesh_source_' + result.meshSource) }} {{ t('bed.fit_share', { pct: Math.round(c.share * 100) }) }}
					</div>
				</li>
			</ul>
		</template>
	</v-card>
</template>

<script setup>
// "Check a job area": type or drag a work rectangle (X, Y of its lower left corner, width, height) and see, per check, whether it fits and,
// when it does not, which side goes out and by how many mm. Head limits (the axis limits), probe reach and mesh coverage are separate
// answers because they mean different things: the head can go there but the probe cannot measure there, or the mesh does not cover it.
// Pure geometry in lib/job-fit.js; `job` holds the typed fields and is only kept in the page state. Icon AND word, never colour alone.

import { computed } from 'vue'
import { t } from '../text.js'
import { CHECKS, JOB_FIELDS } from '../lib/job-fit.js'

const STATE_VIEW = {
	ok: { icon: 'mdi-check-circle', color: 'success' },
	fail: { icon: 'mdi-close-octagon', color: 'error' },
	unknown: { icon: 'mdi-help-circle-outline', color: 'grey' }
}
const VERDICT_VIEW = { fits: STATE_VIEW.ok, does_not_fit: STATE_VIEW.fail, unknown: STATE_VIEW.unknown }

const props = defineProps({
	job: { type: Object, required: true }, // {x, y, w, h} typed text, written by the fields
	result: { type: Object, required: true } // lib/job-fit.js fitJob(...)
})
defineEmits(['place', 'clear'])

const fields = JOB_FIELDS
const hasJob = computed(() => fields.some(f => String(props.job[f]).trim() !== ''))
const verdict = computed(() => VERDICT_VIEW[props.result.verdict])
const rows = computed(() => (props.result.valid ? CHECKS.map(id => Object.assign({}, props.result.checks[id], STATE_VIEW[props.result.checks[id].state])) : []))
</script>

<style>
.job-fit-list { list-style: none; padding-left: 0; }
</style>
