<template>
	<div class="area-module">
		<div class="text-h6 mb-1">{{ t('workarea.title') }}</div>
		<details class="wf-more">
			<summary>{{ t('common.how_it_works') }}</summary>
		<p class="text-body-2 machine-faint">{{ t('workarea.intro') }}</p>
		</details>
		<error-notice :error="st.loadError" retry @retry="reload()" />
		<v-alert v-if="!canWrite" dense outlined type="info" class="mb-3">{{ t('workarea.read_only') }}</v-alert>
		<template v-if="st.data">
			<v-alert v-if="macrosMissing" dense outlined type="warning" class="mb-3">{{ t('workarea.macros_missing') }}</v-alert>
			<v-alert v-if="!st.data.file" dense outlined type="info" class="mb-3">{{ t('workarea.file_missing') }}</v-alert>
			<div class="d-flex align-center flex-wrap mb-3" style="gap:8px">
				<v-btn-toggle :value="st.mode" mandatory dense @change="pickMode">
					<v-btn v-for="m in st.data.editModes" :key="m" :value="m" small :title="m === st.data.mode ? t('workarea.mode_in_use') : ''">{{ m }}<v-icon v-if="m === st.data.mode" x-small right color="success">mdi-circle-medium</v-icon></v-btn>
				</v-btn-toggle>
				<span class="text-caption machine-faint">{{ t('workarea.mode_note', { mode: st.mode, current: st.data.mode || '?' }) }}</span>
			</div>
			<v-alert v-if="st.mode === 'FFF'" dense outlined type="info" class="mb-3">{{ t('workarea.fff_pointer_note') }}</v-alert>
			<v-card outlined class="mb-3">
				<v-card-text>
					<area-fields
						:mode="st.mode" :draft="st.draft" :saved="saved" :problems="check.problems" :reach="st.data.reach" :min-mm="st.data.minMm" :dirty="dirty"
						:valid="check.ok" :working="st.working" :can-write="canWrite"
						@field="onField" @save="doSave()" @remove="doRemove()" @undo="onUndo()"
					/>
				</v-card-text>
			</v-card>
			<v-card outlined class="mb-3">
				<v-card-text>
					<area-hand
						:corners="st.corners" :release-block="blockText('release')" :capture-block="blockText('capture')" :released="st.released"
						:working="st.working" :can-write="canWrite" :here-ok="!!toolPoint(axes)" @release="doRelease()" @capture="doCapture" @here="doHere"
					/>
				</v-card-text>
			</v-card>
			<v-card outlined class="mb-3">
				<v-card-text>
					<div class="text-subtitle-2 mb-1">{{ t('workarea.map_title') }}</div>
					<p class="text-body-2 machine-faint">{{ t('workarea.map_intro') }}</p>
					<v-btn-toggle v-model="st.tool" mandatory dense class="machine-btn-wrap mb-2">
						<v-btn value="a" small>{{ t('workarea.tool_a') }}</v-btn>
						<v-btn value="b" small>{{ t('workarea.tool_b') }}</v-btn>
						<v-btn value="goto" small :disabled="!canWrite" :title="t('workarea.tool_goto_tip')">{{ t('workarea.tool_goto') }}</v-btn>
					</v-btn-toggle>
					<div v-if="st.tool === 'goto' && blockText('goto')" class="text-caption machine-faint mb-1">{{ blockText('goto') }}</div>
					<area-map :reach="st.data.reach" :saved="saved" :draft="check.rect" :corners="st.corners" :editable="canWrite" @region="onRegion" @pick="onPick" />
				</v-card-text>
			</v-card>
			<v-card outlined class="mb-3">
				<v-card-text>
					<div class="text-subtitle-2 mb-1">{{ t('workarea.frame_title') }}</div>
					<p class="text-body-2 machine-faint">{{ t('workarea.frame_intro') }}</p>
					<v-btn small outlined :disabled="!canWrite || !!block('frame')" :loading="st.working === 'frame'" :title="blockText('frame')" @click="doFrame()">
						<v-icon small left>mdi-vector-rectangle</v-icon>{{ t('workarea.frame') }}
					</v-btn>
					<div v-if="dirty" class="text-caption machine-faint mt-1">{{ t('workarea.frame_save_first') }}</div>
					<div v-else-if="blockText('frame') && !st.working" class="text-caption machine-faint mt-1">{{ blockText('frame') }}</div>
				</v-card-text>
			</v-card>
		</template>
		<div v-if="st.notice" class="text-body-2 success--text">{{ st.notice }}</div>
		<div v-if="st.errorKey || st.error" class="text-body-2 error--text">{{ st.errorKey ? t(st.errorKey) : st.error }}</div>
	</div>
</template>

<script>
'use strict'

// Work area of each mode (it was a card of the Workbench, Zones > Cut area): the numbers, the hand measurement of two opposite corners, the pick on the
// bed map and the walk of the saved area with the pointer. The service keeps the data and moves the machine (machine.workarea.*); this draws it.

import ErrorNotice from '../ErrorNotice.vue' // vue/_shared
import AreaFields from './AreaFields.vue'
import AreaHand from './AreaHand.vue'
import AreaMap from './AreaMap.vue'
import { textMixin } from './text-mixin.js'
import { blockKey, toolPoint } from '../lib/workarea.js'
import { createAreaState, selectMode, setField, setRect, setCorner, savedRect, checked, isDirty, blocked, load, save, remove, release, capture, hereCorner, gotoPoint, frame } from '../state/area-state.js'

export default {
	components: { ErrorNotice, AreaFields, AreaHand, AreaMap },
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
		this.reload()
	},
	methods: {
		block(action) {
			return blocked(this.st, action)
		},
		blockText(action) {
			const key = blockKey(this.block(action))
			return key ? this.t(key, { mode: this.st.mode }) : ''
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
		doSave() {
			save(this.st, this.workarea, this.t('workarea.saved_notice', { mode: this.st.mode }))
		},
		doRemove() {
			remove(this.st, this.workarea, this.t('workarea.removed_notice', { mode: this.st.mode }))
		},
		doRelease() {
			release(this.st, this.workarea)
		},
		doHere(which) {
			hereCorner(this.st, this.axes, which)
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
