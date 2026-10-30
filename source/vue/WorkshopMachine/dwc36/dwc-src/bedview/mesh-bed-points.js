'use strict'

// The point editing of the mesh bed (a mixin of MeshBed.vue, like mesh-bed-model.js; it reads the props and the data of the component by
// name: model, inputs, editable, view, pe, derived, plan, sets, selected, notice). The chosen points are the state `pe`
// (state/point-edit-state.js: add, move, remove, undo, redo); the regular grid they imply is `derived` (lib/point-grid.js, computed by the
// page). Every change says what happened in `notice` when it is refused. Nothing here moves or probes the machine.

import * as edit from '../state/point-edit-state.js'
import { meshArea, inside } from '../lib/bed-mesh-plan.js'
import { fieldsOfRegion, snap, snapStepFor } from '../lib/bed-region.js'
import { GRID_LIMITS, seedFromNodes } from '../lib/point-grid.js'
import { pointsForBed } from '../lib/point-sets.js'

const DIRECTION = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }
const TYPING = ['INPUT', 'TEXTAREA', 'SELECT']

export const meshBedPoints = {
	computed: {
		// the points can be changed now: a person who may run, nothing running, the plan on show, the Points mode
		canEditPoints() {
			return this.editable && this.view === 'plan' && this.pointsMode
		},
		area() {
			return meshArea(this.model.bed, this.model.reach, null) // the run is not given a margin: the service default applies
		},
		step() {
			return snapStepFor(this.model.bed)
		},
		// what "save as a template" stores: the chosen points, else the nodes the plan would measure
		savable() {
			const pts = this.pe.points.length ? this.pe.points : this.plan.points.filter(p => p.status === 'measure')
			return pts.map(p => ({ x: p.x, y: p.y }))
		}
	},
	methods: {
		say(key, params) {
			this.notice = key ? this.t(key, params) : ''
		},
		chosenOfNode(nodeId) {
			const n = this.okDerived ? this.okDerived.nodes.find(q => q.id === nodeId) : null
			return n && n.chosen.length ? n.chosen[0] : ''
		},
		// Region <-> Points. Leaving Points keeps the grid you see: the region fields take the derived region and counts
		setMode(mode) {
			if (mode === 'region' && this.okDerived) {
				this.inputs.mode = 'region'
				this.inputs.nx = this.okDerived.nx
				this.inputs.ny = this.okDerived.ny
				Object.assign(this.inputs.region, fieldsOfRegion(this.okDerived.region))
			}
			this.pe.mode = mode
			this.selected = ''
			this.say('')
		},
		addAt(x, y) {
			if (!this.area || !inside(this.area, x, y)) return this.say('bed.note_outside_area')
			if (edit.addPoint(this.pe, this.pe.points, x, y, GRID_LIMITS.maxChosen)) return this.say('')
			this.say(this.pe.points.length >= GRID_LIMITS.maxChosen ? 'bed.note_limit' : 'bed.note_duplicate', { n: GRID_LIMITS.maxChosen })
		},
		addTyped(p) {
			this.addAt(p.x, p.y)
		},
		chooseSelected() {
			if (this.point) this.addAt(this.point.x, this.point.y)
		},
		removeSelected() {
			if (edit.removePoints(this.pe, this.pe.points, this.chosenAtSelected)) this.selected = ''
		},
		removeChosen(id) {
			edit.removePoints(this.pe, this.pe.points, [id])
		},
		// the dragged / nudged chosen point goes to (x, y) snapped to the step and kept inside what the run accepts
		moveChosen(id, x, y) {
			const a = this.area
			edit.movePoint(this.pe, this.pe.points, id, Math.min(a.xmax, Math.max(a.xmin, snap(x, this.step))), Math.min(a.ymax, Math.max(a.ymin, snap(y, this.step))))
		},
		// arrows on a focused node move the chosen point on it, one step (Shift: ten)
		nudgeNode(ev) {
			const id = this.chosenOfNode(ev.id)
			const d = DIRECTION[ev.key]
			const p = this.pe.points.find(q => q.id === id)
			if (!p || !d || !this.canEditPoints) return
			const k = this.step * (ev.shift ? 10 : 1)
			const a = this.area
			edit.movePoint(this.pe, this.pe.points, id, Math.min(a.xmax, Math.max(a.xmin, p.x + d[0] * k)), Math.min(a.ymax, Math.max(a.ymin, p.y + d[1] * k)))
			edit.endMove(this.pe)
			this.reselect(id)
		},
		// after the grid changed under a point, keep the selection on the node it is on now
		reselect(chosenId) {
			this.$nextTick(() => { this.selected = this.okDerived && this.okDerived.nodeOf[chosenId] ? this.okDerived.nodeOf[chosenId] : '' })
		},
		useNode(s) {
			const node = this.okDerived.nodes.find(n => n.id === s.node)
			if (!node) return
			edit.movePoint(this.pe, this.pe.points, s.id, node.x, node.y)
			edit.endMove(this.pe)
		},
		// start from the grid the plan shows, so points can be taken away
		seed() {
			const nodes = this.plan.points.filter(p => p.status === 'measure')
			if (nodes.length > GRID_LIMITS.maxChosen) return this.say('bed.note_seed_big', { n: nodes.length, max: GRID_LIMITS.maxChosen })
			edit.setPoints(this.pe, this.pe.points, seedFromNodes(nodes), GRID_LIMITS.maxChosen)
			this.say('')
		},
		undo() {
			edit.undo(this.pe)
			this.selected = ''
			this.say('')
		},
		redo() {
			edit.redo(this.pe)
			this.selected = ''
			this.say('')
		},
		reset() {
			edit.resetPoints(this.pe)
			this.selected = ''
			this.say('')
		},
		loadSet(id) {
			const set = this.sets.sets.find(s => s.id === id)
			if (!set) return
			const r = pointsForBed(set, this.model.bed)
			edit.setPoints(this.pe, this.pe.points, r.points, GRID_LIMITS.maxChosen)
			this.pe.mode = 'points'
			this.selected = ''
			this.say(r.dropped ? 'bed.note_set_dropped' : '', { n: r.dropped })
		},
		// keyboard on the whole bed area: Delete removes the selected chosen point, Ctrl+Z undoes, Ctrl+Y / Ctrl+Shift+Z redoes
		onKey(ev) {
			if (TYPING.indexOf(ev.target && ev.target.tagName) >= 0 || !this.canEditPoints) return
			const ctrl = ev.ctrlKey || ev.metaKey
			if (ev.key === 'Delete' || ev.key === 'Backspace') this.removeSelected()
			else if (ctrl && (ev.key === 'z' || ev.key === 'Z')) ev.shiftKey ? this.redo() : this.undo()
			else if (ctrl && (ev.key === 'y' || ev.key === 'Y')) this.redo()
			else return
			ev.preventDefault()
		}
	}
}
