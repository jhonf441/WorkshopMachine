<template>
	<div class="calibration-module">
		<div class="text-h6 mb-1">{{ t('calibration.title') }}</div>
		<p class="text-body-2 machine-faint">{{ t('calibration.intro') }}</p>
		<error-notice :error="loadError" retry @retry="load()" />
		<v-alert v-if="!canWrite" dense outlined type="info" class="mb-3">{{ t('calibration.read_only') }}</v-alert>
		<v-btn-toggle v-model="tab" mandatory dense class="mb-4">
			<v-btn v-for="a in ASSISTANTS" :key="a" :value="a" small>{{ t('calibration.tab_' + a) }}</v-btn>
		</v-btn-toggle>
		<steps-assistant v-if="tab === 'steps'" :api="api" :rows="rows" :can-edit="configure('config.m92')" @changed="load()" />
		<squareness-assistant v-else-if="tab === 'skew'" :api="api" :can-edit="configure('config.m556')" @changed="load()" />
		<backlash-assistant v-else :api="api" :axes="letters" :can-edit="configure('config.m425')" @changed="load()" />
		<div class="text-caption machine-faint mt-4">{{ t('calibration.motors_link') }}</div>
	</div>
</template>

<script>
'use strict'

// Calibration assistants (design 2.6): steps per mm, squareness and backlash. One assistant at a time. The current values come from the
// service (machine.motion.get); each assistant proposes a plan and the person reviews and applies it (the role gate of each kind).

import ErrorNotice from '../ErrorNotice.vue' // vue/_shared
import StepsAssistant from './StepsAssistant.vue'
import SquarenessAssistant from './SquarenessAssistant.vue'
import BacklashAssistant from './BacklashAssistant.vue'
import { textMixin } from './text-mixin.js'
import { tableRows } from '../lib/motion-table.js'

const ASSISTANTS = ['steps', 'skew', 'backlash']

export default {
	components: { ErrorNotice, StepsAssistant, SquarenessAssistant, BacklashAssistant },
	mixins: [textMixin],
	props: {
		api: { type: Object, required: true }, // createMachineApi(...)
		configure: { type: Function, required: true }, // capabilitiesOf(...).configure(kind)
		canWrite: { type: Boolean, default: false } // technician: can propose plans
	},
	data() {
		return { ASSISTANTS, tab: 'steps', motion: null, loadError: null }
	},
	computed: {
		rows() {
			return tableRows(this.motion ? this.motion.rows : [])
		},
		// backlash is per axis (M425 takes X..C, not the extruder)
		letters() {
			return this.rows.filter(r => r.kind === 'axis').map(r => r.letter)
		}
	},
	created() {
		this.load()
	},
	methods: {
		async load() {
			try {
				this.motion = await this.api.motion.get()
				this.loadError = null
			} catch (e) {
				this.loadError = e
			}
		}
	}
}
</script>
