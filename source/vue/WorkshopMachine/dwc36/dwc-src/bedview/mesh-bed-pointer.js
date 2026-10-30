'use strict'

// The pointer on the mesh bed (a mixin of MeshBed.vue): what a tap, a drag or a cancelled gesture does in each mode. Region mode: the
// rectangle (as before). Points mode: tap an empty spot to add a point, tap a node to select it, drag a node that carries a chosen point to
// move that point. The job rectangle of "Check a job area" is dragged in either mode. A gesture the browser cancels (a scroll on a touch
// screen) never adds, selects or moves anything. The drag objects are the data `drag` and `jobDrag` (state/region-drag.js).
// Resizing the area works in both modes through applyRegion(): in Region mode it writes the region fields of the run form, in Points mode
// the chosen points are scaled with the area (a whole drag is ONE undo step, scaled from the points as they were when it started).

import { begin, update, finish, cancel, isTap } from '../state/region-drag.js'
import * as edit from '../state/point-edit-state.js'
import { fieldsOfRegion, nudge, snap, snapStepFor, resizeBy } from '../lib/bed-region.js'
import { presetRegion } from '../lib/bed-mesh-plan.js'
import { scalePoints } from '../lib/mesh-resize.js'
import { jobOfRect, defaultJob } from '../lib/job-fit.js'

export const meshBedPointer = {
	methods: {
		setRegion(r) {
			this.inputs.mode = 'region'
			Object.assign(this.inputs.region, fieldsOfRegion(r))
		},
		onSelect(id) {
			this.selected = this.selected === id ? '' : id
		},
		// the area becomes `r`: the region of the run form (Region mode) or the chosen points scaled to it (Points mode)
		applyRegion(r, key) {
			if (!this.pointsMode) return this.setRegion(r)
			const base = key && this.resizeBase ? this.resizeBase : { region: this.region, points: this.pe.points }
			if (!base.region || !base.points.length) return
			edit.placePoints(this.pe, this.pe.points, scalePoints(base.points, base.region, r, this.area), key)
		},
		onResize(delta) {
			const r = resizeBy(this.region, delta, this.model.bed)
			if (r) this.applyRegion(r)
		},
		onPreset(id) {
			const r = presetRegion(id, this.model)
			if (!r) return
			if (id === 'whole' && !this.pointsMode) this.inputs.mode = 'bed'
			else this.applyRegion(r)
		},
		onNudge(ev) {
			const r = nudge(this.region, ev.handle, ev.key, ev.shift, this.model.bed, snapStepFor(this.model.bed))
			if (r) this.applyRegion(r)
		},
		onTypedRegion(r) {
			this.applyRegion(r)
		},
		// from the result back to the plan with the area of the mesh on show
		editArea() {
			const b = this.grid && this.grid.bounds
			this.view = 'plan'
			if (b && !this.pointsMode) this.setRegion(b)
		},
		onPointer(ev) {
			const px = { x: ev.px, y: ev.py }
			if (ev.type === 'cancel') {
				cancel(this.drag)
				cancel(this.jobDrag)
				edit.endMove(this.pe)
			} else if (ev.type === 'down' && ev.hit.indexOf('j:') === 0) this.jobDown(ev, px)
			else if (this.jobDrag.kind) this.jobGesture(ev, px)
			else if (this.view === 'plan' && this.pointsMode) this.pointsGesture(ev, px)
			else this.regionGesture(ev, px)
		},
		regionGesture(ev, px) {
			const editRegion = this.editable && this.view === 'plan'
			if (ev.type === 'down') begin(this.drag, ev, px, this.region, editRegion)
			else if (ev.type === 'move') {
				const r = update(this.drag, ev, px, this.model.bed, snapStepFor(this.model.bed))
				if (r && r.region) this.setRegion(r.region)
			} else {
				const done = finish(this.drag)
				if (done.tap && done.tap.indexOf('p:') === 0) this.onSelect(done.tap.slice(2))
			}
		},
		pointsGesture(ev, px) {
			if (ev.type === 'down' && ev.hit.indexOf('h:') === 0 && this.resizable) {
				this.resizeBase = { region: Object.assign({}, this.region), points: this.pe.points.map(p => ({ x: p.x, y: p.y })) }
				begin(this.drag, ev, px, this.region, true)
			} else if (this.drag.kind === 'handle') this.areaGesture(ev, px)
			else if (ev.type === 'down') {
				begin(this.drag, ev, px, null, false)
				if (this.drag.kind !== 'point') return
				// dragging a node moves the chosen point on it (by its id: the node ids change while the grid changes)
				const cid = this.canEditPoints ? this.chosenOfNode(this.drag.pointId) : ''
				if (cid) this.drag.pointId = cid
				else this.drag.kind = ''
			} else if (ev.type === 'move') {
				const r = update(this.drag, ev, px, this.model.bed, 0)
				if (r && r.point) this.moveChosen(r.point.id, r.point.x, r.point.y)
			} else this.pointsUp(ev, px)
		},
		areaGesture(ev, px) {
			if (ev.type === 'move') {
				const r = update(this.drag, ev, px, this.model.bed, snapStepFor(this.model.bed))
				if (r && r.region) this.applyRegion(r.region, 'resize')
				return
			}
			edit.endMove(this.pe)
			const done = finish(this.drag)
			this.resizeBase = null
			if (done.tap && done.tap.indexOf('p:') === 0) this.onSelect(done.tap.slice(2))
		},
		pointsUp(ev, px) {
			const hit = this.drag.hit
			const tap = isTap(this.drag, px)
			const moved = this.drag.moved
			const id = this.drag.pointId
			edit.endMove(this.pe)
			finish(this.drag)
			if (moved && id) this.reselect(id)
			else if (hit.indexOf('p:') === 0 && tap) this.onSelect(hit.slice(2))
			else if (hit === '' && tap && this.canEditPoints) this.addAt(snap(ev.wx, this.step), snap(ev.wy, this.step))
		},
		// ---- the job rectangle: handles 'j:nw', 'j:ne', 'j:se', 'j:sw' resize it and 'j:move' moves it (the same maths as the region)
		jobDown(ev, px) {
			const id = ev.hit.slice(2)
			begin(this.jobDrag, Object.assign({}, ev, { hit: id === 'move' ? 'move' : 'h:' + id }), px, this.jobArea, true)
		},
		jobGesture(ev, px) {
			if (ev.type === 'move') {
				const r = update(this.jobDrag, ev, px, this.model.bed, snapStepFor(this.model.bed))
				if (r && r.region) Object.assign(this.job, jobOfRect(r.region))
			} else finish(this.jobDrag)
		},
		jobNudge(ev) {
			const r = nudge(this.jobArea, ev.handle, ev.key, ev.shift, this.model.bed, snapStepFor(this.model.bed))
			if (r) Object.assign(this.job, jobOfRect(r))
		},
		jobPlace() {
			const d = defaultJob(this.model.reach || this.model.bed)
			if (d) Object.assign(this.job, d)
		},
		jobClear() {
			Object.assign(this.job, { x: '', y: '', w: '', h: '' })
		}
	}
}
