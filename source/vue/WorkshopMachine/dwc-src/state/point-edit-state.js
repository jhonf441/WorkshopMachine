'use strict'

// Explicit state of the points a person edits on the bed (Mesh: the chosen points; Level: the measurement points), with undo and redo.
// Plain functions that take the state; the component only holds it in data().
//
//   edited  false = "follow what the page / service suggests"; the first edit copies the points on screen (`current`) and sets it
//   points  [{id, x, y}] the person's own set
//   mode    'region' | 'points' (Mesh: which of the two the bed is editing; Level always works on points)
//   past / future  snapshots {edited, points} for undo / redo (at most MAX_HISTORY)
//   moving  id of the point being dragged: a whole drag is ONE undo step
//
// Every change goes through change(), which records the snapshot BEFORE the change.

export const MAX_HISTORY = 50
export const DUPLICATE_MM = 0.05 // a new point this close to another one is the same point

export function createPointEdit() {
	return { edited: false, points: [], seq: 0, mode: 'region', past: [], future: [], moving: '' }
}

const round = v => Math.round(v * 10) / 10
const copy = points => points.map(p => ({ id: p.id, x: p.x, y: p.y }))
const snapshot = s => ({ edited: s.edited, points: copy(s.points) })

function record(s) {
	s.past.push(snapshot(s))
	if (s.past.length > MAX_HISTORY) s.past.shift()
	s.future = []
}

// first edit: start from exactly what was on screen
function adopt(s, current) {
	if (!s.edited) {
		s.points = copy(current || [])
		s.edited = true
	}
}

function change(s, current, fn) {
	s.moving = ''
	record(s)
	adopt(s, current)
	return fn()
}

export function canUndo(s) {
	return s.past.length > 0
}

export function canRedo(s) {
	return s.future.length > 0
}

// -> the id of the new point, or '' when it was refused (limit reached, or the same place as another point)
export function addPoint(s, current, x, y, limit) {
	const base = s.edited ? s.points : current || []
	if (limit && base.length >= limit) return ''
	const px = round(x)
	const py = round(y)
	if (base.some(p => Math.hypot(p.x - px, p.y - py) < DUPLICATE_MM)) return ''
	return change(s, current, () => {
		s.seq += 1
		const id = 'u' + s.seq
		s.points.push({ id, x: px, y: py })
		return id
	})
}

export function removePoints(s, current, ids) {
	const gone = Array.isArray(ids) ? ids : [ids]
	const base = s.edited ? s.points : current || []
	if (!base.some(p => gone.indexOf(p.id) >= 0)) return false
	change(s, current, () => { s.points = s.points.filter(p => gone.indexOf(p.id) < 0) })
	return true
}

// a drag calls this on every move: the first call of a drag records the undo step, the next ones only move the point
export function movePoint(s, current, id, x, y) {
	if (s.moving !== id) {
		record(s)
		adopt(s, current)
		s.moving = id
	}
	const p = s.points.find(q => q.id === id)
	if (p) { p.x = round(x); p.y = round(y) }
}

export function endMove(s) {
	s.moving = ''
}

// Moves ALL the points at once to `list` [{x, y}] (same order and count; the ids stay): resizing the area they live in. `key` names a drag:
// the first call with that key records the undo step, the next ones only place the points, so a whole drag is ONE step; without a key
// every call is a step. -> false when the count does not match (nothing changed)
export function placePoints(s, current, list, key) {
	const base = s.edited ? s.points : current || []
	if (!list || list.length !== base.length || !base.length) return false
	if (!key || s.moving !== key) {
		record(s)
		adopt(s, current)
		s.moving = key || ''
	}
	s.points.forEach((p, i) => { p.x = round(list[i].x); p.y = round(list[i].y) })
	return true
}

// back to "follow the suggestion" (Level) / no chosen points (Mesh); undo brings the points back
export function resetPoints(s) {
	if (!s.edited && !s.points.length) return false
	s.moving = ''
	record(s)
	s.edited = false
	s.points = []
	return true
}

// replace the whole set (a template, or "start from the current grid"); limit cuts the list
export function setPoints(s, current, list, limit) {
	change(s, current, () => {
		s.points = []
		list.slice(0, limit || list.length).forEach(p => {
			s.seq += 1
			s.points.push({ id: 'u' + s.seq, x: round(p.x), y: round(p.y) })
		})
		s.edited = true
	})
}

export function undo(s) {
	if (!s.past.length) return false
	s.moving = ''
	s.future.push(snapshot(s))
	const was = s.past.pop()
	s.edited = was.edited
	s.points = was.points
	return true
}

export function redo(s) {
	if (!s.future.length) return false
	s.moving = ''
	s.past.push(snapshot(s))
	const next = s.future.pop()
	s.edited = next.edited
	s.points = next.points
	return true
}
