<template>
	<div class="plan-tabs mb-3">
		<div class="plan-tabs-row" role="tablist" :aria-label="t('bed.tabs_label')" @keydown.left.prevent="move(-1)" @keydown.right.prevent="move(1)">
			<button
				v-for="tab in tabs" :id="'plan-tab-' + tab.id" :key="tab.id" type="button" role="tab" class="plan-tab" :class="{ 'plan-tab-on': view === tab.id, 'plan-tab-off': tab.disabled }"
				:aria-selected="view === tab.id ? 'true' : 'false'" :aria-disabled="tab.disabled ? 'true' : 'false'" :tabindex="view === tab.id ? 0 : -1" :title="tab.sub" @click="pick(tab)"
			>
				<v-icon class="plan-tab-icon">{{ tab.icon }}</v-icon>
				<span class="plan-tab-text">
					<span class="plan-tab-title">{{ tab.title }}<v-icon v-if="view === tab.id" size="small" class="ml-1">mdi-check</v-icon></span>
					<span class="plan-tab-sub">{{ tab.sub }}</span>
				</span>
			</button>
		</div>
		<v-alert v-if="!seen" density="compact" text type="info" class="mt-2 mb-0 text-body-medium" role="note">
			<div class="d-flex align-center flex-wrap" style="gap:8px">
				<span class="flex-grow-1">{{ t('bed.tabs_hint') }}</span>
				<v-btn size="small" variant="text" style="min-height:44px" @click="dismiss()">{{ t('bed.tabs_hint_ok') }}</v-btn>
			</div>
		</v-alert>
	</div>
</template>

<script setup>
// The two views of the bed as two wide tabs above it, each with an icon, a title and one line of what it means: PLAN "what I am going to
// measure", RESULT "what the last run measured". The Result tab is disabled WITH the reason written in it when there is no mesh. A short
// first-time hint explains the two; once dismissed it stays dismissed in this browser (localStorage, wrapped: it may be unavailable).

import { computed, nextTick, ref } from 'vue'
import { t } from '../text.js'

const HINT_KEY = 'workshopMachineBedTabsHint'

function seenBefore() {
	try { return window.localStorage.getItem(HINT_KEY) === '1' } catch (e) { return false }
}

const props = defineProps({
	view: { type: String, default: 'plan' }, // 'plan' | 'result'
	hasResult: { type: Boolean, default: false }
})
const emit = defineEmits(['view'])

const seen = ref(seenBefore())
const tabs = computed(() => [
	{ id: 'plan', icon: 'mdi-vector-square', title: t('bed.tab_plan'), sub: t('bed.tab_plan_sub'), disabled: false },
	{ id: 'result', icon: 'mdi-grid', title: t('bed.tab_result'), sub: t(props.hasResult ? 'bed.tab_result_sub' : 'bed.tab_result_none'), disabled: !props.hasResult }
])

function pick(tab) {
	if (!tab.disabled) emit('view', tab.id)
}
function move(step) {
	const next = tabs.value[(tabs.value.findIndex(q => q.id === props.view) + step + tabs.value.length) % tabs.value.length]
	if (next.disabled) return
	emit('view', next.id)
	nextTick(() => { const el = document.getElementById('plan-tab-' + next.id); if (el) el.focus() })
}
function dismiss() {
	seen.value = true
	try { window.localStorage.setItem(HINT_KEY, '1') } catch (e) { /* no storage: the hint comes back next time */ }
}
</script>

<style>
.plan-tabs-row { display: flex; gap: 8px; }
.plan-tab { flex: 1 1 0; display: flex; align-items: center; gap: 10px; min-height: 64px; padding: 8px 14px; text-align: left; cursor: pointer; color: inherit; border: 2px solid rgba(128, 128, 128, 0.45); border-radius: 8px; background: transparent; font: inherit; }
.plan-tab:focus-visible { outline: 3px solid #1976d2; outline-offset: 2px; }
.plan-tab-on { border-color: #1976d2; background: rgba(25, 118, 210, 0.14); }
.plan-tab-off { cursor: not-allowed; border-style: dashed; opacity: 0.75; }
.plan-tab-text { display: flex; flex-direction: column; min-width: 0; }
.plan-tab-title { font-size: 16px; font-weight: 700; }
.plan-tab-sub { font-size: 13px; opacity: 0.85; }
.plan-tab-icon { flex: none; }
@media (max-width: 599px) { .plan-tabs-row { flex-direction: column; } .plan-tab { min-height: 56px; } }
</style>
