'use strict'

// What travels between the Workbench page (WorkshopWorkbench, /Plugins/Workbench) and this one, in both directions, as ROUTE QUERY
// parameters (review #12): no localStorage key and no window event is a contract between the two plugins. Pure.
//
//   Workbench -> Machine   ?layout=<tab>&x=..&y=..   the tab of this page the Workbench asked for (its tab names, TZ_PAGES.machine of
//                          src/_zones/30-zones-page.js; also `workarea` and `modes`, the sections its Cut area card and its modes
//                          gate link to) and, for Height, the Z point of the active zone the assistants measure at.
//   Printing -> Machine    ?layout=modes             the "Open in Machine" of the modes card of the 3D printing page.
//   Printing -> Machine    ?layout=motion&param=<id>  the Motion module with the parameter to change chosen (acceleration, speed or jerk): the screw
//                          motor card of the pellet setup sends the person here, because the acceleration, the jerk and the top speed of an extruder are
//                          changed through the plan of this page (preview, backup, history).
//   Printing -> Machine    ?layout=beds&beds=1,2,3    the Bed heaters assistant with those bed numbers to define: the Bed zones section of the 3D printing page sends the person here
//                          when the board lacks the beds its zones use (the heater lines go in through the plan of this page, never written by the other plugin).
//   Machine -> Workbench   {path: '/Plugins/Workbench', query: {layout: 'zones', zone: 'G54'}}   the work zones page (the work offsets G54..G59.3 are
//                          edited there; the Workbench reads route.query.layout, 22-page-nav.js queryLayout, and opens the editor of route.query.zone,
//                          also when the page was already open: 30-zones-page-map.js tzPagTimers).
//
// The question is answered ONCE: the page takes layout / x / y / param from the query (takeQuery), opens the module, hands the Z point to the Height
// module and the parameter to the Motion module and rewrites the URL without them, so a reload, or coming back to the page later, does not ask the same thing again.

export const WORKBENCH_PATH = '/Plugins/Workbench'
// the parameters of the Motion module other plugins ask for in ?param= (ids of lib/motion-table.js PARAMS; the test keeps them equal)
const MOTION_PARAMS = ['speed', 'acceleration', 'jerk']
// the names other plugins put in ?layout= -> the module of this page (the tabs of the Workbench's table for this page, and the two
// sections that the Workbench and the 3D printing page open directly)
const LAYOUT_SECTIONS = { calibrate: 'height', level: 'level', mesh: 'mesh', workarea: 'workarea', modes: 'modes', motion: 'motion', beds: 'beds' }

// the route of the Workbench's work zones (Zones tab), on the zone of a work system (G54..G59.3) when it is given
const WORK_SYSTEMS = ['G54', 'G55', 'G56', 'G57', 'G58', 'G59', 'G59.1', 'G59.2', 'G59.3']
export function workbenchZonesRoute(zone) {
	const query = { layout: 'zones' }
	if (WORK_SYSTEMS.indexOf(zone) >= 0) query.zone = zone
	return { path: WORKBENCH_PATH, query }
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

// the motion parameter the query asks for (the id of one of the parameters of the Motion module), or null
export function askedParam(query) {
	const p = one((query || {}).param)
	return typeof p === 'string' && MOTION_PARAMS.indexOf(p) >= 0 ? p : null
}

// the bed numbers the query asks to define (?beds=1,2,3: whole numbers 0..31, no repeats; how many the board holds is checked by the page against its limits), or null
export function askedBeds(query) {
	const raw = one((query || {}).beds)
	if (typeof raw !== 'string' && typeof raw !== 'number') return null
	const list = String(raw).split(',').map(s => s.trim()).filter(s => /^\d+$/.test(s)).map(Number).filter((n, i, a) => n <= 31 && a.indexOf(n) === i)
	return list.length ? list : null
}

// the module the query asks for: the Height module when a Z point travels, the Motion module when a parameter does, else the tab named in `layout`; null when it says nothing
export function querySection(query) {
	const q = query || {}
	if (askedPoint(q)) return 'height'
	if (askedParam(q)) return 'motion'
	if (askedBeds(q)) return 'beds'
	const l = one(q.layout)
	return typeof l === 'string' && Object.prototype.hasOwnProperty.call(LAYOUT_SECTIONS, l) ? LAYOUT_SECTIONS[l] : null
}

// The parameters this page consumes from the route query: the tab asked for, the Z point, the motion parameter and the bed numbers.
const CONSUMED = ['layout', 'x', 'y', 'param', 'beds']

// What the page takes from the query, ONCE: { section, point, param, rest } with the module asked for (or null), the Z point (or null), the motion
// parameter (or null) and `rest`, the query WITHOUT layout / x / y / param (any other parameter stays); null when the query carries none of them (nothing to answer, no URL to rewrite).
export function takeQuery(query) {
	const q = query || {}
	if (!CONSUMED.some(k => Object.prototype.hasOwnProperty.call(q, k))) return null
	const rest = {}
	Object.keys(q).forEach(k => { if (CONSUMED.indexOf(k) < 0) rest[k] = q[k] })
	return { section: querySection(q), point: askedPoint(q), param: askedParam(q), beds: askedBeds(q), rest }
}
