'use strict'

// The point editing of the mesh bed (a composable of MeshBed.vue, like use-mesh-bed-model.js; `m` is what that one returned, `ctx` = { view,
// selected, notice }). The chosen points are the state `pe` (prop; state/point-edit-state.js: add, move, remove, undo, redo); the regular
// grid they imply is `derived` (lib/point-grid.js, computed by the page). Every change says what happened in `notice` when it is refused.
// Nothing here moves or probes the machine.

import { computed, nextTick } from 'vue'
import { t } from '../text.js'
import * as edit from '../state/point-edit-state.js'
import { meshArea, inside } from '../lib/bed-mesh-plan.js'
import { fieldsOfRegion, snap, snapStepFor } from '../lib/bed-region.js'
import { GRID_LIMITS, seedFromNodes } from '../lib/point-grid.js'
import { pointsForBed } from '../lib/point-sets.js'

const DIRECTION = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }
const TYPING = ['INPUT', 'TEXTAREA', 'SELECT']

// adding, moving and removing the chosen points (and the Region <-> Points switch)
function useMeshBedPointEdit(props, m, ctx) {
	const { view, selected, notice } = ctx
	// the points can be changed now: a person who may run, nothing running, the plan on show, the Points mode
	const canEditPoints = computed(() => props.editable && view.value === 'plan' && m.pointsMode.value)
	const area = computed(() => meshArea(props.model.bed, props.model.reach, null)) // the run is not given a margin: the service default applies
	const step = computed(() => snapStepFor(props.model.bed))
	// what "save as a template" stores: the chosen points, else the nodes the plan would measure
	const savable = computed(() => {
		const pts = props.pe.points.length ? props.pe.points : m.plan.value.points.filter(p => p.status === 'measure')
		return pts.map(p => ({ x: p.x, y: p.y }))
	})
	function say(key, params) {
		notice.value = key ? t(key, params) : ''
	}
	function chosenOfNode(nodeId) {
		const n = m.okDerived.value ? m.okDerived.value.nodes.find(q => q.id === nodeId) : null
		return n && n.chosen.length ? n.chosen[0] : ''
	}
	// Region <-> Points. Leaving Points keeps the grid you see: the region fields take the derived region and counts
	function setMode(mode) {
		const d = m.okDerived.value
		if (mode === 'region' && d) {
			props.inputs.mode = 'region'
			props.inputs.nx = d.nx
			props.inputs.ny = d.ny
			Object.assign(props.inputs.region, fieldsOfRegion(d.region))
		}
		props.pe.mode = mode
		selected.value = ''
		say('')
	}
	function addAt(x, y) {
		if (!area.value || !inside(area.value, x, y)) return say('bed.note_outside_area')
		if (edit.addPoint(props.pe, props.pe.points, x, y, GRID_LIMITS.maxChosen)) return say('')
		say(props.pe.points.length >= GRID_LIMITS.maxChosen ? 'bed.note_limit' : 'bed.note_duplicate', { n: GRID_LIMITS.maxChosen })
	}
	function addTyped(p) {
		addAt(p.x, p.y)
	}
	function chooseSelected() {
		if (m.point.value) addAt(m.point.value.x, m.point.value.y)
	}
	function removeSelected() {
		if (edit.removePoints(props.pe, props.pe.points, m.chosenAtSelected.value)) selected.value = ''
	}
	function removeChosen(id) {
		edit.removePoints(props.pe, props.pe.points, [id])
	}
	// the dragged / nudged chosen point goes to (x, y) snapped to the step and kept inside what the run accepts
	function moveChosen(id, x, y) {
		const a = area.value
		edit.movePoint(props.pe, props.pe.points, id, Math.min(a.xmax, Math.max(a.xmin, snap(x, step.value))), Math.min(a.ymax, Math.max(a.ymin, snap(y, step.value))))
	}
	// after the grid changed under a point, keep the selection on the node it is on now
	function reselect(chosenId) {
		nextTick(() => {
			const d = m.okDerived.value
			selected.value = d && d.nodeOf[chosenId] ? d.nodeOf[chosenId] : ''
		})
	}
	// arrows on a focused node move the chosen point on it, one step (Shift: ten)
	function nudgeNode(ev) {
		const id = chosenOfNode(ev.id)
		const d = DIRECTION[ev.key]
		const p = props.pe.points.find(q => q.id === id)
		if (!p || !d || !canEditPoints.value) return
		const k = step.value * (ev.shift ? 10 : 1)
		const a = area.value
		edit.movePoint(props.pe, props.pe.points, id, Math.min(a.xmax, Math.max(a.xmin, p.x + d[0] * k)), Math.min(a.ymax, Math.max(a.ymin, p.y + d[1] * k)))
		edit.endMove(props.pe)
		reselect(id)
	}
	function useNode(s) {
		const node = m.okDerived.value.nodes.find(n => n.id === s.node)
		if (!node) return
		edit.movePoint(props.pe, props.pe.points, s.id, node.x, node.y)
		edit.endMove(props.pe)
	}
	return { canEditPoints, area, step, savable, say, chosenOfNode, setMode, addAt, addTyped, chooseSelected, removeSelected, removeChosen, moveChosen, nudgeNode, reselect, useNode }
}

// the other ways to change the points: start from the grid, undo / redo, clear, a named set, the keyboard
function useMeshBedPointHistory(props, m, ctx, edits) {
	const { selected } = ctx
	const { canEditPoints, say, removeSelected } = edits
	// start from the grid the plan shows, so points can be taken away
	function seed() {
		const nodes = m.plan.value.points.filter(p => p.status === 'measure')
		if (nodes.length > GRID_LIMITS.maxChosen) return say('bed.note_seed_big', { n: nodes.length, max: GRID_LIMITS.maxChosen })
		edit.setPoints(props.pe, props.pe.points, seedFromNodes(nodes), GRID_LIMITS.maxChosen)
		say('')
	}
	function undo() {
		edit.undo(props.pe)
		selected.value = ''
		say('')
	}
	function redo() {
		edit.redo(props.pe)
		selected.value = ''
		say('')
	}
	function reset() {
		edit.resetPoints(props.pe)
		selected.value = ''
		say('')
	}
	function loadSet(id) {
		const set = props.sets.sets.find(s => s.id === id)
		if (!set) return
		const r = pointsForBed(set, props.model.bed)
		edit.setPoints(props.pe, props.pe.points, r.points, GRID_LIMITS.maxChosen)
		props.pe.mode = 'points'
		selected.value = ''
		say(r.dropped ? 'bed.note_set_dropped' : '', { n: r.dropped })
	}
	// keyboard on the whole bed area: Delete removes the selected chosen point, Ctrl+Z undoes, Ctrl+Y / Ctrl+Shift+Z redoes
	function onKey(ev) {
		if (TYPING.indexOf(ev.target && ev.target.tagName) >= 0 || !canEditPoints.value) return
		const ctrl = ev.ctrlKey || ev.metaKey
		if (ev.key === 'Delete' || ev.key === 'Backspace') removeSelected()
		else if (ctrl && (ev.key === 'z' || ev.key === 'Z')) ev.shiftKey ? redo() : undo()
		else if (ctrl && (ev.key === 'y' || ev.key === 'Y')) redo()
		else return
		ev.preventDefault()
	}
	return { seed, undo, redo, reset, loadSet, onKey }
}

export function useMeshBedPoints(props, m, ctx) {
	const edits = useMeshBedPointEdit(props, m, ctx)
	return Object.assign({}, edits, useMeshBedPointHistory(props, m, ctx, edits))
}
