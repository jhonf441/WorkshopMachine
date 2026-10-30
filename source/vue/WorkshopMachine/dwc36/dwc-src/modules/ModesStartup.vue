<template>
	<!-- The start-up chip of the machine modes, in the header of the Machine page (slot "startup" of PageHeader), like every other page.
	     The cards of the modes are in the "Modes" section (ModesModule): both tell each other through window events when the answer
	     changes or when a card asks for the guide. -->
	<startup-panel v-if="defs.length" ref="panel" plugin="WorkshopMachine" :defs="defs" :service-row="false" :recheck="recheck" @not-using="modeOff" />
</template>

<script>
import StartupPanel from '../StartupPanel.vue' // vue/_shared36
import { loadModes, saveModes, readModeFacts } from '../machine-modes-store.js' // vue/_shared36
import { detectModes, modesState, enabledList, usesSeveralModes, modeRows, guideDefs, effectiveModes, MODES_CHANGED, MODES_GUIDE } from '../machine-modes.js'

export default {
	components: { StartupPanel },
	data() {
		return { info: null, texts: {}, bootCalls: null };
	},
	computed: {
		state() {
			return this.info ? this.info.state : modesState(null, null);
		},
		detected() {
			return this.info ? this.info.detected : detectModes(null);
		},
		defs() {
			return guideDefs(this.state, this.bootCalls, this.texts);
		}
	},
	mounted() {
		this.load();
		window.addEventListener(MODES_CHANGED, this.onChanged);
		window.addEventListener(MODES_GUIDE, this.guide);
	},
	beforeDestroy() {
		window.removeEventListener(MODES_CHANGED, this.onChanged);
		window.removeEventListener(MODES_GUIDE, this.guide);
	},
	methods: {
		async readFacts() {
			if (!usesSeveralModes(this.state)) {
				this.texts = {};
				this.bootCalls = null;
				return;
			}
			const f = await readModeFacts(modeRows(enabledList(this.state)));
			this.texts = f.texts;
			this.bootCalls = f.bootCalls;
		},
		async load() {
			try {
				this.info = await loadModes(true);
			} catch (e) {
				/* the chip stays as it was */
			}
			await this.readFacts();
		},
		recheck() {
			return this.load();
		},
		// "I do not use it" in the guide
		async modeOff(mode) {
			const r = await saveModes(Object.assign({}, effectiveModes(this.state, this.detected), { [mode]: false }), this.info && this.info.profile);
			window.dispatchEvent(new CustomEvent(MODES_CHANGED, { detail: { from: 'header', viaService: r && r.viaService } }));
			await this.load();
		},
		// the cards changed the answer: read again (not when this chip is the one that changed it)
		onChanged(ev) {
			if (!(ev && ev.detail && ev.detail.from === 'header')) this.load();
		},
		guide() {
			if (this.$refs.panel) this.$refs.panel.startWizard(null);
		}
	}
}
</script>
