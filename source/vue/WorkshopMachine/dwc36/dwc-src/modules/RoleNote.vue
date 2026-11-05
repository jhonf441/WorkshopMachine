<template>
	<!-- N2 at the top of a module: the role the module needs, drawn only when the person lacks it ("Requires the Technician role. Your role: Operator."),
	     "Requires signing in." when nobody is signed in. No button: the page already has its sign-in chip (ESTANDAR 2.2). -->
	<session-notice v-if="kind" :kind="kind" :needed="min" />
</template>

<script>
'use strict'

import SessionNotice from '../SessionNotice.vue' // vue/_shared36
import { roleMixin } from '../role-mixin.js' // vue/_shared36
import { lockKind } from '../lock-reason.js' // vue/_shared36

export default {
	components: { SessionNotice },
	mixins: [roleMixin],
	props: {
		min: { type: String, required: true } // the role the module needs: 'operator' | 'technician' | 'admin'
	},
	computed: {
		kind() {
			void this.identityTick
			return lockKind(this.min)
		}
	}
}
</script>
