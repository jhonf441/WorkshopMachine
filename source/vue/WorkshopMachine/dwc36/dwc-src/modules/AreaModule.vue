<template>
	<div class="area-module">
		<card-head icon="mdi-vector-rectangle" :title="t('workarea.title')" />
		<section-notice :error="st.loadError" retry @retry="reload()" />
		<role-note v-if="!canWrite" min="technician" :ops="accessOps.area" class="mb-3" :subject="$t('plugins.WorkshopMachine.subjects.area')" />
		<template v-if="st.data">
			<v-alert v-if="macrosMissing" dense outlined type="warning" class="mb-3">{{ tx('workarea.macros_missing') }}</v-alert>
			<v-alert v-if="!st.data.file" dense outlined type="info" class="mb-3">{{ t('workarea.file_missing') }}</v-alert>
			<div class="d-flex align-center flex-wrap mb-3" style="gap:8px">
				<v-btn-toggle :value="st.mode" mandatory dense @change="pickMode">
					<v-btn v-for="m in st.data.editModes" :key="m" :value="m" small :title="m === st.data.mode ? t('workarea.mode_in_use') : ''">{{ m }}<v-icon v-if="m === st.data.mode" x-small right color="success">mdi-circle-medium</v-icon></v-btn>
				</v-btn-toggle>
				<span class="text-caption machine-faint">{{ t('workarea.mode_note', { mode: st.mode, current: st.data.mode || '?' }) }}</span>
			</div>
			<v-alert v-if="st.mode === 'FFF'" dense outlined type="info" class="mb-3">{{ t('workarea.fff_pointer_note') }}</v-alert>
			<div class="wf-group mb-3">
				<div>
					<area-fields
						:mode="st.mode" :draft="st.draft" :saved="saved" :problems="check.problems" :reach="st.data.reach" :min-mm="st.data.minMm" :dirty="dirty"
						:valid="check.ok" :working="st.working" :save-act="saveAct" :remove-act="removeAct" :can-write="canWrite"
						@field="onField" @save="doSave()" @remove="doRemove()" @undo="onUndo()"
					/>
				</div>
			</div>
			<div class="wf-group mb-3">
				<div>
					<area-hand
						:corners="st.corners" :release-block="blockedWhy('release')" :capture-block="blockedWhy('capture')" :released="st.released"
						:working="st.working" :can-write="canWrite" :here-ok="!!toolPoint(axes)" @release="doRelease()" @capture="doCapture" @here="doHere"
					/>
				</div>
			</div>
			<div class="wf-group mb-3">
				<div>
					<area-saved :positions="st.positions" :pick="st.savedPick" :can-write="canWrite" @pick="doPickSaved" />
				</div>
			</div>
			<div class="wf-group mb-3">
				<div>
					<div class="text-subtitle-2 mb-1">{{ t('workarea.map_title') }}</div>
					<p class="text-body-2 machine-faint">{{ t('workarea.map_intro') }}</p>
					<v-btn-toggle v-model="st.tool" mandatory dense class="machine-btn-wrap mb-2">
						<v-btn value="a" small>{{ t('workarea.tool_a') }}</v-btn>
						<v-btn value="b" small>{{ t('workarea.tool_b') }}</v-btn>
						<v-btn value="goto" small :disabled="!canWrite" :title="t('workarea.tool_goto_tip')">{{ t('workarea.tool_goto') }}</v-btn>
					</v-btn-toggle>
					<div v-if="st.tool === 'goto' && blockedWhy('goto')" class="text-caption machine-faint mb-1">{{ blockedWhy('goto') }}</div>
					<area-map :reach="st.data.reach" :saved="saved" :draft="check.rect" :corners="st.corners" :editable="canWrite" @region="onRegion" @pick="onPick" />
				</div>
			</div>
			<div class="wf-group mb-3">
				<div>
					<div class="text-subtitle-2 mb-1">{{ t('workarea.frame_title') }}</div>
					<p class="text-body-2 machine-faint">{{ t('workarea.frame_intro') }}</p>
					<v-btn small outlined :disabled="!canWrite || !!block('frame')" :loading="st.working === 'frame'" :title="blockedWhy('frame')" @click="doFrame()">
						<v-icon small left>mdi-vector-rectangle</v-icon>{{ t('workarea.frame') }}
					</v-btn>
					<div v-if="dirty" class="text-caption machine-faint mt-1">{{ t('workarea.frame_save_first') }}</div>
					<div v-else-if="blockedWhy('frame') && !st.working" class="text-caption machine-faint mt-1">{{ blockedWhy('frame') }}</div>
				</div>
			</div>
		</template>
		<div v-if="st.notice" class="text-body-2 success--text">{{ st.notice }}</div>
		<div v-if="st.errorKey || st.error" class="text-body-2 error--text">{{ st.errorKey ? t(st.errorKey) : st.error }}</div>
		<help-fold :title="t('workarea.title')" class="mt-4"><p>{{ tx('workarea.intro') }}</p><div class="help-tip-title">{{ t('workarea.corners_title') }}</div><p>{{ t('workarea.corners_intro') }}</p></help-fold>
	</div>
</template>

<script>
'use strict'

// Work area of each mode (it was a card of the Workbench, Zones > Cut area): the numbers, the hand measurement of two opposite corners, the pick on the
// bed map and the walk of the saved area with the pointer. The service keeps the data and moves the machine (machine.workarea.*); this draws it.

import SectionNotice from './SectionNotice.vue' // one notice per cause
import AreaFields from './AreaFields.vue'
import AreaHand from './AreaHand.vue'
import AreaSaved from './AreaSaved.vue'
import AreaMap from './AreaMap.vue'
import { textMixin } from './text-mixin.js'
import { blockKey, toolPoint } from '../lib/workarea.js'
import { createAreaState, selectMode, setField, setRect, setCorner, savedRect, checked, isDirty, blocked, load, save, remove, release, capture, hereCorner, gotoPoint, frame, loadPositions, pickPosition } from '../state/area-state.js'
import RoleNote from './RoleNote.vue'
import { createAction } from '../workshop-action.js' // vue/_shared36
import CardHead from '../CardHead.vue' // vue/_shared36
import HelpFold from '../HelpFold.vue' // vue/_shared36

export default {
	components: { CardHead, HelpFold, RoleNote, SectionNotice, AreaFields, AreaHand, AreaSaved, AreaMap },
	mixins: [textMixin],
	props: {
		api: { type: Object, required: true }, // createMachineApi(...)
		canWrite: { type: Boolean, default: false }, // technician
		axes: { type: Array, default: () => [] } // move.axes of the DWC model (where the tool is)
	},
	data() {
		return { st: createAreaState() }
	},
	computed: {
		toolPoint() {
			return toolPoint
		},
		workarea() {
			return this.api.workarea
		},
		saved() {
			return savedRect(this.st)
		},
		check() {
			return checked(this.st)
		},
		dirty() {
			return this.st.data ? isDirty(this.st) : false
		},
		macrosMissing() {
			const d = this.st.data
			return !!d && Object.keys(d.macros).some(k => !d.macros[k])
		}
	},
	created() {
		// Save and Remove are writes of the family (the state keeps `working` to lock the other buttons; the answer is the control's own line, not st.notice / st.error)
		this.saveAct = createAction({ run: () => this.write(() => save(this.st, this.workarea, ''), 'workarea.saved_notice') })
		this.removeAct = createAction({ arm: 'double', run: () => this.write(() => remove(this.st, this.workarea, ''), 'workarea.removed_notice') })
		this.reload()
	},
	beforeDestroy() {
		this.saveAct.dispose()
		this.removeAct.dispose()
	},
	methods: {
		block(action) {
			return blocked(this.st, action)
		},
		blockedWhy(action) {
			const key = blockKey(this.block(action))
			return key ? this.tx(key, { mode: this.st.mode }) : ''
		},
		pickMode(mode) {
			if (mode) selectMode(this.st, mode)
		},
		onField(key, value) {
			setField(this.st, key, value)
		},
		onUndo() {
			selectMode(this.st, this.st.mode)
		},
		onRegion(rect) {
			setRect(this.st, rect)
		},
		onPick(point) {
			if (this.st.tool === 'goto') {
				if (this.canWrite && !this.block('goto')) gotoPoint(this.st, this.workarea, point)
				return
			}
			setCorner(this.st, this.st.tool, point)
		},
		// the state functions answer true/false and keep the failure in st.error; a write of the family throws it instead
		async write(call, doneKey) {
			if (!(await call())) {
				const text = this.st.errorKey ? this.t(this.st.errorKey) : this.st.error
				this.st.error = ''
				this.st.errorKey = ''
				throw Object.assign(new Error(text), { code: 'internal' })
			}
			return { text: this.t(doneKey, { mode: this.st.mode }) }
		},
		doSave() {
			this.saveAct.run({})
		},
		doRemove() {
			this.removeAct.run({})
		},
		doRelease() {
			release(this.st, this.workarea)
		},
		doHere(which) {
			hereCorner(this.st, this.axes, which)
		},
		doPickSaved(which, index) {
			pickPosition(this.st, which, index)
		},
		doCapture(which) {
			capture(this.st, this.workarea, which)
		},
		doFrame() {
			frame(this.st, this.workarea)
		},
		reload() {
			load(this.st, this.workarea)
		}
	}
}
</script>

<style>
/* phone: the three tools of the map wrap instead of making the page scroll sideways */
.area-module .machine-btn-wrap {
	flex-wrap: wrap;
	height: auto !important;
	max-width: 100%;
}
</style>
