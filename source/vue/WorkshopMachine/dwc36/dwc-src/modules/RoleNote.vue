<template>
	<!-- N2 at the top of a module: the role the module needs, drawn only when the person lacks it ("Requires the Technician role. Your role: Operator."),
	     "Requires signing in." when nobody is signed in. No button: the page already has its sign-in chip (ESTANDAR 2.2). -->
	<lock-reason v-if="ops.length" :ops="ops" :min="min" :subject="subject" />
	<session-notice v-else-if="kind" :kind="kind" :needed="min" :subject="subject" />
</template>

<script>
'use strict'

import SessionNotice from '../SessionNotice.vue' // vue/_shared36
import LockReason from '../LockReason.vue' // vue/_shared36
import { roleMixin } from '../role-mixin.js' // vue/_shared36
import { lockKind } from '../lock-reason.js' // vue/_shared36

export default {
	components: { SessionNotice, LockReason },
	mixins: [roleMixin],
	props: {
		min: { type: String, required: true }, // the role the module needs: 'operator' | 'technician' | 'admin' (the sentence until the service answers)
		subject: { type: String, default: '' }, // WHAT the note is about ("Bed mesh"): the sentence starts with it (DESIGN 7d)
		ops: { type: Array, default: () => [] } // the operations of the group: the sentence follows the answer of the service (profile, ceiling, condition) and falls back to the role
	},
	computed: {
		kind() {
			void this.identityTick
			return lockKind(this.min)
		}
	}
}
</script>
