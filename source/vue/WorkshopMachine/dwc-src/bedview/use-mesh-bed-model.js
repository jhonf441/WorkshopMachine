'use strict'

// What the mesh bed derives from its props (a composable of MeshBed.vue: the component declares the props and the refs `ctx` = { view,
// compare, selected, opts, job }). The plan (region, points, statuses, time), the result (heat map, statistics, comparison), the detail
// of the tapped point, the chosen / derived / snapped marks and the job-fit verdict. Pure computations over the props: nothing here writes.

import { computed } from 'vue'
import { t } from '../text.js'
import { planPoints, mergeService, acceptedRegion, countsOf, estimateSeconds, presetRegion, MESH_MARGIN } from '../lib/bed-mesh-plan.js'
import { regionOfFields } from '../lib/bed-region.js'
import { heatNodes, heatScale, compareGrids, nodeDetail } from '../lib/bed-heat.js'
import { qualityView } from '../lib/mesh-grid.js'
import { fitJob, jobRect, meshBox } from '../lib/job-fit.js'

// the plan and the result on show: region, points, statistics, heat map, comparison
function useMeshBedPlan(props, ctx) {
	const { view, compare, opts } = ctx
	const pointsMode = computed(() => props.pe.mode === 'points')
	// the derived grid when it exists (a Points mode whose chosen points give a grid), else null
	const okDerived = computed(() => (props.derived && props.derived.ok ? props.derived : null))
	// there is an area to resize: the region (Region mode), or the grid the chosen points give (Points mode)
	const hasRegion = computed(() => !pointsMode.value || !!okDerived.value)
	// the handles and the size tools work now
	const resizable = computed(() => props.editable && view.value === 'plan' && hasRegion.value)
	const region = computed(() => {
		if (okDerived.value) return okDerived.value.region
		return props.inputs.mode === 'region' ? regionOfFields(props.inputs.region) : presetRegion('whole', props.model)
	})
	const plan = computed(() => {
		const n = props.form.params.points
		const margin = props.serviceMesh && props.serviceMesh.margin !== null ? props.serviceMesh.margin : MESH_MARGIN
		const local = planPoints(region.value, n[0], n[1], props.model.bed, props.model.reach, margin)
		return mergeService(local, props.serviceMesh && props.serviceMesh.points)
	})
	// the part of the region the run accepts, when it is smaller than what was drawn
	const accepted = computed(() => {
		const a = props.serviceMesh && plan.value.source === 'service' ? props.serviceMesh.clippedRegion : acceptedRegion(region.value, props.model.reach)
		const r = region.value
		return a && r && (a.xmin > r.xmin + 0.05 || a.xmax < r.xmax - 0.05 || a.ymin > r.ymin + 0.05 || a.ymax < r.ymax - 0.05) ? a : null
	})
	const counts = computed(() => countsOf(plan.value.points))
	const cmp = computed(() => compareGrids(props.grid, props.previous))
	const shownGrid = computed(() => (compare.value && cmp.value.ok ? cmp.value.diff : props.grid))
	const shown = computed(() => (view.value === 'result' && props.grid ? heatNodes(shownGrid.value) : plan.value.points))
	const legendCounts = computed(() => countsOf(shown.value))
	const seconds = computed(() => {
		if (props.serviceMesh && props.serviceMesh.seconds !== null && plan.value.source === 'service') return props.serviceMesh.seconds
		return counts.value.measure ? estimateSeconds(plan.value.points) : null
	})
	const scale = computed(() => {
		if (view.value !== 'result' || !shownGrid.value) return null
		return heatScale(shownGrid.value, compare.value && cmp.value.ok ? { center: 'zero', symmetric: true } : { center: opts.zero ? 'zero' : 'mean', symmetric: opts.symmetric })
	})
	const fills = computed(() => {
		if (!scale.value) return null
		const out = {}
		shown.value.forEach(n => { if (n.z !== null && n.z !== undefined) out[n.id] = scale.value.colorOf(n.z) })
		return out
	})
	const ringed = computed(() => {
		const tol = Number(opts.tolerance)
		if (!scale.value || !(tol > 0)) return []
		return shown.value.filter(n => typeof n.z === 'number' && Math.abs(n.z - scale.value.stats.mean) > tol).map(n => n.id)
	})
	const quality = computed(() => (view.value === 'result' && scale.value ? qualityView(scale.value.stats, props.thresholds) : null))
	const legendIds = computed(() => (view.value === 'result' ? ['measured', 'missing'] : ['measure', 'outside_reach', 'clipped']))
	const notes = computed(() => props.model.missing.filter(m => m !== 'no_bed' && m !== 'no_m671'))
	const showChosen = computed(() => view.value === 'plan' && !!okDerived.value)
	return {
		pointsMode, hasRegion, resizable, okDerived, region, plan, accepted, counts, legendCounts, seconds, cmp, shown, shownGrid, scale, fills, ringed,
		quality, legendIds, notes, showChosen
	}
}

// the chosen points, the tapped point and the job: what the side panels and the legend explain
function useMeshBedDetail(props, ctx, m) {
	const { view, compare, selected, job } = ctx
	const { okDerived, showChosen, shown, counts, region, cmp, shownGrid } = m
	// ---- chosen points: which nodes were chosen, where the chosen points ended up
	// the pictures of the points the run does not measure as chosen: [{id, x, y, to, ignored}]
	const marks = computed(() => {
		if (view.value !== 'plan' || !props.derived) return []
		const d = props.derived
		const snapped = d.snapped.map(s => ({ id: s.id, x: s.x, y: s.y, to: d.nodes.find(n => n.id === s.node) || null, ignored: false }))
		return snapped.concat(d.ignored.map(g => ({ id: g.id, x: g.x, y: g.y, to: null, ignored: true })))
	})
	// what the legend explains besides the statuses: the chosen / derived nodes, and the marks BedSnapped draws (only when they are drawn)
	const legendMarks = computed(() => {
		const out = showChosen.value ? ['chosen', 'derived'] : []
		if (marks.value.some(m => !m.ignored)) out.push('snapped')
		if (marks.value.some(m => m.ignored)) out.push('ignored')
		return out
	})
	const chosenIds = computed(() => (showChosen.value ? okDerived.value.nodes.filter(n => n.chosen.length).map(n => n.id) : null))
	const chosenAtSelected = computed(() => {
		const n = showChosen.value ? okDerived.value.nodes.find(q => q.id === selected.value) : null
		return n ? n.chosen : []
	})
	// ---- the detail of the tapped point
	const point = computed(() => shown.value.find(p => p.id === selected.value) || null)
	const pointTitle = computed(() => {
		const p = point.value
		return !p ? '' : p.order > 0 ? t('bed.point_step_of', { n: p.order, total: counts.value.measure }) : t('bed.point_plain')
	})
	// who decided the tapped node: a chosen point (and where it was chosen when that is not the node), or a derived node that completes the grid
	function choiceRows() {
		const mine = chosenAtSelected.value
		if (!mine.length) return [{ label: t('bed.row_choice'), value: t('bed.mark_derived') }]
		const snap = okDerived.value.snapped.find(s => mine.indexOf(s.id) >= 0)
		const out = [{ label: t('bed.row_choice'), value: t('bed.mark_chosen') }]
		if (snap) out.push({ label: t('bed.row_chosen_at'), value: snap.x.toFixed(1) + ' / ' + snap.y.toFixed(1) + ' (' + snap.distance.toFixed(1) + ' mm)' })
		return out
	}
	const rows = computed(() => {
		const p = point.value
		if (!p) return []
		const o = props.model.offset
		const out = [{ label: 'X / Y', value: p.x.toFixed(1) + ' / ' + p.y.toFixed(1) }]
		if (o) out.push({ label: t('bed.head_at'), value: (p.x - o.x).toFixed(1) + ' / ' + (p.y - o.y).toFixed(1) })
		if (showChosen.value) out.push(...choiceRows())
		const d = view.value === 'result' ? nodeDetail(p, shownGrid.value, compare.value ? null : props.previous) : null
		if (!d || d.z === null) return out
		if (compare.value && cmp.value.ok) out.push({ label: t('bed.change'), value: d.z.toFixed(4) })
		else out.push({ label: t('bed.height'), value: d.z.toFixed(4) }, { label: t('bed.from_mean'), value: d.fromMean.toFixed(4) })
		if (d.change !== null) out.push({ label: t('bed.change'), value: d.change.toFixed(4) })
		return out
	})
	// ---- does a job fit
	const jobArea = computed(() => jobRect(job))
	const fit = computed(() => {
		const drawn = props.grid && props.grid.bounds ? props.grid : null
		return fitJob(job, { bed: props.model.bed, reach: props.model.reach, mesh: meshBox(drawn, region.value) })
	})
	return { legendMarks, chosenIds, marks, chosenAtSelected, point, pointTitle, rows, jobArea, fit }
}

export function useMeshBedModel(props, ctx) {
	const plan = useMeshBedPlan(props, ctx)
	return Object.assign({}, plan, useMeshBedDetail(props, ctx, plan))
}
