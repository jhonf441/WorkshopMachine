'use strict'

// Probe module logic (design 2.2): parameters of the repeatability run and the result card with its traffic light. Pure.
//
// Result of the run (probe.repeat; the phase 0 probe.read has the same shape): {probe, parameters?, samples: [z...], stats?: {n, min, max, range, mean, stdev}}.
// If stats is missing it is computed here from the samples.

// thresholds of the verdict in mm (design 2.2: sigma <= 0.02 warns, > 0.05 is bad; "tunable, a guess": the profile can override them
// with thresholds.probe_sigma_warn / probe_sigma_bad)
export const DEFAULT_THRESHOLDS = { sigmaWarn: 0.02, sigmaBad: 0.05 }
export const SAMPLES = { min: 2, max: 100, default: 10 }
export const PROBE_INDEX_MAX = 15

export function thresholdsOf(profile) {
	const p = profile || {}
	const warn = typeof p.probe_sigma_warn === 'number' && p.probe_sigma_warn > 0 ? p.probe_sigma_warn : DEFAULT_THRESHOLDS.sigmaWarn
	const bad = typeof p.probe_sigma_bad === 'number' && p.probe_sigma_bad > warn ? p.probe_sigma_bad : Math.max(DEFAULT_THRESHOLDS.sigmaBad, warn * 2)
	return { sigmaWarn: warn, sigmaBad: bad }
}

function wholeIn(v, lo, hi) {
	const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v
	return typeof n === 'number' && isFinite(n) && Math.floor(n) === n && n >= lo && n <= hi ? n : null
}

// the inputs of the form -> {params, errors}; errors maps a field to a text key (probe.err_<field>)
export function repeatParams(inputs) {
	const i = inputs || {}
	const probe = wholeIn(i.probe === undefined || i.probe === '' ? 0 : i.probe, 0, PROBE_INDEX_MAX)
	const samples = wholeIn(i.samples === undefined || i.samples === '' ? SAMPLES.default : i.samples, SAMPLES.min, SAMPLES.max)
	const errors = {}
	if (probe === null) errors.probe = 'probe.err_probe'
	if (samples === null) errors.samples = 'probe.err_samples'
	return { params: { probe: probe === null ? 0 : probe, samples: samples === null ? SAMPLES.default : samples }, errors, ok: !Object.keys(errors).length }
}

export function statsOf(values) {
	const n = values.length
	if (!n) return null
	const mean = values.reduce((a, b) => a + b, 0) / n
	const stdev = n > 1 ? Math.sqrt(values.reduce((a, v) => a + (v - mean) * (v - mean), 0) / (n - 1)) : 0
	const min = Math.min.apply(null, values)
	const max = Math.max.apply(null, values)
	return { n, min, max, range: max - min, mean, stdev }
}

// drift = mean of the second half minus mean of the first half (a probe that warms up or a bed that settles shows it)
export function driftOf(values) {
	if (values.length < 4) return null
	const half = Math.floor(values.length / 2)
	const mean = a => a.reduce((x, y) => x + y, 0) / a.length
	return mean(values.slice(values.length - half)) - mean(values.slice(0, half))
}

export function verdictOf(stdev, th) {
	if (typeof stdev !== 'number' || !isFinite(stdev)) return 'unknown'
	if (stdev > th.sigmaBad) return 'bad'
	return stdev > th.sigmaWarn ? 'warn' : 'good'
}

const VERDICT_VIEW = {
	good: { color: 'success', icon: 'mdi-check-circle' },
	warn: { color: 'warning', icon: 'mdi-alert' },
	bad: { color: 'error', icon: 'mdi-close-octagon' },
	unknown: { color: 'grey', icon: 'mdi-help-circle-outline' }
}

// the result card: null while there is no usable result
export function resultView(result, th) {
	if (!result) return null
	const samples = Array.isArray(result.samples) ? result.samples.filter(v => typeof v === 'number' && isFinite(v)) : []
	const stats = result.stats && typeof result.stats.stdev === 'number' ? result.stats : statsOf(samples)
	if (!stats) return null
	const verdict = verdictOf(stats.stdev, th)
	return Object.assign({ stats, samples, drift: driftOf(samples), probe: result.probe, verdict, verdictKey: 'probe.verdict_' + verdict, th }, VERDICT_VIEW[verdict])
}

// points of the little chart of the samples: [{x, y, z}] inside w x h, the mean as a line (y of the mean in `meanY`)
export function samplePoints(samples, w, h, pad) {
	const p = pad === undefined ? 4 : pad
	if (!samples.length) return { points: [], meanY: null }
	const lo = Math.min.apply(null, samples)
	const hi = Math.max.apply(null, samples)
	const span = hi - lo || 1
	const y = v => p + (h - 2 * p) * (1 - (v - lo) / span)
	const xs = i => (samples.length === 1 ? w / 2 : p + (w - 2 * p) * (i / (samples.length - 1)))
	const mean = samples.reduce((a, b) => a + b, 0) / samples.length
	return { points: samples.map((z, i) => ({ x: xs(i), y: y(z), z })), meanY: y(mean) }
}
