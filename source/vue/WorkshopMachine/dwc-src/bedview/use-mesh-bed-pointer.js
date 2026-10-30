'use strict'

// The pointer on the mesh bed (a composable of MeshBed.vue): what a tap, a drag or a cancelled gesture does in each mode. Region mode: the
// rectangle (as before). Points mode: tap an empty spot to add a point, tap a node to select it, drag a node that carries a chosen point to
// move that point. The job rectangle of "Check a job area" is dragged in either mode. A gesture the browser cancels (a scroll on a touch
// screen) never adds, selects or moves anything. `m` and `p` are what use-mesh-bed-model.js and use-mesh-bed-points.js returned; `ctx` =
// { view, selected, drag, jobDrag, job } (the drag objects come from state/region-drag.js).
// Resizing the area works in both modes through applyRegion(): in Region mode it writes the region fields of the run form, in Points mode
// the chosen points are scaled with the area (a whole drag is ONE undo step, scaled from the points as they were when it started).

import { begin, update, finish, cancel, isTap } from '../state/region-drag.js'
import * as edit from '../state/point-edit-state.js'
import { fieldsOfRegion, nudge, snap, snapStepFor, resizeBy } from '../lib/bed-region.js'
import { presetRegion } from '../lib/bed-mesh-plan.js'
import { scalePoints } from '../lib/mesh-resize.js'
import { jobOfRect, defaultJob } from '../lib/job-fit.js'

// the job rectangle of "Check a job area": handles 'j:nw', 'j:ne', 'j:se', 'j:sw' resize it and 'j:move' moves it (the same maths as the region)
function useMeshBedJob(props, m, ctx) {
	const { jobDrag, job } = ctx
	function jobDown(ev, px) {
		const id = ev.hit.slice(2)
		begin(jobDrag, Object.assign({}, ev, { hit: id === 'move' ? 'move' : 'h:' + id }), px, m.jobArea.value, true)
	}
	function jobGesture(ev, px) {
		if (ev.type === 'move') {
			const r = update(jobDrag, ev, px, props.model.bed, snapStepFor(props.model.bed))
			if (r && r.region) Object.assign(job, jobOfRect(r.region))
		} else finish(jobDrag)
	}
	function jobNudge(ev) {
		const r = nudge(m.jobArea.value, ev.handle, ev.key, ev.shift, props.model.bed, snapStepFor(props.model.bed))
		if (r) Object.assign(job, jobOfRect(r))
	}
	function jobPlace() {
		const d = defaultJob(props.model.reach || props.model.bed)
		if (d) Object.assign(job, d)
	}
	function jobClear() {
		Object.assign(job, { x: '', y: '', w: '', h: '' })
	}
	return { jobDown, jobGesture, jobNudge, jobPlace, jobClear }
}

// what the area does when it changes: the region of the run form (Region mode) or the chosen points scaled with it (Points mode)
function useMeshBedRegion(props, m, p, ctx, base0) {
	const { view, selected } = ctx
	function setRegion(r) {
		props.inputs.mode = 'region'
		Object.assign(props.inputs.region, fieldsOfRegion(r))
	}
	function onSelect(id) {
		selected.value = selected.value === id ? '' : id
	}
	// the area becomes `r`: the region of the run form (Region mode) or the chosen points scaled to it (Points mode)
	function applyRegion(r, key) {
		if (!m.pointsMode.value) return setRegion(r)
		const base = key && base0() ? base0() : { region: m.region.value, points: props.pe.points }
		if (!base.region || !base.points.length) return
		edit.placePoints(props.pe, props.pe.points, scalePoints(base.points, base.region, r, p.area.value), key)
	}
	function onResize(delta) {
		const r = resizeBy(m.region.value, delta, props.model.bed)
		if (r) applyRegion(r)
	}
	function onPreset(id) {
		const r = presetRegion(id, props.model)
		if (!r) return
		if (id === 'whole' && !m.pointsMode.value) props.inputs.mode = 'bed'
		else applyRegion(r)
	}
	function onNudge(ev) {
		const r = nudge(m.region.value, ev.handle, ev.key, ev.shift, props.model.bed, snapStepFor(props.model.bed))
		if (r) applyRegion(r)
	}
	function onTypedRegion(r) {
		applyRegion(r)
	}
	// from the result back to the plan with the area of the mesh on show
	function editArea() {
		const b = props.grid && props.grid.bounds
		view.value = 'plan'
		if (b && !m.pointsMode.value) setRegion(b)
	}
	return { setRegion, onSelect, applyRegion, onResize, onPreset, onNudge, onTypedRegion, editArea }
}

export function useMeshBedPointer(props, m, p, ctx) {
	const { view, selected, drag, jobDrag } = ctx
	let resizeBase = null // the region and the points as they were when a resize drag started
	const { jobDown, jobGesture, jobNudge, jobPlace, jobClear } = useMeshBedJob(props, m, ctx)
	const { setRegion, onSelect, applyRegion, onResize, onPreset, onNudge, onTypedRegion, editArea } = useMeshBedRegion(props, m, p, ctx, () => resizeBase)
	function onPointer(ev) {
		const px = { x: ev.px, y: ev.py }
		if (ev.type === 'cancel') {
			cancel(drag)
			cancel(jobDrag)
			edit.endMove(props.pe)
		} else if (ev.type === 'down' && ev.hit.indexOf('j:') === 0) jobDown(ev, px)
		else if (jobDrag.kind) jobGesture(ev, px)
		else if (view.value === 'plan' && m.pointsMode.value) pointsGesture(ev, px)
		else regionGesture(ev, px)
	}
	function regionGesture(ev, px) {
		const editRegion = props.editable && view.value === 'plan'
		if (ev.type === 'down') begin(drag, ev, px, m.region.value, editRegion)
		else if (ev.type === 'move') {
			const r = update(drag, ev, px, props.model.bed, snapStepFor(props.model.bed))
			if (r && r.region) setRegion(r.region)
		} else {
			const done = finish(drag)
			if (done.tap && done.tap.indexOf('p:') === 0) onSelect(done.tap.slice(2))
		}
	}
	function pointsGesture(ev, px) {
		if (ev.type === 'down' && ev.hit.indexOf('h:') === 0 && m.resizable.value) {
			resizeBase = { region: Object.assign({}, m.region.value), points: props.pe.points.map(q => ({ x: q.x, y: q.y })) }
			begin(drag, ev, px, m.region.value, true)
		} else if (drag.kind === 'handle') areaGesture(ev, px)
		else if (ev.type === 'down') {
			begin(drag, ev, px, null, false)
			if (drag.kind !== 'point') return
			// dragging a node moves the chosen point on it (by its id: the node ids change while the grid changes)
			const cid = p.canEditPoints.value ? p.chosenOfNode(drag.pointId) : ''
			if (cid) drag.pointId = cid
			else drag.kind = ''
		} else if (ev.type === 'move') {
			const r = update(drag, ev, px, props.model.bed, 0)
			if (r && r.point) p.moveChosen(r.point.id, r.point.x, r.point.y)
		} else pointsUp(ev, px)
	}
	function areaGesture(ev, px) {
		if (ev.type === 'move') {
			const r = update(drag, ev, px, props.model.bed, snapStepFor(props.model.bed))
			if (r && r.region) applyRegion(r.region, 'resize')
			return
		}
		edit.endMove(props.pe)
		const done = finish(drag)
		resizeBase = null
		if (done.tap && done.tap.indexOf('p:') === 0) onSelect(done.tap.slice(2))
	}
	function pointsUp(ev, px) {
		const hit = drag.hit
		const tap = isTap(drag, px)
		const moved = drag.moved
		const id = drag.pointId
		edit.endMove(props.pe)
		finish(drag)
		if (moved && id) p.reselect(id)
		else if (hit.indexOf('p:') === 0 && tap) onSelect(hit.slice(2))
		else if (hit === '' && tap && p.canEditPoints.value) p.addAt(snap(ev.wx, p.step.value), snap(ev.wy, p.step.value))
	}
	return { onSelect, onResize, onPreset, onNudge, onTypedRegion, editArea, onPointer, jobNudge, jobPlace, jobClear }
}
