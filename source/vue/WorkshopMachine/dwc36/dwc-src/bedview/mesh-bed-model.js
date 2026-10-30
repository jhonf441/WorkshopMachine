'use strict'

// What the mesh bed derives from its props (a mixin of MeshBed.vue: the component declares the props and the data this reads by name:
// model, inputs, form, grid, previous, serviceMesh, thresholds, pe, derived, view, compare, selected, opts, job). The plan (region, points,
// statuses, time), the result (heat map, statistics, comparison), the detail of the tapped point, the chosen / derived / snapped marks and
// the job-fit verdict. Pure computations over the props: nothing here writes.

import { planPoints, mergeService, acceptedRegion, countsOf, estimateSeconds, presetRegion, MESH_MARGIN } from '../lib/bed-mesh-plan.js'
import { regionOfFields } from '../lib/bed-region.js'
import { heatNodes, heatScale, compareGrids, nodeDetail } from '../lib/bed-heat.js'
import { qualityView } from '../lib/mesh-grid.js'
import { fitJob, jobRect, meshBox } from '../lib/job-fit.js'

export const meshBedModel = {
	computed: {
		pointsMode() {
			return this.pe.mode === 'points'
		},
		// there is an area to resize: the region (Region mode), or the grid the chosen points give (Points mode)
		hasRegion() {
			return !this.pointsMode || !!this.okDerived
		},
		// the handles and the size tools work now
		resizable() {
			return this.editable && this.view === 'plan' && this.hasRegion
		},
		// the derived grid when it exists (a Points mode whose chosen points give a grid), else null
		okDerived() {
			return this.derived && this.derived.ok ? this.derived : null
		},
		region() {
			if (this.okDerived) return this.okDerived.region
			return this.inputs.mode === 'region' ? regionOfFields(this.inputs.region) : presetRegion('whole', this.model)
		},
		plan() {
			const n = this.form.params.points
			const margin = this.serviceMesh && this.serviceMesh.margin !== null ? this.serviceMesh.margin : MESH_MARGIN
			const local = planPoints(this.region, n[0], n[1], this.model.bed, this.model.reach, margin)
			return mergeService(local, this.serviceMesh && this.serviceMesh.points)
		},
		// the part of the region the run accepts, when it is smaller than what was drawn
		accepted() {
			const a = this.serviceMesh && this.plan.source === 'service' ? this.serviceMesh.clippedRegion : acceptedRegion(this.region, this.model.reach)
			const r = this.region
			return a && r && (a.xmin > r.xmin + 0.05 || a.xmax < r.xmax - 0.05 || a.ymin > r.ymin + 0.05 || a.ymax < r.ymax - 0.05) ? a : null
		},
		counts() {
			return countsOf(this.plan.points)
		},
		legendCounts() {
			return countsOf(this.shown)
		},
		seconds() {
			if (this.serviceMesh && this.serviceMesh.seconds !== null && this.plan.source === 'service') return this.serviceMesh.seconds
			return this.counts.measure ? estimateSeconds(this.plan.points) : null
		},
		cmp() {
			return compareGrids(this.grid, this.previous)
		},
		shown() {
			return this.view === 'result' && this.grid ? heatNodes(this.shownGrid) : this.plan.points
		},
		shownGrid() {
			return this.compare && this.cmp.ok ? this.cmp.diff : this.grid
		},
		scale() {
			return this.view === 'result' && this.shownGrid ? heatScale(this.shownGrid, this.compare && this.cmp.ok ? { center: 'zero', symmetric: true } : { center: this.opts.zero ? 'zero' : 'mean', symmetric: this.opts.symmetric }) : null
		},
		fills() {
			if (!this.scale) return null
			const out = {}
			this.shown.forEach(n => { if (n.z !== null && n.z !== undefined) out[n.id] = this.scale.colorOf(n.z) })
			return out
		},
		ringed() {
			const tol = Number(this.opts.tolerance)
			if (!this.scale || !(tol > 0)) return []
			return this.shown.filter(n => typeof n.z === 'number' && Math.abs(n.z - this.scale.stats.mean) > tol).map(n => n.id)
		},
		quality() {
			return this.view === 'result' && this.scale ? qualityView(this.scale.stats, this.thresholds) : null
		},
		legendIds() {
			return this.view === 'result' ? ['measured', 'missing'] : ['measure', 'outside_reach', 'clipped']
		},
		notes() {
			return this.model.missing.filter(m => m !== 'no_bed' && m !== 'no_m671')
		},
		// ---- chosen points: which nodes were chosen, where the chosen points ended up
		showChosen() {
			return this.view === 'plan' && !!this.okDerived
		},
		// what the legend explains besides the statuses: the chosen / derived nodes, and the marks BedSnapped draws (only when they are drawn)
		legendMarks() {
			const out = this.showChosen ? ['chosen', 'derived'] : []
			if (this.marks.some(m => !m.ignored)) out.push('snapped')
			if (this.marks.some(m => m.ignored)) out.push('ignored')
			return out
		},
		chosenIds() {
			return this.showChosen ? this.okDerived.nodes.filter(n => n.chosen.length).map(n => n.id) : null
		},
		// the pictures of the points the run does not measure as chosen: [{id, x, y, to, ignored}]
		marks() {
			if (this.view !== 'plan' || !this.derived) return []
			const d = this.derived
			const snapped = d.snapped.map(s => ({ id: s.id, x: s.x, y: s.y, to: d.nodes.find(n => n.id === s.node) || null, ignored: false }))
			return snapped.concat(d.ignored.map(g => ({ id: g.id, x: g.x, y: g.y, to: null, ignored: true })))
		},
		chosenAtSelected() {
			const n = this.showChosen ? this.okDerived.nodes.find(q => q.id === this.selected) : null
			return n ? n.chosen : []
		},
		// ---- the detail of the tapped point
		point() {
			return this.shown.find(p => p.id === this.selected) || null
		},
		pointTitle() {
			const p = this.point
			return !p ? '' : p.order > 0 ? this.t('bed.point_step_of', { n: p.order, total: this.counts.measure }) : this.t('bed.point_plain')
		},
		rows() {
			const p = this.point
			if (!p) return []
			const o = this.model.offset
			const rows = [{ label: 'X / Y', value: p.x.toFixed(1) + ' / ' + p.y.toFixed(1) }]
			if (o) rows.push({ label: this.t('bed.head_at'), value: (p.x - o.x).toFixed(1) + ' / ' + (p.y - o.y).toFixed(1) })
			if (this.showChosen) rows.push(...this.choiceRows())
			const d = this.view === 'result' ? nodeDetail(p, this.shownGrid, this.compare ? null : this.previous) : null
			if (!d || d.z === null) return rows
			if (this.compare && this.cmp.ok) rows.push({ label: this.t('bed.change'), value: d.z.toFixed(4) })
			else rows.push({ label: this.t('bed.height'), value: d.z.toFixed(4) }, { label: this.t('bed.from_mean'), value: d.fromMean.toFixed(4) })
			if (d.change !== null) rows.push({ label: this.t('bed.change'), value: d.change.toFixed(4) })
			return rows
		},
		// ---- does a job fit
		jobArea() {
			return jobRect(this.job)
		},
		fit() {
			const drawn = this.grid && this.grid.bounds ? this.grid : null
			return fitJob(this.job, { bed: this.model.bed, reach: this.model.reach, mesh: meshBox(drawn, this.region) })
		}
	},
	methods: {
		// who decided the tapped node: a chosen point (and where it was chosen when that is not the node), or a derived node that completes the grid
		choiceRows() {
			const mine = this.chosenAtSelected
			if (!mine.length) return [{ label: this.t('bed.row_choice'), value: this.t('bed.mark_derived') }]
			const snap = this.okDerived.snapped.find(s => mine.indexOf(s.id) >= 0)
			const rows = [{ label: this.t('bed.row_choice'), value: this.t('bed.mark_chosen') }]
			if (snap) rows.push({ label: this.t('bed.row_chosen_at'), value: snap.x.toFixed(1) + ' / ' + snap.y.toFixed(1) + ' (' + snap.distance.toFixed(1) + ' mm)' })
			return rows
		}
	}
}
