<template>
	<v-container :style="secStyle" fluid class="pa-0 machine-page workshop-theme">
		<service-notice />
		<!-- header (DESIGN.md 3): the common page header; the health chip is the worst light of the overview -->
		<page-header :lead="t('page.lead')" icon="mdi-tune-variant" :title="t('common.machine')" :reasons="headerReasons" :loading="!snapshot">
			<control-holder-chip :model="model" />
			<template v-slot:right>
				<!-- STOP: every role, while a procedure lasts (machine.stop; it is not the emergency stop) -->
				<template v-if="runningKind">
					<v-chip small color="info" outlined><v-icon x-small left>mdi-cog-play-outline</v-icon>{{ t('page.running_now', { kind: kindName(runningKind) }) }}</v-chip>
					<v-btn small color="error" :title="t('page.stop_hint')" @click="stopAll()"><v-icon small left>mdi-stop</v-icon>{{ t('page.stop_all') }}</v-btn>
				</template>
				<v-btn small icon :title="t('page.refresh')" :loading="loading" @click="load()"><v-icon small>mdi-refresh</v-icon></v-btn>
			</template>
			<!-- start-up of the machine modes: the chip is here like in every page; its cards are in the "Modes" section -->
			<template v-slot:startup><modes-startup /></template>
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
							<v-alert v-if="unavailable.length" dense outlined type="warning" class="mt-3">
								<div class="font-weight-medium">{{ t('page.unavailable_title') }}</div>
								<div v-for="u in unavailable" :key="u.id" class="text-body-2">{{ u.name }}: {{ u.reason }}</div>
							</v-alert>
							<v-alert v-if="!caps.read" dense outlined type="info" class="mt-3">{{ t('page.viewer_only') }}</v-alert>
						</template>
						<probe-module v-else-if="section === 'probe'" :api="api" :published="published" :can-run="caps.run" :thresholds="snapshot && snapshot.thresholds" :axes="axes" :now="now" />
						<level-module v-else-if="section === 'level'" :api="api" :published="published" :can-run="caps.run" :can-write="caps.run" :ready="snapshot && snapshot.ready" :profile="snapshot && snapshot.levelling" :axes="axes" :now="now" />
						<mesh-module
							v-else-if="section === 'mesh'" :api="api" :published="published" :can-run="caps.run" :can-write="caps.meshWrite" :ready="snapshot && snapshot.ready"
							:axes="axes" :quality="snapshot && snapshot.meshQuality" :now="now" @changed="load()"
						/>
						<offsets-module v-else-if="section === 'offsets'" :api="api" :can-write="caps.configure('config.g10')" :can-run="caps.run" :tool-pair="snapshot && snapshot.toolPair" :published="published" :measure="visionMeasure" :now="now" />
						<height-module v-else-if="section === 'height'" :api="api" :can-write="caps.run" :asked="askedPoint" />
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

<script>
'use strict'

// WorkshopMachine v2 page shell: header (traffic light, who is running what, STOP), side bar of modules and one module at a time.
// What the page knows comes from machine.overview (every role) or machine.state (operator and up) and from the progress the service
// publishes in its plugin data `machine`; the sequences themselves run in the service. Roles: lib/gating.js.

import { sectionColor } from './section-colors.js'
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
import { roleMixin } from './role-mixin.js'
import { pluginOf } from './workshop-ids.js'
import { machineApi } from './api/machine-client.js'
import { normalizeRuns } from './api/machine-api.js'
import { moduleItems, allowedModule, capabilitiesOf } from './lib/gating.js'
import { lightView, worstLight } from './lib/traffic.js'
import { querySection, askedPoint } from './lib/cross-page.js'

const SECTION_KEY = 'workshopMachineSection'
const GOTO_EVENT = 'workshop-machine-goto' // another plugin (Workbench) sends the person to a module of this page: {section}
const RELOAD_MS = 250

// the module to open: the one the route query asks for (the Workbench sends ?layout=..&x=..&y=.., lib/cross-page.js), else the last one
function savedSection(query) {
	const asked = querySection(query)
	if (asked) return asked
	try {
		return localStorage.getItem(SECTION_KEY) || 'overview'
	} catch (e) {
		return 'overview'
	}
}

export default {
	mixins: [roleMixin],
	components: { PageHeader, ServiceNotice, ErrorNotice, SideTabs, ControlHolderChip, OverviewCard, ProbeModule, LevelModule, MeshModule, OffsetsModule, HeightModule, LimitsModule, AreaModule, CalibrationModule, MotionModule, ShapingModule, SafetyModule, MaintenanceModule, HistoryModule, ModesModule, ModesStartup, ReportModule },
	data() {
		return { api: machineApi, section: savedSection(this.$route && this.$route.query), snapshot: null, loadError: null, loading: false, reportTarget: '', now: Math.floor(Date.now() / 1000), reloadTimer: null, clock: null }
	},
	computed: {
		secStyle() {
			return { '--wf-sec': sectionColor(this.section) }
		},
		// the Z point of the Workbench's active zone, for the Height module
		askedPoint() {
			return askedPoint(this.$route && this.$route.query)
		},
		model() {
			return this.$store.state.machine.model
		},
		axes() {
			const mv = this.model && this.model.move
			return (mv && mv.axes) || []
		},
		// the progress the service publishes (plugins.WorkshopService.data.machine): runs in progress without asking
		published() {
			const pm = pluginOf(this.model.plugins, 'service')
			const d = pm && pm.data
			const raw = d && (typeof d.get === 'function' ? d.get('machine') : d.machine)
			return raw ? normalizeRuns(raw) : null
		},
		runningKind() {
			if (this.published && this.published.active) return this.published.active.kind
			return this.snapshot && this.snapshot.run.active ? this.snapshot.run.kind : ''
		},
		publishedKey() {
			const a = this.published && this.published.active
			return a ? a.id + ':' + a.state : 'idle'
		},
		caps() {
			return capabilitiesOf(min => this.atLeast(min), (op, ctx) => this.canDo(op, ctx)) // workshopCan: the server's table
		},
		sideItems() {
			return moduleItems(this.snapshot && this.snapshot.modules, min => this.atLeast(min)).map(i => ({
				id: i.id, icon: i.icon, label: this.t(i.labelKey), group: i.groupKey ? this.t(i.groupKey) : undefined, disabled: i.disabled, badge: i.disabled ? '!' : ''
			}))
		},
		// a module the machine cannot use stays in the bar, disabled, and the overview says why
		unavailable() {
			return moduleItems(this.snapshot && this.snapshot.modules, min => this.atLeast(min)).filter(i => i.disabled).map(i => ({ id: i.id, name: this.t(i.labelKey), reason: this.t(i.reasonKey) }))
		},
		// Vision can measure a mark (machine.state vision.measure); null until the state says
		visionMeasure() {
			return this.snapshot && this.snapshot.vision ? this.snapshot.vision.measure : null
		},
		// what the page header counts: the worst light of the overview (the service problem and the session are added by it)
		headerReasons() {
			const lvl = levelOfColor(this.worst.color);
			return lvl === 'ok' ? [] : [{ level: lvl, text: this.t(this.worst.textKey) }];
		},
		worst() {
			return lightView({ light: this.snapshot ? worstLight(this.snapshot) : 'never' })
		}
	},
	watch: {
		section(id) {
			if (id !== 'report') this.reportTarget = ''
			try {
				localStorage.setItem(SECTION_KEY, id)
			} catch (e) {
				/* private window: the module just is not remembered */
			}
		},
		// the page is already open and the Workbench pushes a new query (another tab, a Z point): the query wins, as it does at start-up
		'$route.query'(q) {
			const asked = querySection(q)
			if (asked) this.section = this.snapshot ? allowedModule(asked, this.snapshot.modules, min => this.atLeast(min)) : asked
		},
		publishedKey() {
			this.reloadSoon() // a run started or ended: the lights and the modules may have changed
		},
		identityTick() {
			this.load()
		}
	},
	created() {
		window.addEventListener(GOTO_EVENT, this.onGoto)
		this.load()
		this.clock = setInterval(() => { this.now = Math.floor(Date.now() / 1000) }, 1000)
	},
	beforeDestroy() {
		window.removeEventListener(GOTO_EVENT, this.onGoto)
		clearInterval(this.clock)
		clearTimeout(this.reloadTimer)
	},
	methods: {
		t(key, params) {
			return this.$t('plugins.WorkshopMachine.' + key, params)
		},
		kindName(kind) {
			return this.t('kinds.' + String(kind).replace('.', '_'))
		},
		// the page can already be open (kept by DWC) with another module on show: the saved section alone would not be read again
		onGoto(ev) {
			const id = ev && ev.detail && ev.detail.section
			if (id) this.section = this.snapshot ? allowedModule(id, this.snapshot.modules, min => this.atLeast(min)) : id
		},
		// the History module asks for the report of one record
		openReport(id) {
			this.reportTarget = id
			this.section = 'report'
		},
		reloadSoon() {
			clearTimeout(this.reloadTimer)
			this.reloadTimer = setTimeout(() => this.load(), RELOAD_MS)
		},
		async load() {
			this.loading = true
			try {
				this.snapshot = this.atLeast('operator') ? await this.api.state() : await this.api.overview()
				this.loadError = null
				this.section = allowedModule(this.section, this.snapshot.modules, min => this.atLeast(min))
			} catch (e) {
				this.loadError = e
			} finally {
				this.loading = false
			}
		},
		async stopAll() {
			try {
				await this.api.stop()
			} catch (e) {
				this.loadError = e
			}
		}
	}
}
</script>
