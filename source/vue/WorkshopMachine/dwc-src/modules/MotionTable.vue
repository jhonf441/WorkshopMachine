<template>
	<v-table density="compact" class="motion-table">
		<thead>
			<tr>
				<th class="text-left">{{ t('motion.col_axis') }}</th>
				<th class="text-left">{{ t('motion.col_driver') }}</th>
				<th v-for="c in COLUMNS" :key="c.id" class="text-right" :class="{ 'font-weight-bold': c.id === highlight }">{{ t('motion.param_' + c.id) }}</th>
			</tr>
		</thead>
		<tbody>
			<tr v-for="r in rows" :key="r.key">
				<td>{{ r.letter }}<v-chip v-if="r.multiMotor" size="x-small" variant="outlined" class="ml-1">{{ t('motion.multi_motor') }}</v-chip></td>
				<td>{{ r.driver || '-' }}</td>
				<td v-for="c in COLUMNS" :key="c.id" class="text-right" :class="{ 'font-weight-bold': c.id === highlight }">
					{{ cell(r, c.field) }}<span v-if="c.id === 'microstepping' && r.interpolated" :title="t('motion.interpolated')"> *</span><span v-if="c.id === 'mode' && r.modeSource === 'default'" :title="t('motion.mode_default')"> *</span>
				</td>
			</tr>
		</tbody>
	</v-table>
</template>

<script setup>
// The read-only table of the motion parameters: one row per axis / extruder, one column per parameter. What the board does not report
// shows '-'. No state of its own.

import { t } from '../text.js'
import { COLUMNS, cell } from '../lib/motion-table.js'

defineProps({
	rows: { type: Array, required: true }, // lib/motion-table.js tableRows
	highlight: { type: String, default: '' } // id of the parameter being edited
})
</script>
