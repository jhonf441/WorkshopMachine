'use strict'

// Editing of the mesh region on the bed view: handles, snap, move, keyboard nudges and the conversion to and from the text fields of the
// run form (the fields and the drawing are two views of the same numbers). Pure.

export const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
export const MIN_SIZE = 10 // mm: a region smaller than this is not a mesh

export function snap(v, step) {
	return step > 0 ? Math.round(v / step) * step : v
}

function clamp(v, lo, hi) {
	return Math.max(lo, Math.min(hi, v))
}

// the handle positions in world mm: [{id, x, y}]
export function handlePositions(r) {
	const cx = (r.xmin + r.xmax) / 2
	const cy = (r.ymin + r.ymax) / 2
	const at = { nw: [r.xmin, r.ymax], n: [cx, r.ymax], ne: [r.xmax, r.ymax], e: [r.xmax, cy], se: [r.xmax, r.ymin], s: [cx, r.ymin], sw: [r.xmin, r.ymin], w: [r.xmin, cy] }
	return HANDLES.map(id => ({ id, x: at[id][0], y: at[id][1] }))
}

const round = v => Math.round(v * 1000) / 1000

// move one or two edges to the world point (wx, wy), snapped, kept inside `bed` and at least MIN_SIZE wide
export function dragHandle(region, handle, wx, wy, bed, step) {
	const r = Object.assign({}, region)
	const x = clamp(snap(wx, step), bed.xmin, bed.xmax)
	const y = clamp(snap(wy, step), bed.ymin, bed.ymax)
	if (handle.indexOf('w') >= 0) r.xmin = Math.min(x, r.xmax - MIN_SIZE)
	if (handle.indexOf('e') >= 0) r.xmax = Math.max(x, r.xmin + MIN_SIZE)
	if (handle.indexOf('s') >= 0) r.ymin = Math.min(y, r.ymax - MIN_SIZE)
	if (handle.indexOf('n') >= 0) r.ymax = Math.max(y, r.ymin + MIN_SIZE)
	return { xmin: round(r.xmin), xmax: round(r.xmax), ymin: round(r.ymin), ymax: round(r.ymax) }
}

// move the whole region by (dx, dy) mm, snapped, without leaving the bed (the size is kept)
export function dragMove(region, dx, dy, bed, step) {
	const w = region.xmax - region.xmin
	const h = region.ymax - region.ymin
	const xmin = clamp(snap(region.xmin + dx, step), bed.xmin, bed.xmax - w)
	const ymin = clamp(snap(region.ymin + dy, step), bed.ymin, bed.ymax - h)
	return { xmin: round(xmin), xmax: round(xmin + w), ymin: round(ymin), ymax: round(ymin + h) }
}

// a new region drawn by dragging from one world point to another; null while it is smaller than MIN_SIZE
export function regionFromCorners(a, b, bed, step) {
	const x0 = clamp(snap(Math.min(a.x, b.x), step), bed.xmin, bed.xmax)
	const x1 = clamp(snap(Math.max(a.x, b.x), step), bed.xmin, bed.xmax)
	const y0 = clamp(snap(Math.min(a.y, b.y), step), bed.ymin, bed.ymax)
	const y1 = clamp(snap(Math.max(a.y, b.y), step), bed.ymin, bed.ymax)
	return x1 - x0 >= MIN_SIZE && y1 - y0 >= MIN_SIZE ? { xmin: x0, xmax: x1, ymin: y0, ymax: y1 } : null
}

const ARROWS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }

// keyboard: an arrow key moves the handle (or the whole region for 'move') one step; shift = ten steps. null when the key is not an arrow
export function nudge(region, handle, key, shift, bed, step) {
	const d = ARROWS[key]
	if (!d) return null
	const k = (step || 1) * (shift ? 10 : 1)
	if (handle === 'move') return dragMove(region, d[0] * k, d[1] * k, bed, 0)
	const p = handlePositions(region).find(h => h.id === handle)
	return p ? dragHandle(region, handle, p.x + d[0] * k, p.y + d[1] * k, bed, 0) : null
}

// the text fields of the form {xmin, xmax, ymin, ymax} (strings, may be empty) <-> a region of numbers
export function regionOfFields(f) {
	const n = v => (typeof v === 'string' && v.trim() !== '' ? Number(v) : v)
	const r = { xmin: n(f && f.xmin), xmax: n(f && f.xmax), ymin: n(f && f.ymin), ymax: n(f && f.ymax) }
	const ok = [r.xmin, r.xmax, r.ymin, r.ymax].every(v => typeof v === 'number' && isFinite(v)) && r.xmax > r.xmin && r.ymax > r.ymin
	return ok ? r : null
}

export function fieldsOfRegion(r) {
	const s = v => String(Math.round(v * 10) / 10)
	return { xmin: s(r.xmin), xmax: s(r.xmax), ymin: s(r.ymin), ymax: s(r.ymax) }
}

// snap step in mm for a bed: about 60 steps across its width (1, 2, 5 or 10 mm)
export function snapStepFor(bed) {
	const want = (bed.xmax - bed.xmin) / 60
	return [1, 2, 5, 10].find(s => s >= want) || 10
}

// Grows (delta > 0) or shrinks (delta < 0) the region by `delta` mm on EACH side, around its centre, inside the bed; null when it would
// get smaller than MIN_SIZE (the buttons "bigger / smaller" of the toolbar: the same change as dragging all four sides)
export function resizeBy(region, delta, bed) {
	if (!region) return null
	const r = { xmin: region.xmin - delta, xmax: region.xmax + delta, ymin: region.ymin - delta, ymax: region.ymax + delta }
	if (bed) {
		r.xmin = Math.max(r.xmin, bed.xmin)
		r.xmax = Math.min(r.xmax, bed.xmax)
		r.ymin = Math.max(r.ymin, bed.ymin)
		r.ymax = Math.min(r.ymax, bed.ymax)
	}
	return r.xmax - r.xmin >= MIN_SIZE && r.ymax - r.ymin >= MIN_SIZE ? r : null
}
