<template>
	<div class="height-wizard">
		<div class="text-title-small mb-2">{{ t(kind === 'k0' ? 'height.wizard_k0_title' : 'height.wizard_paper_title', { mode: view.mode }) }}</div>
		<div v-for="(s, i) in steps" :key="s" class="height-step" :class="{ cur: i === step, done: i < step }">
			<div class="d-flex align-center flex-wrap" style="gap:8px">
				<span class="height-n">{{ i < step ? '✓' : i + 1 }}</span>
				<span class="text-body-medium">{{ stepText(s) }}</span>
			</div>
			<div v-if="i === step" class="height-actions">
				<template v-if="s === 'goto'">
					<div class="d-flex align-center flex-wrap" style="gap:8px">
						<v-text-field v-model="px" type="number" density="compact" variant="outlined" hide-details class="height-field" label="X" />
						<v-text-field v-model="py" type="number" density="compact" variant="outlined" hide-details class="height-field" label="Y" />
						<v-btn color="primary" size="small" :disabled="busy" @click="go()">{{ t('height.go') }}</v-btn>
					</div>
					<div v-if="pointNote" class="text-body-small machine-faint mt-1">{{ pointNote }}</div>
				</template>
				<template v-else-if="s === 'lower'">
					<div class="d-flex flex-wrap" style="gap:6px">
						<v-btn v-for="d in steps_dz" :key="d" size="small" variant="outlined" :disabled="busy" style="min-width:56px;min-height:44px" @click="jog(d)">{{ (d > 0 ? '+' : '') + d }}</v-btn>
					</div>
					<v-btn color="primary" size="small" class="mt-2" :disabled="busy" @click="mark()">{{ t(kind === 'k0' ? 'height.mark_k0' : 'height.mark_paper', { paper: paper }) }}</v-btn>
				</template>
				<template v-else-if="s === 'measure'">
					<v-btn color="primary" size="small" :disabled="busy" @click="measure()">{{ t('height.measure') }}</v-btn>
				</template>
				<template v-else>
					<div class="text-body-medium mb-1">{{ t('height.measured_text', { med: measured, prev: prevText, mode: view.mode }) }}</div>
					<v-alert v-if="shift.suspicious" density="compact" variant="outlined" type="warning" class="mb-2">{{ t('height.shift_warning', { d: shift.diff }) }}</v-alert>
					<v-btn color="primary" size="small" :disabled="busy" @click="$emit('save-k0', record)">{{ t('height.save_k0') }}</v-btn>
				</template>
			</div>
		</div>
		<div v-if="error" class="text-body-medium text-error mt-2">{{ error }}</div>
		<v-btn size="small" variant="text" class="mt-2" @click="$emit('close')">{{ t(step >= steps.length ? 'height.close' : 'height.cancel') }}</v-btn>
	</div>
</template>

<script setup>
// The assistants of the height calibration: BLTouch (bring the tool over the point, lower it to the paper, mark Z0, measure with the probe, save the
// trigger height) and paper (the same without the probe). Every movement is one step of the service (machine.height.step: reserved, refused during a
// job); the numbers and the decisions are in lib/height.js.

import { computed, ref } from 'vue'
import { t } from '../text.js'
import { WIZARD_STEPS, JOG_STEPS, MARK_HEIGHT, clampPoint, k0Record, triggerShift, todayText } from '../lib/height.js'

const props = defineProps({
	api: { type: Object, required: true },
	kind: { type: String, required: true }, // 'k0' | 'paper'
	view: { type: Object, required: true }, // lib/height.js modeView
	reach: { type: Object, default: null },
	z: { type: Number, default: null }, // Z of the tool now (the page reloads it after each jog)
	point: { type: Object, required: true }, // {x, y}
	paper: { type: Number, default: 0.1 }
})
const emit = defineEmits(['moved', 'marked', 'close', 'save-k0'])

const step = ref(0)
const busy = ref(false)
const error = ref('')
const measured = ref(null)
const px = ref(String(props.point.x))
const py = ref(String(props.point.y))
const pointNote = ref('')
const steps_dz = JOG_STEPS

const steps = computed(() => WIZARD_STEPS[props.kind])
const shift = computed(() => (measured.value === null ? { diff: null, suspicious: false } : triggerShift(measured.value, props.view.probe)))
const prevText = computed(() => (props.view.probe && props.view.probe.triggerHeight !== null ? String(props.view.probe.triggerHeight) : '--'))
const record = computed(() => (measured.value === null ? null : k0Record(measured.value, props.view.probe, todayText())))

function stepText(s) {
	return t('height.step_' + s, { z: props.z === null ? '--' : props.z, x: px.value, y: py.value })
}
// one step of the service; the answer is the next thing to do
async function run(action, args) {
	busy.value = true
	error.value = ''
	try {
		const r = await props.api.height.step(action, args)
		emit('moved')
		return r
	} catch (e) {
		error.value = String((e && e.message) || e)
		return null
	} finally {
		busy.value = false
	}
}
async function go() {
	const p = clampPoint({ x: px.value, y: py.value }, props.reach)
	px.value = String(p.x)
	py.value = String(p.y)
	pointNote.value = p.clamped ? t('height.point_clamped') : ''
	if (await run('goto', { x: p.x, y: p.y })) step.value = 1
}
async function jog(d) {
	await run('jog', { dz: d })
}
async function mark() {
	if (!(await run('mark', { paper: props.paper, h: MARK_HEIGHT }))) return
	if (props.kind === 'paper') {
		step.value = steps.value.length
		emit('marked')
	} else {
		step.value = 2
	}
}
async function measure() {
	const r = await run('measure', { x: Number(px.value), y: Number(py.value) })
	if (r && r.measured !== null) {
		measured.value = r.measured
		step.value = 3
	}
}
</script>

<style>
.height-step { padding: 6px 0 6px 4px; opacity: 0.6; }
.height-step.cur { opacity: 1; }
.height-actions { margin: 6px 0 4px 30px; }
.height-n { display: inline-flex; width: 22px; height: 22px; border-radius: 50%; align-items: center; justify-content: center; background: rgba(144, 202, 249, 0.25); font-size: 12px; }
.height-field { max-width: 120px; }
</style>
