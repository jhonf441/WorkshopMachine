'use strict'

// What travels between the Workbench page (WorkshopWorkbench, /Plugins/Workbench) and this one, in both directions, as ROUTE QUERY
// parameters (review #12): no localStorage key is a contract between the two plugins. Pure.
//
//   Workbench -> Machine   ?layout=<tab>&x=..&y=..   the tab of this page the Workbench asked for (its tab names, TZ_PAGES.machine of
//                          src/_zones/30-zones-page.js) and, for Height, the Z point of the active zone the assistants measure at.
//   Machine -> Workbench   {path: '/Plugins/Workbench', query: {layout: 'zones'}}   the work zones page (the work offsets G54..G59.3 are
//                          edited there; the Workbench reads route.query.layout, 22-page-nav.js queryLayout).

export const WORKBENCH_PATH = '/Plugins/Workbench'
// the tab names of the Workbench's table for this page -> the module of this page
const LAYOUT_SECTIONS = { calibrate: 'height', level: 'level', mesh: 'mesh' }

// the route of the Workbench's work zones (Zones tab)
export function workbenchZonesRoute() {
	return { path: WORKBENCH_PATH, query: { layout: 'zones' } }
}

function one(v) {
	return Array.isArray(v) ? v[0] : v
}

// {x, y} the Workbench left in the query (strings), or null
export function askedPoint(query) {
	const q = query || {}
	const x = Number(one(q.x))
	const y = Number(one(q.y))
	return one(q.x) !== undefined && one(q.x) !== null && one(q.x) !== '' && isFinite(x) && one(q.y) !== undefined && one(q.y) !== null && one(q.y) !== '' && isFinite(y) ? { x, y } : null
}

// the module the query asks for: the Height module when a Z point travels, else the tab named in `layout`; null when it says nothing
export function querySection(query) {
	const q = query || {}
	if (askedPoint(q)) return 'height'
	const l = one(q.layout)
	return typeof l === 'string' && Object.prototype.hasOwnProperty.call(LAYOUT_SECTIONS, l) ? LAYOUT_SECTIONS[l] : null
}
