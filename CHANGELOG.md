# WorkshopMachine -- historial de versiones

## 1.8.3 -- 2026-10-30

- Range picker: the button of the 3.6 line shows its range; the side bar group is called Probing

## 1.8.2 -- 2026-10-30

- Side bar in five categories; the job check says in words that no job is running; the history takes a time range like CloudWatch

## 1.8.1 -- 2026-10-30

- Manifest: sbcRequired true (needs WorkshopService); side bar keeps the group names

## 1.8.0 -- 2026-10-30

- Work area: choose the corners from the positions saved by the jog

## 1.7.0 -- 2026-10-30

- Work area: capture a corner with the tool taken there by the jog; wording for any tool

## 1.6.5 -- 2026-10-29

- Phone layout fixes (44 px touch targets, no overflow), Workbench full-screen section picker, clamps hint, interrupted jobs off the table, Machine scale label

## 1.6.4 -- 2026-10-29

- Audit and UX fixes: Jog owns workzeroaxis.g, restart notice with time, shared pulse table with update and download, side bar tooltips, spacing, wider field

## 1.6.3 -- 2026-10-29

- Audit fixes: Activity (3.6) event kinds and language, S0 in the G1 text of the calculators

## 1.6.2 -- 2026-10-29

- State chips with an icon: the icon carries the color and there is no dot (family.css); chosen chip tinted

## 1.6.1 -- 2026-10-29

- PID chart read from the service (any screen), Activity shows its active filters, health state without the duplicate icon

## 1.6.0 -- 2026-10-29

- Side bars: no gray line, a chosen item goes to the start of its section; Printing: start-up chip without the mode rows, tests notice only when the chip is not green, no-sensor fault reading; Vision: settings cards packed in columns, laser crosses only with Laser mode; Zones: visible mode dot

## 1.5.11 -- 2026-10-28

- Design family: final shared styles

## 1.5.10 -- 2026-10-28

- Design family: page bar with lead, own design css removed, section color as --wf-sec

## 1.5.9 -- 2026-10-28

- Minimalist design: neutral top bar with a solid badge, text menu with a section line, neutral section cards, outline buttons and chips, collapsible long notes

## 1.5.8 -- 2026-10-28

- Work area: the map is the shared bed view and FFF is a tab

## 1.5.7 -- 2026-10-28

- Work area module (machine.workarea.*): measure, edit, walk the area

## 1.5.6 -- 2026-10-28

- Safety check details and run phases in words

## 1.5.5 -- 2026-10-27

- Mesh points under a handle: tap chooses, drag resizes

## 1.5.4 -- 2026-10-27

- Plan warnings in words, risk dialogs in DWC style, mesh point selection, link to Machine modes

## 1.5.3 -- 2026-10-27

- Side bar no longer makes the page jump when a shorter section is chosen; start-up chip as in every page (header, same wording)

## 1.5.2 -- 2026-10-26

- Run-time guard: the 3.6 build refuses to start on a host with window.DWC and the 3.7 build outside DWC 3.7.x (visible warning); shipped as a strict per-line zip (dwcVersion 3.6 / 3.7)

## 1.5.1 -- 2026-10-26

- Manifest: sbcDsfVersion "3" next to sbcRequired true. DWC 3.6 install wizard kept the Next button disabled on the prerequisites step without it (found installing from Settings > Plugins).

## 1.5.0 -- 2026-10-26

- Machine modes section: switch on the modes the machine uses (FFF / Laser / CNC) and set each one up with the guide

## 1.4.9 -- 2026-10-26

- No 'Loading...' under the error banner of the Calibrations card

## 1.4.8 -- 2026-10-24

- Start-up assistant: active lines highlighted, single-step way back, dark select options; Lights time picker and defaults; Printing FFF switch; Mesh handles above the points

## 1.4.7 -- 2026-10-23

- Follow a sign-in or logout made in another tab

## 1.4.6 -- 2026-10-23

- One sign-in for every tab (token in localStorage)

## 1.4.5 -- 2026-10-23

- Header: no health chip while signed out

## 1.4.4 -- 2026-10-23

- Compact live job strip in the bar; page header treats an expired session as sign in; numeric PIN field

## 1.4.3 -- 2026-10-23

- Page header asks who is signed in so a missing session is shown as such

## 1.4.2 -- 2026-10-23

- Common page header: health chip, session chip, quiet start-up icon when ready

## 1.4.1 -- 2026-10-23

- Side bar sections no longer overflow the page on narrow screens (under 900 px)

## 1.4.0 -- 2026-10-22

- Height page (calibration moved from the Workbench), mesh legend for the snapped / ignored marks, mesh area resizable

## 1.3.0 -- 2026-10-22

- Mesh area resizable from the editor (fields, handles in every mode); side-bar pin only while open

## 1.2.9 -- 2026-10-22

- Pin on every side bar, thin scrollbars, one sign-in dialog

## 1.2.8 -- 2026-10-22

- Sign-in never opens by itself; keyboard only on touch

## 1.2.7 -- 2026-10-22

- Fix names, values and catalog markers the English rename left behind

## 1.2.6 -- 2026-10-22

- Sessions made clear: not-signed-in chip, sign-in on visitor 403, refusal toast

## 1.2.5 -- 2026-10-22

- Sign-in dialog focus and kiosk keyboard helper; Jog blocked touches explained

## 1.2.4 -- 2026-10-22

- Kiosk keyboard helper call, sign-in dialog font

## 1.2.3 -- 2026-10-22

- Jog and bars tell why an action is blocked and ask for the session; Jog loses the Machine pointer sections

## 1.2.2 -- 2026-10-22

- Sign-in dialog redesign and on-screen keyboard; single floating panel for power actions; risk bar on one line; Jog gear and scrollbar; side tabs transition

## 1.2.1 -- 2026-10-22

- Bed view: margin holds the Z motors outside the bed; Probe, Level and Mesh draw the bed at the same size

## 1.2.0 -- 2026-10-22

- Bed view, Plan / Result: the small toggle is replaced by two wide tabs above the bed, each with an icon, a title and one line of what it means ("Plan: what I am going to measure", "Result: what the last run measured"). The Result tab is disabled with the reason written in it when there is no mesh. It opens on Result when a mesh exists and the person cannot run, otherwise on Plan. A short first-time hint explains them and stays dismissed in this browser.
- Mesh, choose points: a visible switch Region / Points. In Points, tap an empty spot to add a point, tap a point and Remove (or Delete), drag it or use the arrows to move it; undo, redo, clear, a counter "Chosen points: N" and "Add a point by its position". The machine measures only a regular grid, so the chosen points are constraints and the page derives the smallest regular grid that holds them (nx, ny, spacing; every point within 0.5 mm of a node). When that needs too many nodes or the distances do not line up, the best grid is used and each moved point is shown with its distance, the plain reason and a button to take the node. Chosen nodes have a ring, derived nodes are plain; the side panel says how many nodes the run measures, how many you did not choose, and the estimated time. The run is still started with the region and nx, ny the service takes today.
- Level: the same controls as Mesh Points (undo, redo, counter, add by position, tap an empty spot to add, arrows, Delete), the leadscrew links stay. The "Add points" toggle is gone.
- Named point sets ("corners", "centre and edges"), shared by Mesh and Level and kept per machine in the new service settings store `machine-pointsets` (technician and above save, operator loads). Shown with the reason when the service does not have the store yet (needs the newer WorkshopService).
- New card "Check a job area" under the Mesh bed: type or drag X, Y, width and height; it says whether the job fits the head limits, the probe reach and the mesh coverage, with the side and the mm that go out, and draws the rectangle on the bed. Geometry only; nothing is sent.
- A gesture the browser cancels (a scroll on a touch screen) no longer counts as a tap on the bed.
- `actions` slot in the point detail: the named, empty extension point for acting on a point. Nothing moves the machine, probes or fires the laser from the bed view.
- Tests: `test/point-grid.test.js`, `test/point-tools.test.js`, `test/bed-points-render.test.js`. Not run in a browser or on the machine.

## 1.1.2 -- 2026-10-22

- Mesh region: bigger / smaller buttons (10 mm per side)

## 1.1.1 -- 2026-10-22

- Bed view: the side panel no longer blinks (the layout was asked again on every model update)

## 1.1.0 -- 2026-10-22

- Bed view: Mesh, Level and Probe get the bed back at its real size, as one shared pure-SVG component set (`dwc-src/bedview/`): mm grid, axis arrows, origin, scale bar, axis limits, probe reach, head-to-probe offset vector; light and dark theme; every status with a glyph AND a word; big touch targets; tap a point for its detail; keyboard handles.
- Mesh: drag or type the region (the form fields and the drawing are the same numbers), presets (whole reachable bed, centre, around the last job when the machine reports it), every point with its status and reason (outside the bed / head would leave its limits / inside the safety margin), travel order with step numbers, point count and a labelled time estimate; after a run the heat map on the same points with legend, min / max / mean / range, tolerance rings, comparison with the previous mesh.
- Level: the leadscrews where M671 puts them (Z motor index), measurement points (suggested, draggable inside the reach, add / remove), order, nearest leadscrew, the verdict with the reason, raise / lower per leadscrew after a pass and a card per pass. Edited points are a preview (a run still uses the points the service resolves).
- New `api/machine-api-p6.js` (`machine.layout`, WorkshopService docs/MACHINE-LAYOUT-CONTRACT.md): the only place that knows the op and the shape. Local geometry draws first; the service answer for the same draft wins. Without `machine.layout` the pages draw what DWC reports and say what is missing.
- Tests: pure geometry (`test/bed-view.test.js`) and a render test of the components without a DOM (`test/bed-render.test.js`, needs the DWC clone). Not run in a browser or on the machine.

## 1.0.3 -- 2026-10-21

- PIN sign enters by itself when the PIN has the length that worked last time

## 1.0.2 -- 2026-10-21

- History: date filters like Activity (calendar menu)

## 1.0.1 -- 2026-10-21

- Side bar: pin next to the fold arrow keeps the bar open

## 1.0.0 -- 2026-10-21

- Machine v2 phase 1, plugin side: Overview, Probe, Level, Mesh. 
- Machine v2 phase 2, plugin side: History (filters, compare, restore through a reviewed plan), printable Report (inline SVG, print stylesheet), Safety check, Offsets (tools, G54-G59.3, snapshots, laser <-> pointer), Limits (M208, endstop verification). Roles follow the server (workshopCan).
- Machine v2 phase 3, plugin side: Calibration assistants (steps per mm, squareness, backlash: formula preview, machine.calc, plan), Motion parameters (table of axes and extruders, edit of one parameter through a plan for the administrator, "try now" with auto-revert countdown that survives a reload), Input shaping (state, M593 plan, accelerometer data collection only when the board reports one, ringing test G-code shown and copied, never sent). Roles follow the server (workshopCan).
- Machine v2 phase 4, plugin side: Maintenance (counters per axis labelled as estimated, plan with ok / due soon / due / overdue markers, "done" with who and when, last-done history, plan editing and opt-in phone notice for a technician, maintenance light on the Overview), camera verification of the offsets inside Offsets (enabled only when the service reports vision.measure, otherwise a plain note that the check is manual; table of the error in mm per system / tool). Roles follow the server (workshopCan).
- Machine v2 phase 5, plugin side: "Import from Machine 0.3.0" card on the Overview for an administrator (`machine.import.status` / `machine.import.run`; shows the imported counts per kind and the skipped files with the reason). The answer shapes are ASSUMED until the service contract of phase 5 is read. Jog's Limits, Coordinates and Probing sections now point to this page.
