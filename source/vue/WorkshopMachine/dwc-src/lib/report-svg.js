'use strict'

// The drawings of the printable report as inline SVG strings (design 2.11): the mesh colour map and the levelling residual. No
// dependency, no DOM: strings only, so a test can check them and the page puts them in with v-html. Everything is drawn in fixed
// "ink on paper" colours (the report is printed or saved as PDF); numbers are printed next to the colours.

import { renderBed, paletteFor, formatMm } from '../view/bed-geometry.js'

const INK = '#111111'
const FAINT = '#777777'
const ALERT = '#b71c1c'

export function esc(s) {
	return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function n1(v) {
	return String(Math.round(v * 10) / 10)
}

const ANCHOR = { left: 'start', center: 'middle', right: 'end' }

function text(x, y, color, size, anchor, value) {
	return '<text x="' + n1(x) + '" y="' + n1(y) + '" fill="' + color + '" font-size="' + size + '" text-anchor="' + anchor + '" dominant-baseline="middle">' + esc(value) + '</text>'
}

// the shapes of bed-geometry.renderBed (rect, circle, text) as SVG elements
export function itemsToSvg(items) {
	return items.map(it => {
		if (it.t === 'rect') {
			const stroke = it.stroke ? ' stroke="' + it.stroke + '" stroke-width="' + (it.lineWidth || 1) + '"' : ''
			const dash = it.dash ? ' stroke-dasharray="' + it.dash.join(' ') + '"' : ''
			return '<rect x="' + n1(it.x) + '" y="' + n1(it.y) + '" width="' + n1(it.w) + '" height="' + n1(it.h) + '" fill="' + (it.fill || 'none') + '"' + stroke + dash + '/>'
		}
		if (it.t === 'circle') {
			return '<circle cx="' + n1(it.x) + '" cy="' + n1(it.y) + '" r="' + it.r + '" fill="' + (it.fill || 'none') + '"' + (it.stroke ? ' stroke="' + it.stroke + '" stroke-width="1.5"' : '') + '/>'
		}
		return text(it.x, it.y, it.color, it.size || 11, ANCHOR[it.align] || 'start', it.text)
	}).join('')
}

function wrap(w, h, inner, label) {
	return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + h + '" width="100%" role="img" aria-label="' + esc(label) + '" font-family="sans-serif">' + inner + '</svg>'
}

// colour map of one mesh (or of a difference map) with its legend: bed = {xmin, xmax, ymin, ymax}; options {label, legendLabel, center, symmetric}
export function meshSvg(grid, bed, options) {
	const o = options || {}
	const size = { w: 520, h: 364 }
	const view = renderBed({ size, bed, grid, scale: { center: o.center || 'mean', symmetric: !!o.symmetric }, tolerance: null, showValues: true, region: null, markers: [], palette: paletteFor(false) })
	let inner = '<rect x="0" y="0" width="' + size.w + '" height="' + (size.h + 34) + '" fill="#ffffff"/>' + itemsToSvg(view.items)
	if (view.legend) {
		const stops = view.legend.stops
		const cell = size.w / stops.length
		inner += text(4, size.h + 8, INK, 11, 'start', o.legendLabel || '')
		stops.forEach((s, i) => {
			inner += '<rect x="' + n1(i * cell + 4) + '" y="' + (size.h + 16) + '" width="14" height="14" fill="' + s.color + '" stroke="' + FAINT + '"/>'
			inner += text(i * cell + 22, size.h + 24, INK, 11, 'start', formatMm(s.value))
		})
	}
	return wrap(size.w, size.h + 34, inner, o.label || '')
}

// residual of the levelling passes: rows from lib/level.js passRows; the dashed line is the tolerance. options {label, passLabel, toleranceLabel}
export function residualSvg(rows, tolerance, options) {
	const o = options || {}
	const W = 520
	const H = 200
	const padL = 46
	const padB = 28
	const padT = 12
	const vals = rows.map(r => r.after).filter(v => typeof v === 'number')
	if (!vals.length) return ''
	const hi = Math.max.apply(null, vals.concat(typeof tolerance === 'number' ? [tolerance] : [])) || 1
	const y = v => padT + (H - padT - padB) * (1 - v / hi)
	const x = i => (rows.length === 1 ? W / 2 : padL + (W - padL - 12) * (i / (rows.length - 1)))
	let inner = '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#ffffff"/>'
	inner += '<line x1="' + padL + '" y1="' + n1(y(0)) + '" x2="' + (W - 8) + '" y2="' + n1(y(0)) + '" stroke="' + FAINT + '"/>'
	inner += '<line x1="' + padL + '" y1="' + padT + '" x2="' + padL + '" y2="' + n1(y(0)) + '" stroke="' + FAINT + '"/>'
	inner += text(padL - 4, padT, INK, 11, 'end', formatMm(hi)) + text(padL - 4, y(0), INK, 11, 'end', '0')
	if (typeof tolerance === 'number') {
		inner += '<line x1="' + padL + '" y1="' + n1(y(tolerance)) + '" x2="' + (W - 8) + '" y2="' + n1(y(tolerance)) + '" stroke="' + ALERT + '" stroke-dasharray="6 4"/>'
		inner += text(W - 8, y(tolerance) - 7, ALERT, 11, 'end', (o.toleranceLabel || '') + ' ' + formatMm(tolerance))
	}
	const pts = rows.map((r, i) => (typeof r.after === 'number' ? n1(x(i)) + ',' + n1(y(r.after)) : null)).filter(Boolean)
	inner += '<polyline points="' + pts.join(' ') + '" fill="none" stroke="' + INK + '" stroke-width="1.5"/>'
	rows.forEach((r, i) => {
		if (typeof r.after !== 'number') return
		inner += '<circle cx="' + n1(x(i)) + '" cy="' + n1(y(r.after)) + '" r="3" fill="' + INK + '"/>'
		inner += text(x(i), H - 10, INK, 11, 'middle', (o.passLabel || '') + r.n) + text(x(i), y(r.after) - 9, INK, 10, 'middle', formatMm(r.after))
	})
	return wrap(W, H, inner, o.label || '')
}
