'use strict'

// Geometry of the bed view (shared by Mesh, Level and Probe): world mm <-> SVG px at TRUE proportions (the same scale on X and Y), the
// mm grid, axis arrows, origin, scale bar, the axis-limit rectangle, the probe reach and the head-to-probe offset vector. Pure: no DOM.
// Machine looks at the bed from above: X to the right, Y up (SVG Y is flipped). One SVG unit is one CSS pixel (the component measures
// its box), so touch targets are real sizes.

export const PAD = { l: 40, r: 14, t: 14, b: 34 }
const INCLUDE_PX = 34 // room around a thing drawn past the bed: its glyph, its correction arrow and its label
const STEPS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000]

// the first "nice" step in mm whose drawn length is at least minPx
export function niceStep(pxPerMm, minPx) {
	const want = (minPx || 48) / Math.max(pxPerMm, 0.0001)
	for (const s of STEPS) if (s >= want) return s
	return STEPS[STEPS.length - 1]
}

// bed {xmin, xmax, ymin, ymax}, width in px -> frame with toPx / toWorld / size
export function makeFrame(bed, width, opts) {
	const pad = Object.assign({}, PAD, (opts && opts.pad) || {})
	const w = Math.max(240, Math.round(width))
	const bw = bed.xmax - bed.xmin
	const bh = bed.ymax - bed.ymin
	const maxH = (opts && opts.maxHeight) || Math.max(260, w * 1.05)
	let scale = Math.max(0.0001, Math.min((w - pad.l - pad.r) / bw, (maxH - pad.t - pad.b) / bh))
	// things drawn outside the bed (the Z motors can sit past the axis limits) get room in the margin so they never overlap the bed edge
	const keep = (opts && opts.include) || []
	if (keep.length) {
		const base = Object.assign({}, pad)
		const room = (mm, px) => (mm > 0 ? mm * scale + INCLUDE_PX : px)
		for (let i = 0; i < 4; i++) {
			pad.l = Math.max(base.l, room(bed.xmin - Math.min.apply(null, keep.map(k => k.x)), 0))
			pad.r = Math.max(base.r, room(Math.max.apply(null, keep.map(k => k.x)) - bed.xmax, 0))
			pad.b = Math.max(base.b, room(bed.ymin - Math.min.apply(null, keep.map(k => k.y)), 0))
			pad.t = Math.max(base.t, room(Math.max.apply(null, keep.map(k => k.y)) - bed.ymax, 0))
			scale = Math.max(0.0001, Math.min((w - pad.l - pad.r) / bw, (maxH - pad.t - pad.b) / bh))
		}
	}
	const innerW = bw * scale
	const innerH = bh * scale
	const ox = pad.l + (w - pad.l - pad.r - innerW) / 2
	const h = Math.round(innerH + pad.t + pad.b)
	return {
		w, h, scale, bed, pad, rect: { x: ox, y: pad.t, w: innerW, h: innerH },
		toPx: (x, y) => ({ x: ox + (x - bed.xmin) * scale, y: pad.t + innerH - (y - bed.ymin) * scale }),
		toWorld: (px, py) => ({ x: bed.xmin + (px - ox) / scale, y: bed.ymin + (pad.t + innerH - py) / scale })
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
	const step = niceStep(frame.scale, 48)
	const b = frame.bed
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
	const origin = b.xmin <= 0 && b.xmax >= 0 && b.ymin <= 0 && b.ymax >= 0 ? frame.toPx(0, 0) : null
	const r = frame.rect
	return {
		limits: rectPx(frame, b), reach: rectPx(frame, reach), grid: gridOf(frame), scaleBar: scaleBarOf(frame), origin,
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

export const HIT_RADIUS = 22 // px: the touch target of a point (a 44 px circle)
