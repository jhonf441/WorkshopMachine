<template>
	<v-btn v-if="exists" size="small" variant="outlined" :title="t('offsets.edit_in_workbench_tip')" @click="go()"><v-icon size="small" start>mdi-grid-large</v-icon>{{ t('offsets.edit_in_workbench') }}</v-btn>
</template>

<script setup>
// "Edit in the Workbench": the work offsets G54..G59.3 are the work zones of the Workbench (WorkshopWorkbench), so this page offers the
// way there instead of an editor (the Offsets module and the detail of an offsets.snapshot record). Rule of the family: a plugin that refers
// to another one shows nothing about it when the other one is not installed or not enabled (the button is hidden, not disabled).

import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { t } from '../text.js'
import { pluginActive } from '../workshop-ids.js' // vue/_shared
import { workbenchZonesRoute } from '../lib/cross-page.js'

const props = defineProps({
	zone: { type: String, default: '' } // the work system (G54..G59.3) the Workbench opens on; empty = the Zones tab only
})
const router = useRouter()
// the plugin lists, not the route: DWC keeps the route of a plugin that was stopped
const exists = computed(() => pluginActive('workbench'))

function go() {
	const p = router.push(workbenchZonesRoute(props.zone))
	if (p && typeof p.catch === 'function') p.catch(() => {})
}
</script>
