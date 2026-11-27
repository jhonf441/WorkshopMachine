'use strict'

// The leadscrews of the levelling bed as something you can touch: which one is chosen (its detail opens beside the bed), the correction and
// the nearest measurement point for it, and the legend ids (what is drawn; the "outside the probing area" mark only when a leadscrew is).
// Used by LevelBed.vue, which provides `screws`, `points`, `corrections`, `counts` and `model`.

import { insideRect } from '../lib/bed-frame.js'

export const levelScrewMixin = {
	data() {
		return { selectedScrew: null }
	},
	computed: {
		legendIds() {
			const ids = ['screw']
			if (this.screws.some(s => !insideRect(this.model.reach, s))) ids.push('screw_out')
			ids.push('probe', 'reach')
			if (this.counts.clipped) ids.push('clipped')
			if (this.counts.outside_reach) ids.push('outside_reach')
			return ids
		},
		screwChosen() {
			return this.selectedScrew === null ? null : this.screws.find(s => s.index === this.selectedScrew) || null
		},
		screwCorrection() {
			return this.corrections.find(c => c.motor === this.selectedScrew) || null
		},
		screwNearest() {
			const s = this.screwChosen
			if (!s || !this.points.length) return null
			let best = null
			this.points.forEach(p => {
				const mm = Math.hypot(s.x - p.x, s.y - p.y)
				if (!best || mm < best.mm) best = { point: p, mm }
			})
			return best
		}
	},
	methods: {
		onSelectScrew(index) {
			this.selectedScrew = this.selectedScrew === index ? null : index
			if (this.selectedScrew !== null) this.selected = ''
		}
	}
}
