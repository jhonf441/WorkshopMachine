<template>
	<div class="tool-step-tests">
		<div class="text-h6 mb-1">{{ t('toolwiz.tests_title') }}</div>
		<p class="text-body-2 machine-faint">{{ t('toolwiz.tests_intro') }}</p>
		<v-alert dense outlined type="success" class="text-body-2">{{ t('toolwiz.tests_applied', { snapshot: w.applied ? w.applied.snapshot || '-' : '-' }) }}</v-alert>
		<v-alert v-if="w.applied && w.applied.restartNeeded" dense outlined type="warning" class="text-body-2">{{ t('toolwiz.tests_restart') }}</v-alert>
		<v-alert dense outlined type="info" class="text-body-2">{{ t('toolwiz.tests_never') }}</v-alert>
		<v-progress-linear :value="percent" :color="progress.finished ? 'success' : 'primary'" height="10" rounded class="mb-1" />
		<div class="text-caption mb-3">{{ t('toolwiz.tests_progress', { done: progress.done, total: progress.total }) }}</div>

		<div class="toolwiz-cards toolwiz-cards--wide">
			<tool-choice-card v-for="x in rows" :key="x.test.id" :accent="border(x.state)">
				<div class="d-flex align-center" style="gap: 8px">
					<v-icon :color="colors[x.state]">{{ icons[x.state] }}</v-icon>
					<div class="flex-grow-1">
						<div class="text-subtitle-2">{{ t('toolwiz.test_' + x.test.kind, { n: x.test.index + 1 }) }}</div>
						<div class="text-body-2">{{ t('toolwiz.test_' + x.test.kind + '_how', { n: x.test.index + 1, tool: toolNumber }) }}</div>
						<div v-if="x.test.heat" class="text-caption warning--text"><v-icon x-small color="warning" class="mr-1">mdi-fire</v-icon>{{ t('toolwiz.test_heat_note') }}</div>
						<div v-if="x.state === 'blocked'" class="text-caption machine-faint">{{ t('toolwiz.test_blocked') }}</div>
					</div>
					<v-chip small label :color="colors[x.state]" :text-color="x.state === 'blocked' ? undefined : 'white'">{{ t('toolwiz.test_state_' + x.state) }}</v-chip>
					<v-btn v-if="x.state === 'ready'" small color="primary" @click="mark(x.test.id, true)">{{ t('toolwiz.test_done_btn') }}</v-btn>
					<v-btn v-else-if="x.state === 'done'" small text @click="mark(x.test.id, false)">{{ t('toolwiz.test_undo') }}</v-btn>
				</div>
			</tool-choice-card>
		</div>

		<v-alert v-if="progress.finished" dense outlined type="success" class="mt-3 text-body-2">{{ t('toolwiz.tests_all_done') }}</v-alert>
		<div class="mt-3"><v-btn small text @click="$emit('again')"><v-icon small left>mdi-plus</v-icon>{{ t('toolwiz.another') }}</v-btn></div>
	</div>
</template>

<script>
'use strict'

import ToolChoiceCard from './ToolChoiceCard.vue'
import { textMixin } from './text-mixin.js'
import { testList, testState, testProgress, markTest, TEST_COLORS, TEST_ICONS } from '../lib/toolwiz-tests.js'

export default {
	mixins: [textMixin],
	components: { ToolChoiceCard },
	props: { w: { type: Object, required: true } },
	data() {
		return { colors: TEST_COLORS, icons: TEST_ICONS }
	},
	computed: {
		tests() {
			return testList(this.w.draft)
		},
		rows() {
			return this.tests.map(test => ({ test, state: testState(test, this.w.tests) }))
		},
		progress() {
			return testProgress(this.w.draft, this.w.tests)
		},
		percent() {
			return this.progress.total ? Math.round((100 * this.progress.done) / this.progress.total) : 0
		},
		toolNumber() {
			return this.w.draft.number
		}
	},
	methods: {
		border(state) {
			return { done: '#43a047', ready: '#1e88e5', blocked: '#9e9e9e' }[state]
		},
		// Vue 2: assigning a key that did not exist needs $set, so the state is replaced whole
		mark(id, value) {
			const next = Object.assign({}, this.w.tests)
			markTest(next, this.tests, id, value)
			this.w.tests = next
		}
	}
}
</script>
