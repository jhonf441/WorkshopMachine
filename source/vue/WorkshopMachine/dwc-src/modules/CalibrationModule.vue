<template>
	<div class="calibration-module">
		<div class="text-title-large mb-1">{{ t('calibration.title') }}</div>
		<p class="text-body-medium machine-faint">{{ t('calibration.intro') }}</p>
		<error-notice :error="loadError" retry @retry="load()" />
		<v-alert v-if="!canWrite" density="compact" variant="outlined" type="info" class="mb-3">{{ t('calibration.read_only') }}</v-alert>
		<v-btn-toggle v-model="tab" mandatory density="compact" class="mb-4">
			<v-btn v-for="a in ASSISTANTS" :key="a" :value="a" size="small">{{ t('calibration.tab_' + a) }}</v-btn>
		</v-btn-toggle>
		<steps-assistant v-if="tab === 'steps'" :api="api" :rows="rows" :can-edit="configure('config.m92')" @changed="load()" />
		<squareness-assistant v-else-if="tab === 'skew'" :api="api" :can-edit="configure('config.m556')" @changed="load()" />
		<backlash-assistant v-else :api="api" :axes="letters" :can-edit="configure('config.m425')" @changed="load()" />
		<div class="text-body-small machine-faint mt-4">{{ t('calibration.motors_link') }}</div>
	</div>
</template>

<script setup>
// Calibration assistants (design 2.6): steps per mm, squareness and backlash. One assistant at a time. The current values come from the
// service (machine.motion.get); each assistant proposes a plan and the person reviews and applies it (the role gate of each kind).

import { computed, ref } from 'vue'
import ErrorNotice from '../ErrorNotice.vue' // vue/_shared
import StepsAssistant from './StepsAssistant.vue'
import SquarenessAssistant from './SquarenessAssistant.vue'
import BacklashAssistant from './BacklashAssistant.vue'
import { t } from '../text.js'
import { tableRows } from '../lib/motion-table.js'

const ASSISTANTS = ['steps', 'skew', 'backlash']

const props = defineProps({
	api: { type: Object, required: true }, // createMachineApi(...)
	configure: { type: Function, required: true }, // capabilitiesOf(...).configure(kind)
	canWrite: { type: Boolean, default: false } // technician: can propose plans
})

const tab = ref('steps')
const motion = ref(null)
const loadError = ref(null)

const rows = computed(() => tableRows(motion.value ? motion.value.rows : []))
// backlash is per axis (M425 takes X..C, not the extruder)
const letters = computed(() => rows.value.filter(r => r.kind === 'axis').map(r => r.letter))

async function load() {
	try {
		motion.value = await props.api.motion.get()
		loadError.value = null
	} catch (e) {
		loadError.value = e
	}
}
load()
</script>
