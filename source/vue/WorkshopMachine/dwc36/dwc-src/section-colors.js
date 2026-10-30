'use strict'

// The color of each section of the page (the family reads it as --wf-sec on the page root).

export const SECTION_COLORS = {
	overview: '#1E88E5',
	probe: '#00ACC1',
	level: '#43A047',
	mesh: '#26A69A',
	offsets: '#7E57C2',
	height: '#FFA000',
	limits: '#E53935',
	workarea: '#5C6BC0',
	calibration: '#F57C00',
	motion: '#AB47BC',
	shaping: '#8E24AA',
	safety: '#C62828',
	maintenance: '#6D8B3A',
	modes: '#3949AB',
	history: '#607D8B',
	report: '#546E7A'
}

export function sectionColor(id) {
	return SECTION_COLORS[id] || '#1E88E5'
}
