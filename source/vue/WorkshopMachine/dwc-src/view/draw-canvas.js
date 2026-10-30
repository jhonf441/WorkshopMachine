'use strict'

// Paints the shapes of bed-geometry.renderBed on a 2D canvas context. The only code between the pure render and the pixels; it takes any
// object with the canvas 2D API, so the test paints on a recording fake.

export function drawItems(ctx, items, width, height) {
	ctx.clearRect(0, 0, width, height)
	items.forEach(it => {
		if (it.t === 'rect') drawRect(ctx, it)
		else if (it.t === 'circle') drawCircle(ctx, it)
		else if (it.t === 'text') drawText(ctx, it)
	})
}

function drawRect(ctx, it) {
	if (it.fill) {
		ctx.fillStyle = it.fill
		ctx.fillRect(it.x, it.y, it.w, it.h)
	}
	if (it.stroke) {
		ctx.strokeStyle = it.stroke
		ctx.lineWidth = it.lineWidth || 1
		ctx.setLineDash(it.dash || [])
		ctx.strokeRect(it.x, it.y, it.w, it.h)
		ctx.setLineDash([])
	}
}

function drawCircle(ctx, it) {
	ctx.beginPath()
	ctx.arc(it.x, it.y, it.r, 0, Math.PI * 2)
	if (it.fill) {
		ctx.fillStyle = it.fill
		ctx.fill()
	}
	if (it.stroke) {
		ctx.strokeStyle = it.stroke
		ctx.lineWidth = 1.5
		ctx.stroke()
	}
}

function drawText(ctx, it) {
	ctx.fillStyle = it.color
	ctx.font = (it.size || 11) + 'px sans-serif'
	ctx.textAlign = it.align || 'left'
	ctx.textBaseline = 'middle'
	ctx.fillText(it.text, it.x, it.y)
}
