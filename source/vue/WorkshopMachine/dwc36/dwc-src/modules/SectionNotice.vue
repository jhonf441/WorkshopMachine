<template>
	<!-- one notice per cause (DESIGN.md 7d): when the page band already says the service is down, the section only says it has no data (no button) -->
	<div v-if="quiet" class="text-caption machine-faint mb-2 section-no-data" role="status">{{ $t('plugins.WorkshopMachine.page.no_service_data') }}</div>
	<error-notice v-else :error="error" :action="action" :retry="retry" @retry="$emit('retry')" />
</template>

<script>
'use strict'

// The error notice of a section (the same props as <error-notice>). The page (Machine.vue) provides `machinePage`; while its own band says the
// service is not there ('unavailable'), a section whose call failed for the same cause does not repeat the band nor its Retry.
import ErrorNotice from '../ErrorNotice.vue' // vue/_shared
import { errorKind } from '../friendly-error.js' // vue/_shared

export default {
	components: { ErrorNotice },
	inject: { machinePage: { default: null } },
	props: {
		error: { type: [Error, Object, String], default: null },
		action: { type: String, default: '' },
		retry: { type: Boolean, default: false }
	},
	computed: {
		quiet() {
			return !!this.error && errorKind(this.error) === 'unavailable' && !!this.machinePage && this.machinePage.serviceDown
		}
	}
}
</script>
