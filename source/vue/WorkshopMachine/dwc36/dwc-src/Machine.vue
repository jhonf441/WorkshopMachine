<template>
	<v-container :style="secStyle" fluid class="pa-0 machine-page workshop-theme">
		<!-- header (DESIGN.md 3): the common page header; the health chip is the worst light of the overview -->
		<!-- the compact bar of the family (one line, 48): the lead is not drawn, only read; its sentence is shown once, under the head of the overview -->
		<page-header :lead="t('page.lead')" icon="mdi-tune-variant" :title="t('common.machine')" :reasons="headerReasons" :loading="!snapshot">
			<control-holder-chip :model="model" />
			<template v-slot:right>
				<!-- STOP: every role, while a procedure lasts (machine.stop; it is not the emergency stop) -->
				<template v-if="runningKind">
					<v-chip small color="info" outlined><v-icon x-small left>mdi-cog-play-outline</v-icon>{{ t('page.running_now', { kind: kindName(runningKind) }) }}</v-chip>
					<v-btn small color="error darken-2" class="machine-stop" :title="t('page.stop_hint')" @click="stopAll()"><v-icon small left>mdi-stop</v-icon>{{ t('page.stop_all') }}</v-btn>
				</template>
				<v-btn small icon :title="t('page.refresh')" :loading="loading" @click="load()"><v-icon small>mdi-refresh</v-icon></v-btn>
			</template>
			<!-- start-up of the machine modes: the chip is here like in every page; its cards are in the "Modes" section -->
			<template v-slot:startup><modes-startup /></template>
		</page-header>
		<!-- the bar first, then the bands under it (DESIGN.md 7d): not in SBC mode / service down, then the failed call; the sections do not repeat them (SectionNotice) -->
		<service-notice />
		<error-notice :error="shownError" retry @retry="load()" />
		<div class="mb-3">
			<div>
				<div class="st-layout">
					<side-tabs :value="section" :items="sideItems" @input="changeSection" />
					<!-- one module at a time, mounted only while it is open (DESIGN.md 3) -->
					<div :key="sessionKey" class="st-body">
						<!-- the modules that need the FFF mode (shaping): in another mode (or while it is not known) the module stays for reading and what runs is off (mode-gate.js) -->
						<mode-notice v-if="fffOnlySection && !lockedNow" :needs="['FFF']" />
						<locked-cover v-if="lockedNow" :needed="lockedNow" :items="sideItems" :value="section" />
						<template v-else-if="section === 'overview'">
							<overview-card :overview="snapshot" :failed="!!loadError" :lock-kind="overviewCause" :lead="t('page.lead')" />
							<div v-if="unavailable.length" class="machine-line-notice machine-line-notice--warn mt-3" role="status">
								<v-icon small color="warning">mdi-alert-outline</v-icon>
								<span class="font-weight-medium">{{ t('page.unavailable_title') }}:</span>
								<span v-for="(u, i) in unavailable" :key="u.id">{{ u.name }} ({{ u.reason }}){{ i + 1 !== unavailable.length ? ',' : '' }}</span>
							</div>
							<role-note v-if="!caps.read && !overviewCause" min="operator" class="mt-3" :subject="$t('plugins.WorkshopMachine.subjects.overview')" />
						</template>
						<probe-module v-else-if="section === 'probe'" :api="api" :published="published" :can-run="ok('run')" :thresholds="snapshot && snapshot.thresholds" :axes="axes" :now="now" />
						<level-module v-else-if="section === 'level'" :api="api" :published="published" :can-run="ok('run')" :can-write="ok('run')" :ready="snapshot && snapshot.ready" :profile="snapshot && snapshot.levelling" :axes="axes" :now="now" />
						<mesh-module
							v-else-if="section === 'mesh'" :api="api" :published="published" :can-run="ok('run')" :can-write="ok('mesh')" :ready="snapshot && snapshot.ready"
							:axes="axes" :quality="snapshot && snapshot.meshQuality" :now="now" @changed="load()"
						/>
						<offsets-module v-else-if="section === 'offsets'" :api="api" :can-write="caps.configure('config.g10')" :can-run="ok('run')" :can-mark="ok('mark')" :tool-pair="snapshot && snapshot.toolPair" :published="published" :measure="visionMeasure" :now="now" />
						<height-module v-else-if="section === 'height'" :api="api" :can-write="ok('height')" :asked="askedPoint" />
						<limits-module
							v-else-if="section === 'limits'" :api="api" :published="published" :can-edit="caps.configure('config.m208')" :can-run="ok('run')"
							:now="now" @changed="load()"
						/>
						<area-module v-else-if="section === 'workarea'" :api="api" :can-write="ok('area')" :axes="axes" />
						<calibration-module v-else-if="section === 'calibration'" :api="api" :configure="caps.configure" :can-write="ok('testMove')" />
						<motion-module v-else-if="section === 'motion'" :api="api" :configure="caps.configure" :trial="caps.trial" :is-admin="caps.admin" :asked="askedParam" :now="now" />
						<shaping-module
							v-else-if="section === 'shaping'" :api="api" :published="published" :configure="caps.configure" :trial="caps.trial" :can-run="ok('run')" :can-test="ok('shapingTest')" :now="now"
						/>
						<power-module v-else-if="section === 'power'" :api="api" :can-edit="caps.configure('config.m911')" :can-create="caps.configure('config.prologue')" :can-resume="ok('resume')" />
						<safety-module v-else-if="section === 'safety'" :api="api" :published="published" :can-run="ok('run')" :now="now" @goto="changeSection($event)" />
						<maintenance-module v-else-if="section === 'maintenance'" :api="api" :can-mark="canOp('machine.maintenance.done')" :can-edit="canOp('machine.maintenance.plan.set')" />
						<modes-module v-else-if="section === 'modes'" :can-write="caps.run" />
						<tool-wizard-module v-else-if="section === 'toolwiz'" :api="api" :can-write="caps.configure('config.tool')" :busy="!!runningKind" />
						<beds-module v-else-if="section === 'beds'" :api="api" :can-write="caps.configure('config.bed_heaters')" :busy="!!runningKind" :asked="askedBeds" :model="model" />
						<history-module
							v-else-if="section === 'history'" :api="api" :configure="caps.configure" :can-restore="caps.restore" :axes="axes" :quality="snapshot && snapshot.meshQuality" @report="openReport"
						/>
						<report-module v-else-if="section === 'report'" :key="reportTarget" :api="api" :target="reportTarget" :axes="axes" />
					</div>
				</div>
			</div>
		</div>
		<wf-unsaved-dialog />
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
import { errorKind } from './friendly-error.js' // vue/_shared36
import LockedCover from './LockedCover.vue' // the cover of a module the role cannot open (vue/_shared36)
import RoleNote from './modules/RoleNote.vue'
import SideTabs from './SideTabs.vue'
import WfUnsavedDialog from './WfUnsavedDialog.vue' // keep editing / save and leave / discard (vue/_shared36)
import { confirmLeave, routeGuard } from './unsaved-guard.js' // vue/_shared36: one door out of every editor with a draft
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
import PowerModule from './modules/PowerModule.vue'
import MaintenanceModule from './modules/MaintenanceModule.vue'
import HistoryModule from './modules/HistoryModule.vue'
import ModesModule from './modules/ModesModule.vue'
import ModesStartup from './modules/ModesStartup.vue'
import ToolWizardModule from './modules/ToolWizardModule.vue'
import BedsModule from './modules/BedsModule.vue'
import ReportModule from './modules/ReportModule.vue'
import { accessCanMixin } from './reason-mixin.js' // what the role and the service say (vue/_shared36)
import { modeActionMixin } from './mode-gate-mixin.js' // vue/_shared36: which mode the machine is in; what runs follows it
import ModeNotice from './ModeNotice.vue' // vue/_shared36
import { GROUPS, SCREEN_OPS, groupAllowed } from './access-groups.js'
import { pluginOf } from './workshop-ids.js'
import { machineApi } from './api/machine-client.js'
import { normalizeRuns } from './api/machine-api.js'
import { MODULES, moduleItems, lockedModuleItems, lockedModule, openableModule, capabilitiesOf } from './lib/gating.js'
import { lockKey, causeOf } from './lib/refusal.js'
import { withLockParams, useRoleName } from './modules/lock-params.js'
import { roleLabel } from './notice-kind.js' // vue/_shared36
import { ts } from './shared-t.js' // vue/_shared36
import { workshopRole } from './workshop-auth.js' // vue/_shared36
import { lightView, worstLight } from './lib/traffic.js'
import { querySection, askedPoint as askedPointOf, askedParam as askedParamOf, askedBeds as askedBedsOf, takeQuery } from './lib/cross-page.js'

const SECTION_KEY = 'workshopMachineSection' // this page's own memory of the last module (no other plugin writes it: they send ?layout=)
const RELOAD_MS = 250
// the modules that only make sense in FFF, and the groups of operations of them that run or move (an unknown mode denies them). The bed
// (levelling, mesh, bed heaters) is the same machine in any mode, so it is NOT here: what stops it is the real safety (power, access), never the mode
const FFF_ONLY_MODULES = ['shaping']
const ACTING_GROUPS = ['run', 'mesh', 'shapingTest']

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
	mixins: [accessCanMixin, modeActionMixin],
	// what the person who left had read must not stay (ESTANDAR 3): the modules are mounted again by sessionKey, the page keeps these
	sessionData: ['snapshot', 'loadError', 'reportTarget', 'askedPoint', 'askedParam', 'askedBeds'],
	sessionErrors: ['loadError'], // what a refusal or a failure said: cleared when the person signs in, out or changes role (role-mixin.js)
	// leaving the page (DWC's menu, Back) with a typed draft asks first; a change of module is changeSection
	beforeRouteLeave(to, from, next) {
		routeGuard(to, from, next)
	},
	components: { WfUnsavedDialog, ModeNotice, RoleNote, PageHeader, ServiceNotice, ErrorNotice, SideTabs, LockedCover, ControlHolderChip, OverviewCard, ProbeModule, LevelModule, MeshModule, OffsetsModule, HeightModule, LimitsModule, AreaModule, CalibrationModule, MotionModule, ShapingModule, SafetyModule, PowerModule, MaintenanceModule, HistoryModule, ModesModule, ModesStartup, ToolWizardModule, BedsModule, ReportModule },
	// the sections ask whether this page's own band already says the service is not there (modules/SectionNotice.vue)
	provide() {
		const page = this
		return { machinePage: { get serviceDown() { return page.serviceDown } } }
	},
	data() {
		return { api: machineApi, section: savedSection(this.$route && this.$route.query), askedPoint: askedPointOf(this.$route && this.$route.query), askedParam: askedParamOf(this.$route && this.$route.query), askedBeds: askedBedsOf(this.$route && this.$route.query), snapshot: null, loadError: null, loading: false, reportTarget: '', now: Math.floor(Date.now() / 1000), reloadTimer: null, clock: null, sessionKey: 0 }
	},
	computed: {
		// the open module needs the FFF mode
		fffOnlySection() {
			return FFF_ONLY_MODULES.indexOf(this.section) >= 0
		},
		secStyle() {
			return { '--wf-sec': sectionColor(this.section) }
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
		// a refusal because of who the person is is said by the lock sentence (overview card, viewer note), not by the error notice
		shownError() {
			return lockKey(this.loadError) ? null : this.loadError
		},
		// the band of the page says the service is not there
		serviceDown() {
			return !!this.shownError && errorKind(this.shownError) === 'unavailable'
		},
		// the cause of a refused overview ('session' | 'role' | ''): the card draws the standard notice
		overviewCause() {
			return causeOf(this.loadError)
		},
		// every module with its role: the quiet note says when the person does not see some
		allSections() {
			return MODULES.map(m => ({ id: m.id, min: m.min }))
		},
		sideItems() {
			return lockedModuleItems(this.snapshot && this.snapshot.modules, min => this.atLeast(min)).map(i => Object.assign({
				id: i.id, icon: i.icon, label: this.t(i.labelKey), group: i.groupKey ? this.t(i.groupKey) : undefined, disabled: i.disabled, badge: i.disabled ? '!' : ''
			}, i.locked ? { locked: i.locked } : {}))
		},
		// the role that opens the open module, or '' when this role may
		lockedNow() {
			return lockedModule(this.section, min => this.atLeast(min))
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
			if (id !== 'height') this.askedPoint = null // the Workbench's Z point was for that one visit
			if (id !== 'motion') this.askedParam = null // and the parameter the 3D printing page asked for
			if (id !== 'beds') this.askedBeds = null // and the beds its Bed zones section asked to define
			try {
				localStorage.setItem(SECTION_KEY, id)
			} catch (e) {
				/* private window: the module just is not remembered */
			}
		},
		// the page is already open (kept by DWC) with another module on show and another plugin pushes a new query (a module, a Z point): the
		// query wins, as it does at start-up
		'$route.query'(q) {
			this.answerQuery(q)
		},
		publishedKey() {
			this.reloadSoon() // a run started or ended: the lights and the modules may have changed
		},
		identityTick() {
			this.load()
		}
	},
	created() {
		// ONE call to auth.can for every group and reading of the page (the modules ask the same cache)
		this.wantCan(SCREEN_OPS)
		useRoleName(() => roleLabel(workshopRole(), ts))
		this.answerQuery(this.$route && this.$route.query)
		this.load()
		this.clock = setInterval(() => { this.now = Math.floor(Date.now() / 1000) }, 1000)
	},
	beforeDestroy() {
		clearInterval(this.clock)
		clearTimeout(this.reloadTimer)
	},
	methods: {
		// a change of module with a typed draft in the open one asks first (unsaved-guard.js)
		changeSection(id) {
			if (id === this.section) return
			confirmLeave(() => { this.section = id })
		},
		// the answer of the service for a group of operations (the table of the role until it answers)
		// the groups that RUN or write something that moves or heats (the reading ones, like the mesh library, stay open in any mode)
		ok(name) {
			if (this.fffOnlySection && ACTING_GROUPS.indexOf(name) >= 0 && this.machineMode !== 'FFF') return false
			return groupAllowed(GROUPS[name], op => this.canDo(op))
		},
		canOp(op) {
			return this.canDo(op)
		},
		t(key, params) {
			return this.$t('plugins.WorkshopMachine.' + key, withLockParams(key, params))
		},
		kindName(kind) {
			return this.t('kinds.' + String(kind).replace('.', '_'))
		},
		// The question of another plugin (the Workbench and the 3D printing page send ?layout=..&x=..&y=..&param=..) is answered ONCE: the module opens, the Z point goes to the Height module, the
		// motion parameter to the Motion module and the parameters leave the URL, so a reload or coming back to the page does not ask it again (lib/cross-page.js takeQuery).
		answerQuery(q) {
			const taken = takeQuery(q)
			if (!taken) return
			if (taken.point) this.askedPoint = taken.point
			if (taken.param) this.askedParam = taken.param
			if (taken.beds) this.askedBeds = taken.beds
			if (taken.section) this.section = this.snapshot ? openableModule(taken.section, this.snapshot.modules, min => this.atLeast(min)) : taken.section
			this.$router.replace({ path: this.$route.path, query: taken.rest }).catch(() => {})
		},
		// the History module asks for the report of one record
		openReport(id) {
			this.reportTarget = id
			this.section = 'report'
		},
		// the person signed in or out or the role changed: the open module is mounted again (its data is read when it opens)
		onSessionChange() {
			this.sessionKey++
			this.load()
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
				this.section = openableModule(this.section, this.snapshot.modules, min => this.atLeast(min))
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

<style>
/* Machine on the family scale and pieces (FAMILIA-REDISENO 2-3, owner's rule of 2026-11-23). The family gives every .v-btn 32 (a filled primary 36) and
   the 40 px touch area by an invisible ::after; here only what Vuetify still sizes on its own: a default-size secondary button is 32 too, icon buttons
   are 32 square, segments 32, and the page STOP is 48 (critical). */
.machine-page .v-btn:not(.v-btn--icon):not(.v-btn--fab):not(.machine-stop) { height: var(--wf-size-s, 32px); }
.machine-page .v-btn:is(.primary, .v-btn--main):not(.v-btn--icon):not(.v-btn--fab):not(.v-btn--text):not(.v-btn--outlined) { height: var(--wf-size-m, 36px); }
.machine-page .v-btn.v-btn--icon:not(.v-btn--fab) { width: var(--wf-size-s, 32px); height: var(--wf-size-s, 32px); }
.machine-page .v-btn.machine-stop { height: var(--wf-size-l, 48px); min-width: 96px; }
/* the sentence of the page, out of the bar: ONE secondary line under the head of the overview */
.machine-page .machine-lead { margin: -2px 0 8px; font-size: 13px; line-height: 18px; opacity: 0.72; }
/* a notice of the page (no live data, a run in progress, modules the machine cannot use): one outlined line inside the section, not a full-width band */
.machine-page .machine-line-notice { --mln: var(--wf-warn, #fb8c00); display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px; padding: 7px 12px; border: 1px solid color-mix(in srgb, var(--mln) 55%, transparent); border-radius: var(--wf-radius-control, 6px); font-size: 13px; line-height: 18px; }
.machine-page .machine-line-notice--info { --mln: var(--wf-info, #1e88e5); }
</style>
