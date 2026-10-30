<template>
	<div class="mesh-region-fields">
		<div class="d-flex align-center flex-wrap" style="gap:8px">
			<span class="text-caption machine-faint">{{ t('bed.fields_title') }}</span>
			<v-text-field
				v-for="f in fields" :key="f" :value="draft[f]" :label="t('bed.field_' + f)" suffix="mm" type="number" step="1" dense outlined hide-details
				:disabled="disabled" style="max-width:128px" :data-field="f" @input="draft[f] = $event" @change="commit(f)" @keydown.enter="commit(f)"
			/>
		</div>
		<div v-if="reason" class="text-caption warning--text mt-1">{{ reason }}</div>
		<div v-else-if="reach" class="text-caption machine-faint mt-1">{{ reach }}</div>
	</div>
</template>

<script>
'use strict'

// Four numbers that say where the mesh area is (X min / X max / Y min / Y max), the same numbers the handles on the bed change. A typed
// number is kept inside the travel and at least MIN_SIZE wide, and the page SAYS when it had to change it (never silently); a region that
// goes beyond what the probe reaches is allowed but said: the run measures only up to the reach. 44 px tall for touch.

import { textMixin } from '../modules/text-mixin.js'
import { REGION_FIELDS, editField, reachNote } from '../lib/mesh-resize.js'

const show = v => String(Math.round(v * 10) / 10)

export default {
	mixins: [textMixin],
	props: {
		region: { type: Object, default: null }, // {xmin..ymax} in mm
		bed: { type: Object, default: null }, // the travel
		area: { type: Object, default: null }, // what a run accepts (reach minus margin)
		disabled: { type: Boolean, default: false }
	},
	data() {
		return { fields: REGION_FIELDS, draft: { xmin: '', xmax: '', ymin: '', ymax: '' }, why: '' }
	},
	computed: {
		reason() {
			return this.why ? this.t('bed.resize_' + this.why) : ''
		},
		reach() {
			return reachNote(this.region, this.area) ? this.t('bed.resize_beyond_reach') : ''
		}
	},
	watch: {
		region: { immediate: true, handler(r) { this.sync(r) } }
	},
	methods: {
		sync(r) {
			REGION_FIELDS.forEach(f => { this.draft[f] = r ? show(r[f]) : '' })
		},
		commit(field) {
			if (!this.region) return
			const out = editField(this.region, field, this.draft[field], this.bed)
			this.why = out.reason
			if (out.ok) this.$emit('region', out.region)
			this.sync(out.ok ? out.region : this.region) // what was typed is replaced by what was kept
		}
	}
}
</script>
