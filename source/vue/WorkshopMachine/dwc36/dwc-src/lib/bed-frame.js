'use strict'

// Geometry of the bed view (shared by Mesh, Level and Probe): world mm <-> SVG px at TRUE proportions (the same scale on X and Y), the
// mm grid, axis arrows, origin, scale bar, the axis-limit rectangle, the probe reach and the head-to-probe offset vector. Pure: no DOM.
// Machine looks at the bed from above: X to the right, Y up (SVG Y is flipped). One SVG unit is one CSS pixel (the component measures
// its box), so touch targets are real sizes.

export const PAD = { l: 40, r: 14, t: 14, b: 34 }
const INCLUDE_PX = 34 // room around a thing drawn past the bed: its glyph, its correction arrow and its label
const STEPS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000]
const MIN_TICK_PX = 28 // a fixed step is kept only while its ticks are at least this far apart

// the first "nice" step in mm whose drawn length is at least minPx
export function niceStep(pxPerMm, minPx) {
	const want = (minPx || 48) / Math.max(pxPerMm, 0.0001)
	for (const s of STEPS) if (s >= want) return s
	return STEPS[STEPS.length - 1]
}

// bed {xmin, xmax, ymin, ymax}, width in px -> frame with toPx / toWorld / size.
// Things drawn outside the bed (the Z motors can sit past the axis limits, opts.include) are drawn INSIDE the measured frame (owner, 2026-11-23,
// note 6): the frame with the grid, the ticks and the scale is the union of the bed and those things plus room for their glyph and label
// (frame.view); the bed (the axis limits, frame.bed) is a rectangle inside it. Without such things the frame is the bed, as before.
export function makeFrame(bed, width, opts) {
	const pad = Object.assign({}, PAD, (opts && opts.pad) || {})
	const w = Math.max(240, Math.round(width))
	const maxH = (opts && opts.maxHeight) || Math.max(260, w * 1.05)
	const fit = v => Math.max(0.0001, Math.min((w - pad.l - pad.r) / (v.xmax - v.xmin), (maxH - pad.t - pad.b) / (v.ymax - v.ymin)))
	let view = bed
	let scale = fit(view)
	const keep = ((opts && opts.include) || []).filter(k => k && isFinite(k.x) && isFinite(k.y))
	const outside = keep.filter(k => k.x < bed.xmin || k.x > bed.xmax || k.y < bed.ymin || k.y > bed.ymax)
	if (outside.length) {
		// the room in mm depends on the scale, which depends on the room: a few rounds settle it
		for (let i = 0; i < 4; i++) {
			const m = INCLUDE_PX / scale
			const xs = keep.map(k => k.x)
			const ys = keep.map(k => k.y)
			view = {
				xmin: Math.min(bed.xmin, Math.min.apply(null, xs) - m), xmax: Math.max(bed.xmax, Math.max.apply(null, xs) + m),
				ymin: Math.min(bed.ymin, Math.min.apply(null, ys) - m), ymax: Math.max(bed.ymax, Math.max.apply(null, ys) + m)
			}
			scale = fit(view)
		}
	}
	const innerW = (view.xmax - view.xmin) * scale
	const innerH = (view.ymax - view.ymin) * scale
	const ox = pad.l + (w - pad.l - pad.r - innerW) / 2
	const h = Math.round(innerH + pad.t + pad.b)
	return {
		w, h, scale, bed, view, pad, rect: { x: ox, y: pad.t, w: innerW, h: innerH }, stepMm: (opts && opts.stepMm) || 0,
		toPx: (x, y) => ({ x: ox + (x - view.xmin) * scale, y: pad.t + innerH - (y - view.ymin) * scale }),
		toWorld: (px, py) => ({ x: view.xmin + (px - ox) / scale, y: view.ymin + (pad.t + innerH - py) / scale })
	}
}

// a world rectangle as an SVG rect {x, y, w, h} (null stays null)
export function rectPx(frame, r) {
	if (!r) return null
	const a = frame.toPx(r.xmin, r.ymax)
	const b = frame.toPx(r.xmax, r.ymin)
	return { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y }
}

function ticks(lo, hi, step) {
	const out = []
	for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(Math.round(v * 1000) / 1000)
	return out
}

// the mm grid: vertical lines (X values) and horizontal lines (Y values) with their pixel positions
export function gridOf(frame) {
	// a fixed step (the levelling bed ticks every 100 mm) is used while it still leaves room between ticks, else the nice step
	const step = frame.stepMm && frame.stepMm * frame.scale >= MIN_TICK_PX ? frame.stepMm : niceStep(frame.scale, 48)
	const b = frame.view || frame.bed // the whole measured frame (bed + motors)
	const vertical = ticks(b.xmin, b.xmax, step).map(v => ({ v, px: frame.toPx(v, b.ymin).x }))
	const horizontal = ticks(b.ymin, b.ymax, step).map(v => ({ v, px: frame.toPx(b.xmin, v).y }))
	return { step, vertical, horizontal }
}

// scale bar: a round length of up to a fifth of the bed width, at the lower right under the bed
export function scaleBarOf(frame) {
	const target = (frame.bed.xmax - frame.bed.xmin) / 5
	const mm = STEPS.filter(s => s <= target).pop() || STEPS[0]
	const r = frame.rect
	const w = mm * frame.scale
	return { mm, x: r.x + r.w - w, y: r.y + r.h + 22, w }
}

// the offset of the probe from the nozzle as a vector drawn at `anchor` (the head), true scale. null when the offset is unknown.
export function offsetVector(frame, offset, anchor) {
	if (!offset) return null
	const b = frame.bed
	const at = anchor || { x: (b.xmin + b.xmax) / 2, y: (b.ymin + b.ymax) / 2 }
	return { head: frame.toPx(at.x, at.y), probe: frame.toPx(at.x + offset.x, at.y + offset.y), x: offset.x, y: offset.y, zero: Math.abs(offset.x) < 0.01 && Math.abs(offset.y) < 0.01 }
}

// everything the backdrop draws, in px
export function backdropOf(frame, reach) {
	const b = frame.bed
	const v = frame.view || b
	const origin = v.xmin <= 0 && v.xmax >= 0 && v.ymin <= 0 && v.ymax >= 0 ? frame.toPx(0, 0) : null
	const r = frame.rect
	return {
		// view: the measured frame (the grid lives in it); limits: the bed inside it (the same rectangle when nothing is drawn past the bed)
		view: rectPx(frame, v), limits: rectPx(frame, b), reach: rectPx(frame, reach), grid: gridOf(frame), scaleBar: scaleBarOf(frame), origin,
		axes: { x: { x1: r.x, y1: r.y + r.h + 8, x2: r.x + 28, y2: r.y + r.h + 8 }, y: { x1: r.x - 8, y1: r.y + r.h, x2: r.x - 8, y2: r.y + r.h - 28 } }
	}
}

// radius of a point glyph: big when there are few points, smaller (never under 4.5 px) when they are close together
export function glyphRadius(frame, points) {
	let min = Infinity
	for (let a = 0; a < points.length; a++) {
		for (let b = a + 1; b < points.length; b++) {
			const d = Math.hypot(points[a].x - points[b].x, points[a].y - points[b].y) * frame.scale
			if (d > 0 && d < min) min = d
		}
	}
	return Math.max(4.5, Math.min(10, min === Infinity ? 10 : min * 0.4))
}

// is the point {x, y} (mm) inside the rectangle {xmin, xmax, ymin, ymax}? No rectangle: nothing to be outside of
export function insideRect(rect, p) {
	return !rect || (p.x >= rect.xmin && p.x <= rect.xmax && p.y >= rect.ymin && p.y <= rect.ymax)
}

// the physical area of a leadscrew under the bed, in px: a real size in mm, never smaller than a finger can find
export const SCREW_AREA_MM = 20
export function screwAreaPx(frame) {
	return Math.max(30, SCREW_AREA_MM * frame.scale)
}

export const HIT_RADIUS = 22 // px: the touch target of a point (a 44 px circle)
