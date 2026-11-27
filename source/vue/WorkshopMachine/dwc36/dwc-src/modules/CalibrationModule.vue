<template>
	<div class="calibration-module">
		<card-head icon="mdi-ruler-square" :title="t('calibration.title')" />
		<section-notice :error="loadError" retry @retry="load()" />
		<role-note v-if="!canWrite" min="technician" :ops="accessOps.testMove" class="mb-3" :subject="$t('plugins.WorkshopMachine.subjects.calibration')" />
		<v-btn-toggle v-model="tab" mandatory dense class="mb-4">
			<v-btn v-for="a in ASSISTANTS" :key="a" :value="a" small>{{ t('calibration.tab_' + a) }}</v-btn>
		</v-btn-toggle>
		<steps-assistant v-if="tab === 'steps'" :api="api" :rows="rows" :can-edit="configure('config.m92')" :can-move="canWrite" @changed="load()" />
		<squareness-assistant v-else-if="tab === 'skew'" :api="api" :can-edit="configure('config.m556')" @changed="load()" />
		<backlash-assistant v-else :api="api" :axes="letters" :can-edit="configure('config.m425')" @changed="load()" />
		<!-- the Motors page is another plugin: nothing about it when it is not installed or not enabled -->
		<div v-if="motorsOn" class="text-caption machine-faint mt-4">{{ t('calibration.motors_link') }}</div>
		<help-fold :title="t('calibration.title')" class="mt-4">{{ t('calibration.intro') }}</help-fold>
	</div>
</template>

<script>
'use strict'

// Calibration assistants (design 2.6): steps per mm, squareness and backlash. One assistant at a time. The current values come from the
// service (machine.motion.get); each assistant proposes a plan and the person reviews and applies it (the role gate of each kind).

import SectionNotice from './SectionNotice.vue' // one notice per cause
import StepsAssistant from './StepsAssistant.vue'
import SquarenessAssistant from './SquarenessAssistant.vue'
import BacklashAssistant from './BacklashAssistant.vue'
import { textMixin } from './text-mixin.js'
import { pluginActive } from '../workshop-ids.js' // vue/_shared36
import { tableRows } from '../lib/motion-table.js'
import RoleNote from './RoleNote.vue'
import CardHead from '../CardHead.vue' // vue/_shared36
import HelpFold from '../HelpFold.vue' // vue/_shared36

const ASSISTANTS = ['steps', 'skew', 'backlash']

export default {
	components: { CardHead, HelpFold, RoleNote, SectionNotice, StepsAssistant, SquarenessAssistant, BacklashAssistant },
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
		motorsOn() {
			return pluginActive(this.$store, 'motors')
		},
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
