<template>
	<article class="report-print">
		<header class="report-head">
			<h1 class="report-title">{{ t(report.titleKey) }}</h1>
			<table class="report-meta">
				<tbody>
					<tr><th>{{ t('report.machine') }}</th><td>{{ report.header.name || '-' }}</td><th>{{ t('report.date') }}</th><td>{{ report.header.dateText }}</td></tr>
					<tr><th>{{ t('report.board') }}</th><td>{{ report.header.board || '-' }}</td><th>{{ t('report.firmware') }}</th><td>{{ report.header.firmware || '-' }}</td></tr>
					<tr><th>{{ t('report.kinematics') }}</th><td>{{ report.header.kinematics || '-' }}</td><th>{{ t('report.person') }}</th><td>{{ report.header.person || '-' }}</td></tr>
				</tbody>
			</table>
		</header>
		<p v-if="!report.sections.length" class="report-note">{{ t('report.no_records') }}</p>
		<section v-for="s in report.sections" :key="s.id" class="report-section">
			<h2>{{ s.titleKey ? t(s.titleKey) : s.kind }}</h2>
			<p class="report-note">{{ s.dateText }} - {{ s.user || '-' }}<span v-if="s.role"> ({{ s.role }})</span> - {{ t(s.state.textKey) }}</p>
			<p v-if="s.verdictKey" class="report-verdict">{{ t(s.verdictKey) }}</p>
			<table v-if="s.figures.length" class="report-table">
				<tbody>
					<tr v-for="f in s.figures" :key="f.labelKey"><th>{{ t(f.labelKey) }}</th><td>{{ f.text }}</td></tr>
				</tbody>
			</table>
			<table v-if="s.passes && s.passes.length" class="report-table">
				<thead>
					<tr><th>{{ t('level.col_pass') }}</th><th>{{ t('level.col_before') }}</th><th>{{ t('level.col_after') }}</th></tr>
				</thead>
				<tbody>
					<tr v-for="p in s.passes" :key="p.n"><td>{{ p.n }}</td><td>{{ p.before }}</td><td>{{ p.after }}</td></tr>
				</tbody>
			</table>
			<figure v-for="d in s.drawings" :key="d.captionKey" class="report-figure">
				<div v-html="d.svg" />
				<figcaption>{{ t(d.captionKey) }}</figcaption>
			</figure>
			<template v-for="tb in s.tables">
				<p :key="tb.id + 'h'" class="report-note">{{ t(tb.titleKey) }}</p>
				<table :key="tb.id" class="report-table">
					<tbody>
						<tr v-for="r in tb.rows" :key="r.key"><th class="report-path">{{ r.key }}</th><td>{{ r.text }}</td></tr>
					</tbody>
				</table>
			</template>
			<p v-if="s.applied.length" class="report-note">{{ t('history.applied_files') }}: {{ s.applied.join(', ') }}</p>
			<p v-if="s.notes" class="report-note">{{ s.notes }}</p>
		</section>
		<section v-if="report.limits.length" class="report-section">
			<h2>{{ t('report.limits_title') }}</h2>
			<table class="report-table">
				<thead><tr><th>{{ t('limits.col_axis') }}</th><th>{{ t('limits.col_min') }}</th><th>{{ t('limits.col_max') }}</th><th>{{ t('limits.col_travel') }}</th></tr></thead>
				<tbody>
					<tr v-for="l in report.limits" :key="l.axis"><td>{{ l.axis }}</td><td>{{ l.min }}</td><td>{{ l.max }}</td><td>{{ l.travel }}</td></tr>
				</tbody>
			</table>
		</section>
		<section v-if="report.offsets.length" class="report-section">
			<h2>{{ t('report.offsets_title') }}</h2>
			<template v-for="o in report.offsets">
				<p :key="o.titleKey + 'h'" class="report-note">{{ t(o.titleKey) }}</p>
				<table :key="o.titleKey" class="report-table">
					<thead><tr><th /><th v-for="a in o.axes" :key="a">{{ a }}</th></tr></thead>
					<tbody>
						<tr v-for="r in o.rows" :key="r.label"><th>{{ r.label }}</th><td v-for="(c, i) in r.cells" :key="i">{{ c }}</td></tr>
					</tbody>
				</table>
			</template>
		</section>
		<section v-if="report.compensation" class="report-section">
			<h2>{{ t('report.compensation_title') }}</h2>
			<table class="report-table">
				<tbody>
					<tr><th>{{ t('report.compensation_type') }}</th><td>{{ report.compensation.type }}</td></tr>
					<tr><th>{{ t('report.compensation_file') }}</th><td>{{ report.compensation.file }}</td></tr>
					<tr><th>{{ t('report.compensation_fade') }}</th><td>{{ report.compensation.fade }}</td></tr>
				</tbody>
			</table>
		</section>
		<section v-if="report.hasCheck" class="report-section">
			<h2>{{ t('report.check_title') }}</h2>
			<table class="report-table">
				<tbody>
					<tr v-for="c in report.checkRows" :key="c.id">
						<th>{{ c.known ? t(c.textKey) : c.name }}</th>
						<td>{{ t(c.severityKey) }}<span v-if="c.detail"> - {{ detailOf(c) }}</span><span v-if="c.actionKey"> - {{ t(c.actionKey) }}</span></td>
					</tr>
				</tbody>
			</table>
		</section>
		<footer v-if="report.signature" class="report-sign">
			<div class="report-sign-line"><span>{{ t('report.signature') }}: {{ report.header.person }}</span></div>
			<div class="report-sign-line"><span>{{ t('report.signature_date') }}: {{ report.signedDateText }}</span></div>
		</footer>
	</article>
</template>

<script>
'use strict'

// The printable page: a plain white "paper" with the sections of lib/report-model.js. Printing is the browser's (window.print: print or
// save as PDF); while this component is mounted the body carries `machine-printing`, and the @media print rules show only the report.

import { textMixin } from './text-mixin.js'
import { detailText } from '../lib/safety.js'

export default {
	mixins: [textMixin],
	props: { report: { type: Object, required: true } }, // buildReport(...)
	methods: {
		detailOf(c) {
			return detailText(c.parts, (key, params) => this.t(key, params))
		}
	},
	mounted() {
		document.body.classList.add('machine-printing')
	},
	beforeDestroy() {
		document.body.classList.remove('machine-printing')
	}
}
</script>

<style>
.report-print { background: #ffffff; color: #111111; padding: 20px; max-width: 800px; margin: 0 auto; font-family: sans-serif; font-size: 13px; }
.report-print h1 { font-size: 20px; margin: 0 0 8px; }
.report-print h2 { font-size: 16px; margin: 0 0 4px; border-bottom: 1px solid #999999; }
.report-section { margin-top: 18px; break-inside: avoid; }
.report-meta, .report-table { border-collapse: collapse; width: 100%; margin: 6px 0; }
.report-meta th, .report-meta td, .report-table th, .report-table td { border: 1px solid #bbbbbb; padding: 3px 6px; text-align: left; font-weight: normal; }
.report-meta th, .report-table th { background: #f0f0f0; font-weight: 600; }
.report-path { font-family: monospace; font-size: 11px; }
.report-note { color: #555555; margin: 2px 0; }
.report-verdict { font-weight: 600; margin: 4px 0; }
.report-figure { margin: 8px 0; max-width: 520px; }
.report-figure figcaption { font-size: 11px; color: #555555; }
.report-sign { display: flex; gap: 40px; margin-top: 48px; }
.report-sign-line { flex: 1; border-top: 1px solid #111111; padding-top: 4px; font-size: 12px; }
@media print {
	body.machine-printing * { visibility: hidden; }
	body.machine-printing .report-print, body.machine-printing .report-print * { visibility: visible; }
	body.machine-printing .report-print { position: absolute; left: 0; top: 0; width: 100%; max-width: none; padding: 0; }
}
</style>
