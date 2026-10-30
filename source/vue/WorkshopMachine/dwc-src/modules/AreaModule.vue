<template>
	<div class="area-module">
		<div class="text-title-large mb-1">{{ t('workarea.title') }}</div>
		<details class="wf-more">
			<summary>{{ t('common.how_it_works') }}</summary>
		<p class="text-body-medium machine-faint">{{ t('workarea.intro') }}</p>
		</details>
		<error-notice :error="st.loadError" retry @retry="reload()" />
		<v-alert v-if="!canWrite" density="compact" variant="outlined" type="info" class="mb-3">{{ t('workarea.read_only') }}</v-alert>
		<template v-if="st.data">
			<v-alert v-if="macrosMissing" density="compact" variant="outlined" type="warning" class="mb-3">{{ t('workarea.macros_missing') }}</v-alert>
			<v-alert v-if="!st.data.file" density="compact" variant="outlined" type="info" class="mb-3">{{ t('workarea.file_missing') }}</v-alert>
			<div class="d-flex align-center flex-wrap mb-3" style="gap:8px">
				<v-btn-toggle :model-value="st.mode" mandatory density="compact" @update:model-value="pickMode">
					<v-btn v-for="m in st.data.editModes" :key="m" :value="m" size="small" :title="m === st.data.mode ? t('workarea.mode_in_use') : ''">{{ m }}<v-icon v-if="m === st.data.mode" size="x-small" end color="success">mdi-circle-medium</v-icon></v-btn>
				</v-btn-toggle>
				<span class="text-body-small machine-faint">{{ t('workarea.mode_note', { mode: st.mode, current: st.data.mode || '?' }) }}</span>
			</div>
			<v-alert v-if="st.mode === 'FFF'" density="compact" variant="outlined" type="info" class="mb-3">{{ t('workarea.fff_pointer_note') }}</v-alert>
			<v-card variant="outlined" class="mb-3">
				<v-card-text>
					<area-fields
						:mode="st.mode" :draft="st.draft" :saved="saved" :problems="check.problems" :reach="st.data.reach" :min-mm="st.data.minMm" :dirty="dirty"
						:valid="check.ok" :working="st.working" :can-write="canWrite"
						@field="(k, v) => setField(st, k, v)" @save="doSave()" @remove="doRemove()" @undo="selectMode(st, st.mode)"
					/>
				</v-card-text>
			</v-card>
			<v-card variant="outlined" class="mb-3">
				<v-card-text>
					<area-hand
						:corners="st.corners" :release-block="blockText('release')" :capture-block="blockText('capture')" :released="st.released"
						:working="st.working" :can-write="canWrite" :here-ok="!!toolPoint(axes)" @release="doRelease()" @capture="doCapture" @here="doHere"
					/>
				</v-card-text>
			</v-card>
			<v-card variant="outlined" class="mb-3">
				<v-card-text>
					<area-saved :positions="st.positions" :pick="st.savedPick" :can-write="canWrite" @pick="doPickSaved" />
				</v-card-text>
			</v-card>
			<v-card variant="outlined" class="mb-3">
				<v-card-text>
					<div class="text-title-small mb-1">{{ t('workarea.map_title') }}</div>
					<p class="text-body-medium machine-faint">{{ t('workarea.map_intro') }}</p>
					<v-btn-toggle v-model="st.tool" mandatory density="compact" class="machine-btn-wrap mb-2">
						<v-btn value="a" size="small">{{ t('workarea.tool_a') }}</v-btn>
						<v-btn value="b" size="small">{{ t('workarea.tool_b') }}</v-btn>
						<v-btn value="goto" size="small" :disabled="!canWrite" :title="t('workarea.tool_goto_tip')">{{ t('workarea.tool_goto') }}</v-btn>
					</v-btn-toggle>
					<div v-if="st.tool === 'goto' && blockText('goto')" class="text-body-small machine-faint mb-1">{{ blockText('goto') }}</div>
					<area-map :reach="st.data.reach" :saved="saved" :draft="check.rect" :corners="st.corners" :editable="canWrite" @region="onRegion" @pick="onPick" />
				</v-card-text>
			</v-card>
			<v-card variant="outlined" class="mb-3">
				<v-card-text>
					<div class="text-title-small mb-1">{{ t('workarea.frame_title') }}</div>
					<p class="text-body-medium machine-faint">{{ t('workarea.frame_intro') }}</p>
					<v-btn size="small" variant="outlined" :disabled="!canWrite || !!block('frame')" :loading="st.working === 'frame'" :title="blockText('frame')" @click="frame(st, workarea)">
						<v-icon size="small" start>mdi-vector-rectangle</v-icon>{{ t('workarea.frame') }}
					</v-btn>
					<div v-if="dirty" class="text-body-small machine-faint mt-1">{{ t('workarea.frame_save_first') }}</div>
					<div v-else-if="blockText('frame') && !st.working" class="text-body-small machine-faint mt-1">{{ blockText('frame') }}</div>
				</v-card-text>
			</v-card>
		</template>
		<div v-if="st.notice" class="text-body-medium text-success">{{ st.notice }}</div>
		<div v-if="st.errorKey || st.error" class="text-body-medium text-error">{{ st.errorKey ? t(st.errorKey) : st.error }}</div>
	</div>
</template>

<script setup>
// Work area of each mode (it was a card of the Workbench, Zones > Cut area): the numbers, the hand measurement of two opposite corners, the pick on the
// bed map and the walk of the saved area with the pointer. The service keeps the data and moves the machine (machine.workarea.*); this draws it.

import { computed, reactive } from 'vue'
import ErrorNotice from '../ErrorNotice.vue' // vue/_shared
import AreaFields from './AreaFields.vue'
import AreaHand from './AreaHand.vue'
import AreaSaved from './AreaSaved.vue'
import AreaMap from './AreaMap.vue'
import { t } from '../text.js'
import { blockKey, toolPoint } from '../lib/workarea.js'
import { createAreaState, selectMode, setField, setRect, setCorner, savedRect, checked, isDirty, blocked, load, save, remove, release, capture, hereCorner, gotoPoint, frame, loadPositions, pickPosition } from '../state/area-state.js'

const props = defineProps({
	api: { type: Object, required: true }, // createMachineApi(...)
	canWrite: { type: Boolean, default: false }, // technician
	axes: { type: Array, default: () => [] } // move.axes of the DWC model (where the tool is)
})

const st = reactive(createAreaState())
const workarea = props.api.workarea

const saved = computed(() => savedRect(st))
const check = computed(() => checked(st))
const dirty = computed(() => (st.data ? isDirty(st) : false))
const macrosMissing = computed(() => !!st.data && Object.keys(st.data.macros).some(k => !st.data.macros[k]))

function block(action) {
	return blocked(st, action)
}
function blockText(action) {
	const key = blockKey(block(action))
	return key ? t(key, { mode: st.mode }) : ''
}
function pickMode(mode) {
	if (mode) selectMode(st, mode)
}
function onRegion(rect) {
	setRect(st, rect)
}
function onPick(point) {
	if (st.tool === 'goto') {
		if (props.canWrite && !block('goto')) gotoPoint(st, workarea, point)
		return
	}
	setCorner(st, st.tool, point)
}
function doSave() {
	save(st, workarea, t('workarea.saved_notice', { mode: st.mode }))
}
function doRemove() {
	remove(st, workarea, t('workarea.removed_notice', { mode: st.mode }))
}
function doRelease() {
	release(st, workarea)
}
function doHere(which) {
	hereCorner(st, props.axes, which)
}
function doPickSaved(which, index) {
	pickPosition(st, which, index)
}
function doCapture(which) {
	capture(st, workarea, which)
}
function reload() {
	load(st, workarea)
}

load(st, workarea)
loadPositions(st, workarea)
</script>

<style>
/* phone: the three tools of the map wrap instead of making the page scroll sideways */
.area-module .machine-btn-wrap {
	flex-wrap: wrap;
	height: auto !important;
	max-width: 100%;
}
</style>
