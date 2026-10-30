<template>
	<div class="modes-module">
		<!-- Machine modes: where a person switches on the modes this machine uses (FFF / Laser / CNC) and sets each one up.
		     One card per mode: state, the "Use this mode" switch and, when it is on and something is missing, the guide.
		     The answer is the machine profile (vue/_shared/machine-modes.js); the other plugins only show the steps of the modes that are on. -->
		<div class="d-flex align-center flex-wrap mb-2" style="gap: 8px">
			<div class="text-title-large flex-grow-1">{{ t('modes.title') }}</div>
		</div>
		<div class="text-body-medium text-medium-emphasis mb-3">{{ t('modes.intro') }}</div>

		<v-alert v-if="loaded && !state.answered" density="compact" variant="outlined" type="info" class="mb-3">
			<div class="font-weight-medium">{{ t('modes.none_title') }}</div>
			<div class="text-body-medium">{{ t('modes.none_text') }}</div>
			<v-btn size="small" color="primary" class="mt-2" :disabled="!canWrite || saving" @click="confirmSuggestion">{{ t('modes.use_suggested') }}</v-btn>
		</v-alert>

		<v-row>
			<v-col v-for="c in cards" :key="c.id" cols="12" md="4">
				<v-card variant="outlined" class="pa-3 h-100 mode-card" :class="'mode-card-' + c.state">
					<div class="d-flex align-center mb-1" style="gap: 8px">
						<v-icon :icon="ICONS[c.id]" />
						<span class="text-title-medium font-weight-medium flex-grow-1">{{ t('modes.' + c.id) }}</span>
						<v-chip size="small" variant="outlined" :color="CHIP[c.state]">{{ stateText(c) }}</v-chip>
					</div>
					<div class="text-body-small text-medium-emphasis mb-2">{{ t('modes.' + c.id + '_about') }}</div>
					<v-switch
						:model-value="effective[c.id]" :label="t('modes.use')" density="compact" hide-details color="primary"
						:disabled="!canWrite || saving" @update:model-value="toggle(c.id, $event)"
					/>
					<v-chip v-if="!state.answered && detected[c.id]" size="x-small" variant="outlined" class="mt-1">{{ t('modes.suggested') }}</v-chip>
					<div v-if="c.state === 'off'" class="text-body-small text-medium-emphasis mt-2">{{ t('modes.off_hint') }}</div>
					<div v-else-if="c.state === 'alone'" class="text-body-small text-medium-emphasis mt-2">{{ t('modes.alone_hint') }}</div>
					<v-btn v-else-if="c.state === 'pending'" size="small" color="primary" class="mt-2" @click="guide">
						<v-icon size="small" start>mdi-map-marker-path</v-icon>{{ t('modes.configure') }}
					</v-btn>
				</v-card>
			</v-col>
		</v-row>

		<div v-if="loaded && allReady" class="text-body-medium mt-3">{{ t('modes.all_ready') }}</div>
		<div class="text-body-small text-medium-emphasis mt-3">{{ t('modes.files_note') }}</div>
		<div v-if="info" class="text-body-small text-medium-emphasis">{{ info.viaService ? t('modes.via_service') : t('modes.via_local') }}</div>
		<v-alert v-if="!canWrite" density="compact" variant="outlined" type="info" class="mt-3">{{ t('modes.needs_technician') }}</v-alert>
	</div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { loadModes, saveModes, readModeFacts } from '../machine-modes-store.js' // vue/_shared
import { MODES, detectModes, modesState, enabledList, usesSeveralModes, modeRows, guideDefs, effectiveModes, modeCardState, MODES_CHANGED, MODES_GUIDE } from '../machine-modes.js'
import { t } from '../text.js'

defineProps({
	canWrite: { type: Boolean, default: false }
})

const ICONS = { fff: 'mdi-printer-3d-nozzle', laser: 'mdi-laser-pointer', cnc: 'mdi-saw-blade' }
const CHIP = { off: undefined, alone: 'primary', pending: 'warning', ready: 'success' }

const info = ref(null)
const loaded = ref(false)
const saving = ref(false)
const texts = ref({})
const bootCalls = ref(null)

const state = computed(() => (info.value ? info.value.state : modesState(null, null)))
const detected = computed(() => (info.value ? info.value.detected : detectModes(null)))
// before the first answer the switches show what the board suggests (nothing is saved until the person touches one)
const effective = computed(() => effectiveModes(state.value, detected.value))
// the rows of the guide (the chip of the header opens it): only with two or more modes on, and only the ones whose file could be read
const defs = computed(() => guideDefs(state.value, bootCalls.value, texts.value))
const cards = computed(() => MODES.map(m => {
	const mine = defs.value.filter(d => d.mode === m && (d.state === 'missing' || d.state === 'example'))
	return { id: m, state: modeCardState(state.value, m, defs.value), pending: mine.length }
}))
const allReady = computed(() => state.value.answered && enabledList(state.value).length > 0 && cards.value.every(c => c.state !== 'pending'))

function stateText(c) {
	if (c.state === 'pending') return t('modes.state_pending', { n: c.pending })
	return t('modes.state_' + c.state)
}

async function readFacts() {
	if (!usesSeveralModes(state.value)) {
		texts.value = {}
		bootCalls.value = null
		return
	}
	const f = await readModeFacts(modeRows(enabledList(state.value)))
	texts.value = f.texts
	bootCalls.value = f.bootCalls
}
async function load() {
	try {
		info.value = await loadModes(true)
	} catch (e) {
		/* the question stays as it was */
	}
	await readFacts()
	loaded.value = true
}
async function setAnswer(answer) {
	saving.value = true
	try {
		const r = await saveModes(answer, info.value && info.value.profile)
		info.value = Object.assign({}, info.value, { state: modesState(answer, null), viaService: r.viaService })
		await readFacts()
		window.dispatchEvent(new CustomEvent(MODES_CHANGED, { detail: { from: 'cards' } })) // the chip of the header reads again
	} finally {
		saving.value = false
	}
}
function toggle(mode, on) {
	setAnswer(Object.assign({}, effective.value, { [mode]: !!on }))
}
function confirmSuggestion() {
	setAnswer(Object.assign({}, effective.value))
}
// the guide lives in the chip of the header
function guide() {
	window.dispatchEvent(new CustomEvent(MODES_GUIDE))
}
// the chip changed the answer ("I do not use it" in the guide): read again
function onChanged(ev) {
	if (ev && ev.detail && ev.detail.from === 'header') load()
}

onMounted(() => {
	load()
	window.addEventListener(MODES_CHANGED, onChanged)
})
onBeforeUnmount(() => window.removeEventListener(MODES_CHANGED, onChanged))
</script>

<style scoped>
.mode-card-off,
.mode-card-alone {
	border-left: 4px solid transparent;
}
.mode-card-pending {
	border-left: 4px solid #e65100;
}
.mode-card-ready {
	border-left: 4px solid #1b5e20;
}
</style>
