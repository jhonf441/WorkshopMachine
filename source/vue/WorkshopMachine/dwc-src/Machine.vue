<template>
	<v-container :style="secStyle" fluid class="pa-0 machine-page workshop-theme">
		<service-notice />
		<!-- header (DESIGN.md 3): the common page header; the health chip is the worst light of the overview -->
		<page-header :lead="t('page.lead')" icon="mdi-tune-variant" :title="t('common.machine')" :reasons="headerReasons" :loading="!snapshot">
			<control-holder-chip :model="model" />
			<template #right>
				<!-- STOP: every role, while a procedure lasts (machine.stop; it is not the emergency stop) -->
				<template v-if="runningKind">
					<v-chip size="small" color="info" variant="outlined"><v-icon size="x-small" start>mdi-cog-play-outline</v-icon>{{ t('page.running_now', { kind: kindName(runningKind) }) }}</v-chip>
					<v-btn size="small" color="error" :title="t('page.stop_hint')" @click="stopAll()"><v-icon size="small" start>mdi-stop</v-icon>{{ t('page.stop_all') }}</v-btn>
				</template>
				<v-btn size="small" icon :title="t('page.refresh')" :loading="loading" @click="load()"><v-icon size="small">mdi-refresh</v-icon></v-btn>
			</template>
			<!-- start-up of the machine modes: the chip is here like in every page; its cards are in the "Modes" section -->
			<template #startup><modes-startup /></template>
		</page-header>
		<error-notice :error="loadError" retry @retry="load()" />
		<div class="mb-3">
			<div>
				<div class="st-layout">
					<side-tabs v-model="section" :items="sideItems" />
					<!-- one module at a time, mounted only while it is open (DESIGN.md 3) -->
					<div class="st-body">
						<template v-if="section === 'overview'">
							<overview-card :overview="snapshot" :failed="!!loadError" />
							<v-alert v-if="unavailable.length" density="compact" variant="outlined" type="warning" class="mt-3">
								<div class="font-weight-medium">{{ t('page.unavailable_title') }}</div>
								<div v-for="u in unavailable" :key="u.id" class="text-body-medium">{{ u.name }}: {{ u.reason }}</div>
							</v-alert>
							<v-alert v-if="!caps.read" density="compact" variant="outlined" type="info" class="mt-3">{{ t('page.viewer_only') }}</v-alert>
						</template>
						<probe-module v-else-if="section === 'probe'" :api="api" :published="published" :can-run="caps.run" :thresholds="snapshot && snapshot.thresholds" :axes="axes" :now="now" />
						<level-module v-else-if="section === 'level'" :api="api" :published="published" :can-run="caps.run" :can-write="caps.run" :ready="snapshot && snapshot.ready" :profile="snapshot && snapshot.levelling" :axes="axes" :now="now" />
						<mesh-module
							v-else-if="section === 'mesh'" :api="api" :published="published" :can-run="caps.run" :can-write="caps.meshWrite" :ready="snapshot && snapshot.ready"
							:axes="axes" :quality="snapshot && snapshot.meshQuality" :now="now" @changed="load()"
						/>
						<offsets-module v-else-if="section === 'offsets'" :api="api" :can-write="caps.configure('config.g10')" :can-run="caps.run" :tool-pair="snapshot && snapshot.toolPair" :published="published" :measure="visionMeasure" :now="now" />
						<height-module v-else-if="section === 'height'" :api="api" :can-write="caps.run" />
						<limits-module
							v-else-if="section === 'limits'" :api="api" :published="published" :can-edit="caps.configure('config.m208')" :can-run="caps.run"
							:now="now" @changed="load()"
						/>
						<area-module v-else-if="section === 'workarea'" :api="api" :can-write="caps.run" :axes="axes" />
						<calibration-module v-else-if="section === 'calibration'" :api="api" :configure="caps.configure" :can-write="caps.run" />
						<motion-module v-else-if="section === 'motion'" :api="api" :configure="caps.configure" :trial="caps.trial" :is-admin="caps.admin" :now="now" />
						<shaping-module
							v-else-if="section === 'shaping'" :api="api" :published="published" :configure="caps.configure" :trial="caps.trial" :can-run="caps.run" :now="now"
						/>
						<safety-module v-else-if="section === 'safety'" :api="api" :published="published" :can-run="caps.run" :now="now" @goto="section = $event" />
						<maintenance-module v-else-if="section === 'maintenance'" :api="api" :can-mark="caps.maintenanceDone" :can-edit="caps.maintenanceEdit" />
						<modes-module v-else-if="section === 'modes'" :can-write="caps.run" />
						<history-module
							v-else-if="section === 'history'" :api="api" :configure="caps.configure" :axes="axes" :quality="snapshot && snapshot.meshQuality" @report="openReport"
						/>
						<report-module v-else-if="section === 'report'" :key="reportTarget" :api="api" :target="reportTarget" :axes="axes" />
					</div>
				</div>
			</div>
		</div>
	</v-container>
</template>

<script setup>
// WorkshopMachine v2 page shell: header (traffic light, who is running what, STOP), side bar of modules and one module at a time.
// What the page knows comes from machine.overview (every role) or machine.state (operator and up) and from the progress the service
// publishes in its plugin data `machine`; the sequences themselves run in the service. Roles: lib/gating.js.

import { sectionColor } from './section-colors.js'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { machineModel, modelPlugins } from './dwc-host.js'
import ServiceNotice from './ServiceNotice.vue' // vue/_shared
import PageHeader from './PageHeader.vue' // header of every page (vue/_shared)
import { levelOfColor } from './page-health.js'
import ErrorNotice from './ErrorNotice.vue'
import SideTabs from './SideTabs.vue'
import ControlHolderChip from './ControlHolderChip.vue'
import OverviewCard from './modules/OverviewCard.vue'
import ProbeModule from './modules/ProbeModule.vue'
import LevelModule from './modules/LevelModule.vue'
import MeshModule from './modules/MeshModule.vue'
import OffsetsModule from './modules/OffsetsModule.vue'
import HeightModule from './modules/HeightModule.vue'
import LimitsModule from './modules/LimitsModule.vue'
import AreaModule from './modules/AreaModule.vue'
import CalibrationModule from './modules/CalibrationModule.vue'
import MotionModule from './modules/MotionModule.vue'
import ShapingModule from './modules/ShapingModule.vue'
import SafetyModule from './modules/SafetyModule.vue'
import MaintenanceModule from './modules/MaintenanceModule.vue'
import HistoryModule from './modules/HistoryModule.vue'
import ModesModule from './modules/ModesModule.vue'
import ModesStartup from './modules/ModesStartup.vue'
import ReportModule from './modules/ReportModule.vue'
import { useRole } from './use-role.js'
import { pluginOf, dataOf } from './workshop-ids.js'
import { machineApi } from './api/machine-client.js'
import { normalizeRuns } from './api/machine-api.js'
import { moduleItems, allowedModule, capabilitiesOf } from './lib/gating.js'
import { lightView, worstLight } from './lib/traffic.js'
import { ASK_KEY } from './lib/height.js'
import { t } from './text.js'

const SECTION_KEY = 'workshopMachineSection'
const GOTO_EVENT = 'workshop-machine-goto' // another plugin (Workbench) sends the person to a module of this page: {section}
const RELOAD_MS = 250

function savedSection() {
	try {
		if (localStorage.getItem(ASK_KEY)) return 'height' // the Workbench sent the person here to calibrate the height (the module takes the point)
		return localStorage.getItem(SECTION_KEY) || 'overview'
	} catch (e) {
		return 'overview'
	}
}

const { atLeast, canDo, identityTick } = useRole()
const api = machineApi
const section = ref(savedSection())
const snapshot = ref(null)
const loadError = ref(null)
const loading = ref(false)
const reportTarget = ref('')
const now = ref(Math.floor(Date.now() / 1000))
let reloadTimer = null

const secStyle = computed(() => ({ '--wf-sec': sectionColor(section.value) }))
const model = computed(() => machineModel())
const axes = computed(() => {
	const mv = model.value && model.value.move
	return (mv && mv.axes) || []
})
// the progress the service publishes (plugins.WorkshopService.data.machine): runs in progress without asking
const published = computed(() => {
	const raw = dataOf(pluginOf(modelPlugins(), 'service'), 'machine')
	return raw ? normalizeRuns(raw) : null
})
const runningKind = computed(() => {
	if (published.value && published.value.active) return published.value.active.kind
	return snapshot.value && snapshot.value.run.active ? snapshot.value.run.kind : ''
})
const publishedKey = computed(() => {
	const a = published.value && published.value.active
	return a ? a.id + ':' + a.state : 'idle'
})
const caps = computed(() => capabilitiesOf(min => atLeast(min), (op, ctx) => canDo(op, ctx))) // workshopCan: the server's table
const sideItems = computed(() => moduleItems(snapshot.value && snapshot.value.modules, min => atLeast(min)).map(i => ({
	id: i.id, icon: i.icon, label: t(i.labelKey), group: i.groupKey ? t(i.groupKey) : undefined, disabled: i.disabled, badge: i.disabled ? '!' : ''
})))
// a module the machine cannot use stays in the bar, disabled, and the overview says why
const unavailable = computed(() => moduleItems(snapshot.value && snapshot.value.modules, min => atLeast(min)).filter(i => i.disabled).map(i => ({ id: i.id, name: t(i.labelKey), reason: t(i.reasonKey) })))
// Vision can measure a mark (machine.state vision.measure); null until the state says
const visionMeasure = computed(() => (snapshot.value && snapshot.value.vision ? snapshot.value.vision.measure : null))
const worst = computed(() => lightView({ light: snapshot.value ? worstLight(snapshot.value) : 'never' }))
// what the page header counts: the worst light of the overview (the service problem and the session are added by it)
const headerReasons = computed(() => {
	const lvl = levelOfColor(worst.value.color)
	return lvl === 'ok' ? [] : [{ level: lvl, text: t(worst.value.textKey) }]
})

function kindName(kind) {
	return t('kinds.' + String(kind).replace('.', '_'))
}
// the History module asks for the report of one record
function openReport(id) {
	reportTarget.value = id
	section.value = 'report'
}
function reloadSoon() {
	clearTimeout(reloadTimer)
	reloadTimer = setTimeout(() => load(), RELOAD_MS)
}
async function load() {
	loading.value = true
	try {
		snapshot.value = atLeast('operator') ? await api.state() : await api.overview()
		loadError.value = null
		section.value = allowedModule(section.value, snapshot.value.modules, min => atLeast(min))
	} catch (e) {
		loadError.value = e
	} finally {
		loading.value = false
	}
}
async function stopAll() {
	try {
		await api.stop()
	} catch (e) {
		loadError.value = e
	}
}

watch(section, id => {
	if (id !== 'report') reportTarget.value = ''
	try {
		localStorage.setItem(SECTION_KEY, id)
	} catch (e) {
		/* private window: the module just is not remembered */
	}
})
// the page can already be open (kept by DWC) with another module on show: the saved section alone would not be read again
function onGoto(ev) {
	const id = ev && ev.detail && ev.detail.section
	if (id) section.value = snapshot.value ? allowedModule(id, snapshot.value.modules, min => atLeast(min)) : id
}
window.addEventListener(GOTO_EVENT, onGoto)
watch(publishedKey, () => reloadSoon()) // a run started or ended: the lights and the modules may have changed
watch(identityTick, () => load())

load()
const clock = setInterval(() => { now.value = Math.floor(Date.now() / 1000) }, 1000)
onBeforeUnmount(() => {
	window.removeEventListener(GOTO_EVENT, onGoto)
	clearInterval(clock)
	clearTimeout(reloadTimer)
})
</script>
