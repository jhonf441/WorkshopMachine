# WorkshopMachine v2 (Vue) -- development source, NOT buildable yet

Phases 1 to 5 (plugin side) of `docs-internal/MACHINE-V2-DESIGN.md`: Overview, Probe, Level, Mesh (1); Offsets, Limits, Safety check, History and Report (2); Calibration, Motion, Input shaping (3); Maintenance and camera verification (4); import of the Machine 0.3.0 data (5).
The phase 2 operations are known only to `dwc-src/api/machine-api-p2.js` (the ASSUMED ones are marked there). The service side (`machine.*`) lives in
WorkshopService (`dsf/machine_ops.py`, `machine_procedures.py`).

## Why there is no `plugin.json`

Release source (1.0.0): the manifest is `plugin.json`. `build.py` finds plugins by `plugin.json` in `src/<Id>/` and `vue/<Id>/` and `is_vue(Id)` wins over `src/<Id>`, so
`build.py WorkshopMachine` builds THIS folder; `src/WorkshopMachine` (0.3.x) stays only until the deletion release (see the design doc, release day checklist).

## Phase 5 (switch-over)

Done in the plugin: the "Import from Machine 0.3.0" card (Overview, administrator; ops only in `dwc-src/api/machine-api-p5.js`, shapes ASSUMED until the service contract is read) and the Jog pointers (Limits, Coordinates, Probing).
The rest waits for release day: the exact ordered checklist (rename, `_includes.txt`, the tests that read `src/WorkshopMachine`, trace fixtures, deletion one release later) is in
`docs-internal/MACHINE-V2-DESIGN.md`, section 7, "Release day checklist". The rename (step 2) is done.

## Bed view (Mesh, Level, Probe)

Shared pure-SVG component set in `dwc-src/bedview/` (BedSvg draws the bed at true proportions; MeshBed, LevelBed and ProbeBed compose it), geometry in `dwc-src/lib/bed-*.js`, explicit state in `dwc-src/state/bed-state.js`, `level-points-state.js` and `region-drag.js`. The data is the service operation `machine.layout`, known only to `dwc-src/api/machine-api-p6.js` (contract in WorkshopService `docs/MACHINE-LAYOUT-CONTRACT.md`). Interaction rules: `docs-internal/MACHINE-V2-DESIGN.md`, section 3.3b.

Editing (m7): Plan / Result are two wide tabs (`PlanTabs.vue`); the Plan has a Region / Points mode switch (`PointModeBar.vue`, shared with Level). The points a person chooses are constraints for a REGULAR grid: `lib/point-grid.js` derives region, nx, ny and the snapped points (the run still gets `x0 x1 y0 y1 nx ny`), `state/point-edit-state.js` keeps the points with undo / redo, `lib/point-sets.js` + `api/machine-api-p7.js` the named sets (settings store `machine-pointsets`, WorkshopService `docs/MACHINE-POINTSETS-CONTRACT.md`), `lib/job-fit.js` + `JobFitCard.vue` the "Check a job area" card. `MeshBed.vue` is thin: its logic is the mixins `mesh-bed-model.js`, `mesh-bed-points.js` and `mesh-bed-pointer.js`. Nothing on the bed view moves the machine, probes or fires the laser; the slot `actions` of `PointDetail.vue` is the empty extension point for that. Tests: `test/point-grid.test.js`, `test/point-tools.test.js`, `test/bed-points-render.test.js`. `test/bed-render.test.js` renders the components without a DOM using the vue and vue-template-compiler of the DWC clone (skipped without it).
