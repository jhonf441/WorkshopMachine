<template>
	<!-- The start-up chip of the machine modes, in the header of the Machine page (slot "startup" of PageHeader), like every other page.
	     The cards of the modes are in the "Modes" section (ModesModule): both tell each other through window events when the answer
	     changes or when a card asks for the guide. -->
	<startup-panel v-if="defs.length" ref="panel" plugin="WorkshopMachine" :defs="defs" :service-row="false" :recheck="recheck" @not-using="modeOff" />
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import StartupPanel from '../StartupPanel.vue' // vue/_shared
import { loadModes, saveModes, readModeFacts } from '../machine-modes-store.js' // vue/_shared
import { detectModes, modesState, enabledList, usesSeveralModes, modeRows, guideDefs, effectiveModes, MODES_CHANGED, MODES_GUIDE } from '../machine-modes.js'

const panel = ref(null)
const info = ref(null)
const texts = ref({})
const bootCalls = ref(null)

const state = computed(() => (info.value ? info.value.state : modesState(null, null)))
const detected = computed(() => (info.value ? info.value.detected : detectModes(null)))
const defs = computed(() => guideDefs(state.value, bootCalls.value, texts.value))

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
		/* the chip stays as it was */
	}
	await readFacts()
}
function recheck() {
	return load()
}
// "I do not use it" in the guide
async function modeOff(mode) {
	const r = await saveModes(Object.assign({}, effectiveModes(state.value, detected.value), { [mode]: false }), info.value && info.value.profile)
	window.dispatchEvent(new CustomEvent(MODES_CHANGED, { detail: { from: 'header', viaService: r && r.viaService } }))
	await load()
}
// the cards changed the answer: read again (not when this chip is the one that changed it)
function onChanged(ev) {
	if (!(ev && ev.detail && ev.detail.from === 'header')) load()
}
function guide() {
	if (panel.value) panel.value.startWizard(null)
}

onMounted(() => {
	load()
	window.addEventListener(MODES_CHANGED, onChanged)
	window.addEventListener(MODES_GUIDE, guide)
})
onBeforeUnmount(() => {
	window.removeEventListener(MODES_CHANGED, onChanged)
	window.removeEventListener(MODES_GUIDE, guide)
})
</script>
