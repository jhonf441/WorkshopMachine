<template>
	<div class="modes-module">
		<!-- Machine modes: where a person switches on the modes this machine uses (FFF / Laser / CNC) and sets each one up.
		     One card per mode: state, the "Use this mode" switch and, when it is on and something is missing, the guide.
		     The answer is the machine profile (vue/_shared36/machine-modes.js); the other plugins only show the steps of the modes that are on. -->
		<div class="d-flex align-center flex-wrap mb-2" style="gap: 8px">
			<div class="text-h6 flex-grow-1">{{ t('modes.title') }}</div>
		</div>
		<div class="text-body-2 machine-faint mb-3">{{ t('modes.intro') }}</div>

		<v-alert v-if="loaded && !state.answered" dense outlined type="info" class="mb-3">
			<div class="font-weight-medium">{{ t('modes.none_title') }}</div>
			<div class="text-body-2">{{ t('modes.none_text') }}</div>
			<v-btn small color="primary" class="mt-2" :disabled="!canWrite || saving" @click="confirmSuggestion">{{ t('modes.use_suggested') }}</v-btn>
		</v-alert>

		<v-row>
			<v-col v-for="c in cards" :key="c.id" cols="12" md="4">
				<v-card outlined class="pa-3 mode-card" :class="'mode-card-' + c.state" style="height: 100%">
					<div class="d-flex align-center mb-1" style="gap: 8px">
						<v-icon>{{ ICONS[c.id] }}</v-icon>
						<span class="text-subtitle-1 font-weight-medium flex-grow-1">{{ t('modes.' + c.id) }}</span>
						<v-chip small label :color="CHIP[c.state]" :text-color="c.state === 'off' ? undefined : 'white'">{{ stateText(c) }}</v-chip>
					</div>
					<div class="text-caption machine-faint mb-2">{{ t('modes.' + c.id + '_about') }}</div>
					<v-switch
						:input-value="effective[c.id]" :label="t('modes.use')" dense hide-details color="primary"
						:disabled="!canWrite || saving" @change="toggle(c.id, $event)"
					/>
					<v-chip v-if="!state.answered && detected[c.id]" x-small outlined class="mt-1">{{ t('modes.suggested') }}</v-chip>
					<div v-if="c.state === 'off'" class="text-caption machine-faint mt-2">{{ t('modes.off_hint') }}</div>
					<div v-else-if="c.state === 'alone'" class="text-caption machine-faint mt-2">{{ t('modes.alone_hint') }}</div>
					<v-btn v-else-if="c.state === 'pending'" small color="primary" class="mt-2" @click="guide">
						<v-icon small left>mdi-map-marker-path</v-icon>{{ t('modes.configure') }}
					</v-btn>
				</v-card>
			</v-col>
		</v-row>

		<div v-if="loaded && allReady" class="text-body-2 mt-3">{{ t('modes.all_ready') }}</div>
		<div class="text-caption machine-faint mt-3">{{ t('modes.files_note') }}</div>
		<div v-if="info" class="text-caption machine-faint">{{ info.viaService ? t('modes.via_service') : t('modes.via_local') }}</div>
		<v-alert v-if="!canWrite" dense outlined type="info" class="mt-3">{{ t('modes.needs_technician') }}</v-alert>
	</div>
</template>

<script>
'use strict'

import { loadModes, saveModes, readModeFacts } from '../machine-modes-store.js' // vue/_shared36
import { MODES, detectModes, modesState, enabledList, usesSeveralModes, modeRows, guideDefs, effectiveModes, modeCardState, MODES_CHANGED, MODES_GUIDE } from '../machine-modes.js'
import { textMixin } from './text-mixin.js'

const ICONS = { fff: 'mdi-printer-3d-nozzle', laser: 'mdi-laser-pointer', cnc: 'mdi-saw-blade' }
const CHIP = { off: undefined, alone: 'primary', pending: 'warning', ready: 'success' }

export default {
	mixins: [textMixin],
	props: {
		canWrite: { type: Boolean, default: false }
	},
	data() {
		return { ICONS, CHIP, info: null, loaded: false, saving: false, texts: {}, bootCalls: null };
	},
	computed: {
		state() {
			return this.info ? this.info.state : modesState(null, null);
		},
		detected() {
			return this.info ? this.info.detected : detectModes(null);
		},
		// before the first answer the switches show what the board suggests (nothing is saved until the person touches one)
		effective() {
			return effectiveModes(this.state, this.detected);
		},
		// the rows of the guide (the chip of the header opens it): only with two or more modes on, and only the ones whose file could be read
		defs() {
			return guideDefs(this.state, this.bootCalls, this.texts);
		},
		cards() {
			return MODES.map(m => {
				const mine = this.defs.filter(d => d.mode === m && (d.state === 'missing' || d.state === 'example'));
				return { id: m, state: modeCardState(this.state, m, this.defs), pending: mine.length };
			});
		},
		allReady() {
			return this.state.answered && enabledList(this.state).length > 0 && this.cards.every(c => c.state !== 'pending');
		}
	},
	mounted() {
		this.load();
		window.addEventListener(MODES_CHANGED, this.onChanged);
	},
	beforeDestroy() {
		window.removeEventListener(MODES_CHANGED, this.onChanged);
	},
	methods: {
		stateText(c) {
			if (c.state === 'pending') return this.t('modes.state_pending', { n: c.pending });
			return this.t('modes.state_' + c.state);
		},
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
				/* the question stays as it was */
			}
			await this.readFacts();
			this.loaded = true;
		},
		async setAnswer(answer) {
			this.saving = true;
			try {
				const r = await saveModes(answer, this.info && this.info.profile);
				this.info = Object.assign({}, this.info, { state: modesState(answer, null), viaService: r.viaService });
				await this.readFacts();
				window.dispatchEvent(new CustomEvent(MODES_CHANGED, { detail: { from: 'cards' } })); // the chip of the header reads again
			} finally {
				this.saving = false;
			}
		},
		toggle(mode, on) {
			this.setAnswer(Object.assign({}, this.effective, { [mode]: !!on }));
		},
		confirmSuggestion() {
			this.setAnswer(Object.assign({}, this.effective));
		},
		// the guide lives in the chip of the header
		guide() {
			window.dispatchEvent(new CustomEvent(MODES_GUIDE));
		},
		// the chip changed the answer ("I do not use it" in the guide): read again
		onChanged(ev) {
			if (ev && ev.detail && ev.detail.from === 'header') this.load();
		}
	}
}
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
