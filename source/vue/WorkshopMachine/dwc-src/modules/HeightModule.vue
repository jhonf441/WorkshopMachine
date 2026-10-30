<template>
	<div class="height-module">
		<div class="text-title-large mb-1">{{ t('height.title') }}</div>
		<p class="text-body-medium machine-faint">{{ t('height.intro') }}</p>
		<error-notice :error="loadError" retry @retry="load()" />
		<v-alert v-if="!canWrite" density="compact" variant="outlined" type="info" class="mb-3">{{ t('height.read_only') }}</v-alert>
		<template v-if="h">
			<v-alert v-if="missing.length" density="compact" variant="outlined" type="warning" class="mb-3">
				<div>{{ t('height.hook_missing', { files: missing.join(', ') }) }}</div>
				<v-btn v-if="canWrite" size="small" color="primary" class="mt-2" :disabled="busy" :title="t('height.hook_tip')" @click="installHook()">{{ t('height.hook_apply') }}</v-btn>
			</v-alert>
			<v-btn-toggle v-model="mode" mandatory density="compact" class="mb-3">
				<v-btn v-for="m in MODES" :key="m" :value="m" size="small">{{ m }}<v-icon v-if="m === h.mode" size="x-small" end>mdi-circle-medium</v-icon></v-btn>
			</v-btn-toggle>
			<v-card variant="outlined" class="mb-3">
				<v-card-text>
					<div class="text-title-small mb-1">{{ t('height.card_title', { mode }) }}</div>
					<v-alert v-if="!view.current" density="compact" text type="info" class="mb-2 text-body-small">{{ t('height.not_current', { mode }) }}</v-alert>
					<div class="d-flex align-center flex-wrap mb-1" style="gap:8px">
						<span class="text-body-medium">{{ t('height.how') }}</span>
						<v-btn-toggle :model-value="view.data.method" density="compact" mandatory @update:model-value="setMethod">
							<v-btn v-for="m in view.methods" :key="m" :value="m" size="small" :disabled="!canWrite || busy">{{ t('height.method_' + m) }}</v-btn>
						</v-btn-toggle>
					</div>
					<div class="text-body-small machine-faint mb-2">{{ t('height.note_' + view.data.method) }}</div>
					<template v-if="view.data.method === 'bltouch'">
						<div class="d-flex align-center flex-wrap mb-2" style="gap:8px">
							<span class="text-body-medium">{{ t('height.trigger', { mode }) }}</span>
							<b>{{ triggerText }}</b>
							<v-chip size="x-small" label :color="view.data.k0 ? 'success' : 'info'" variant="outlined">{{ view.data.k0 ? t('height.calibrated', { date: view.data.k0.date }) : t('height.from_mode_file') }}</v-chip>
							<v-btn size="small" variant="outlined" :disabled="!canWrite || busy || !!block('k0') || !!wiz" :title="blockText('k0')" @click="start('k0')">{{ t('height.calibrate_bltouch') }}</v-btn>
						</div>
						<div v-if="blockText('k0')" class="height-block mb-2"><v-icon size="x-small" color="warning" class="mr-1">mdi-information-outline</v-icon>{{ blockText('k0') }}</div>
						<div class="d-flex align-center flex-wrap mb-2" style="gap:8px">
							<span class="text-body-medium">{{ t('height.adjust') }}</span>
							<v-text-field v-model="adjust" type="number" step="0.01" density="compact" variant="outlined" hide-details class="height-field" :disabled="!canWrite" :error="!!adjustError" />
							<span class="machine-faint">mm</span>
							<v-btn v-for="n in nudges" :key="n" size="small" variant="outlined" :disabled="!canWrite" style="min-width:56px;min-height:44px" @click="adjust = nudge(adjust, n)">{{ (n > 0 ? '+' : '') + n }}</v-btn>
							<v-btn size="small" color="primary" :disabled="!canWrite || busy" @click="saveAdjust()">{{ t('height.save') }}</v-btn>
						</div>
						<div class="text-body-small machine-faint">{{ adjustError ? t(adjustError) : t('height.adjust_tip') }}</div>
					</template>
					<template v-else-if="view.data.method === 'paper'">
						<v-btn size="small" color="primary" :disabled="!canWrite || busy || !!block('paper') || !!wiz" @click="start('paper')">{{ t('height.measure_paper') }}</v-btn>
						<div v-if="blockText('paper')" class="height-block mt-1"><v-icon size="x-small" color="warning" class="mr-1">mdi-information-outline</v-icon>{{ blockText('paper') }}</div>
					</template>
					<height-szp
						v-else :view="view" :can-write="canWrite" :busy="busy" :block="blockText('szp')" :out="szpOut" :sr="szpSR"
						@run="runSzp" @save="saveSzp"
					/>
					<div v-if="view.data.method !== 'szp'" class="d-flex align-center flex-wrap mt-3" style="gap:8px">
						<span class="text-body-medium">{{ t('height.paper_thickness') }}</span>
						<v-text-field v-model="paperText" type="number" step="0.01" density="compact" variant="outlined" hide-details class="height-field" :disabled="!canWrite" :error="!!paperError" @change="savePaper()" />
						<span class="text-body-small machine-faint">{{ paperError ? t(paperError) : t('height.paper_tip') }}</span>
					</div>
				</v-card-text>
			</v-card>
			<v-card v-if="wiz" variant="outlined" class="mb-3">
				<v-card-text>
					<height-wizard
						:key="wiz" :api="api" :kind="wiz" :view="view" :reach="h.reach" :z="h.z" :point="point" :paper="h.data.paper"
						@moved="refreshQuiet()" @save-k0="saveK0" @marked="notice = t('height.paper_marked')" @close="wiz = ''"
					/>
				</v-card-text>
			</v-card>
		</template>
		<div v-if="notice" class="text-body-medium text-success">{{ notice }}</div>
		<div v-if="opError" class="text-body-medium text-error">{{ opError }}</div>
	</div>
</template>

<script setup>
// Height calibration of the tool (it was a card of the Workbench, Zones > Active zone): how the height is measured in each mode, the trigger
// height of the BLTouch (calibrated with the paper), the fine adjustment, the thickness of the paper and the SZP of FFF. The service keeps the data
// (machine.height.*: the saved file with revision, zcal.g, the hooks of the mode files and the movements of the assistants); this draws it.

import { computed, ref, watch } from 'vue'
import ErrorNotice from '../ErrorNotice.vue' // vue/_shared
import HeightWizard from './HeightWizard.vue'
import HeightSzp from './HeightSzp.vue'
import { t } from '../text.js'
import { HEIGHT_MODES } from '../api/machine-api-p8.js'
import { modeView, blockReason, defaultPoint, parseAdjust, parsePaper, nudged, changeOf, hookMissing, szpRecord, parseSzpOutput, NUDGE, todayText } from '../lib/height.js'

const props = defineProps({
	api: { type: Object, required: true }, // createMachineApi(...)
	canWrite: { type: Boolean, default: false }, // technician
	asked: { type: Object, default: null } // {x, y} the Workbench asked for in the route query (the Z point of its active zone), or null
})

const MODES = HEIGHT_MODES
const nudges = [-NUDGE, NUDGE]
const nudge = nudged
const h = ref(null)
const loadError = ref(null)
const mode = ref('Laser')
const busy = ref(false)
const notice = ref('')
const opError = ref('')
const wiz = ref('')
const point = ref({ x: 0, y: 0 })
const adjust = ref('0')
const paperText = ref('0.1')
const szpOut = ref('')
const szpSR = ref(null)

const view = computed(() => modeView(h.value, mode.value))
const missing = computed(() => hookMissing(h.value))
const adjustError = computed(() => {
	const r = parseAdjust(adjust.value)
	return r.ok ? '' : r.errorKey
})
const paperError = computed(() => {
	const r = parsePaper(paperText.value)
	return r.ok ? '' : r.errorKey
})
const triggerText = computed(() => {
	const p = view.value.probe
	return p && p.triggerHeight !== null ? p.triggerHeight + ' mm' : '--'
})

watch(mode, () => {
	wiz.value = ''
	syncDrafts()
})

async function load(first) {
	try {
		h.value = await props.api.height.get()
		loadError.value = null
		if (first) {
			mode.value = h.value.mode || 'Laser'
			point.value = defaultPoint(h.value, props.asked)
		}
		syncDrafts()
	} catch (e) {
		loadError.value = e
	}
}
// the reading of Z while the person jogs: only the numbers of the machine, never the drafts
async function refreshQuiet() {
	try {
		const keep = h.value
		const fresh = await props.api.height.get()
		h.value = Object.assign({}, keep, { z: fresh.z, probes: fresh.probes, homed: fresh.homed })
	} catch (e) {
		/* the next step says what failed */
	}
}
function syncDrafts() {
	adjust.value = String(view.value.data.setting)
	paperText.value = String(h.value ? h.value.data.paper : 0.1)
}
function block(kind) {
	return blockReason(h.value, view.value, kind)
}
function blockText(kind) {
	const r = block(kind)
	return r ? t('height.block_' + r, { mode: mode.value }) : ''
}
function start(kind) {
	notice.value = ''
	opError.value = ''
	wiz.value = kind
}
// every change goes through the revision it was based on; a conflict reloads and says so
async function save(changes, okText) {
	busy.value = true
	opError.value = ''
	try {
		const r = await props.api.height.save(h.value.rev, changes)
		h.value = Object.assign({}, h.value, { rev: r.rev, data: r.data, hooks: r.hooks, applied: r.applied })
		notice.value = okText + (r.applied ? '' : ' ' + t('height.not_applied_now'))
		syncDrafts()
		return true
	} catch (e) {
		if (e && e.code === 'conflict') {
			opError.value = t('height.conflict')
			await load()
		} else {
			opError.value = String((e && e.message) || e)
		}
		return false
	} finally {
		busy.value = false
	}
}
function setMethod(m) {
	if (m && m !== view.value.data.method) save(changeOf(mode.value, { method: m }), t('height.saved_method', { mode: mode.value, method: t('height.method_' + m) }))
}
function saveAdjust() {
	const r = parseAdjust(adjust.value)
	if (r.ok) save(changeOf(mode.value, { setting: r.value }), t('height.saved_adjust', { mode: mode.value, a: r.value }))
}
function savePaper() {
	const r = parsePaper(paperText.value)
	if (r.ok) save({ paper: r.value }, t('height.saved_paper', { paper: r.value }))
}
async function saveK0(record) {
	if (await save(changeOf(mode.value, { k0: record }), t('height.saved_k0', { mode: mode.value, med: record.z }))) wiz.value = ''
}
async function runSzp(a) {
	szpOut.value = ''
	opError.value = ''
	busy.value = true
	try {
		const r = await props.api.height.step('szp', { x: point.value.x, y: point.value.y, a })
		szpOut.value = r.output
		if (a === 1) szpSR.value = parseSzpOutput(r.output)
	} catch (e) {
		opError.value = String((e && e.message) || e)
	} finally {
		busy.value = false
	}
}
function saveSzp({ s, r }) {
	const rec = szpRecord(s, r, todayText())
	if (!rec) {
		opError.value = t('height.err_szp')
		return
	}
	save(changeOf('FFF', { szp: rec }), t('height.saved_szp', { s: rec.s, r: rec.r }))
}
async function installHook() {
	busy.value = true
	try {
		const r = await props.api.height.hook()
		notice.value = t('height.hook_done', { files: r.added.join(', ') || '-' })
		h.value = Object.assign({}, h.value, { hooks: r.hooks, applied: true })
	} catch (e) {
		opError.value = String((e && e.message) || e)
	} finally {
		busy.value = false
	}
}

load(true)
</script>

<style>
.height-module .height-field { max-width: 110px; }
/* why an assistant cannot start now: next to the button, readable (the disabled button alone does not say it) */
.height-module .height-block { font-size: 12px; line-height: 1.4; color: #ffb74d; }
.v-theme--light .height-module .height-block { color: #b26a00; }
</style>
