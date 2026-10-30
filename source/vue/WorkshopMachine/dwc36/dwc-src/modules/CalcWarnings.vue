<template>
	<div class="calc-warnings">
		<v-alert v-for="w in rows" :key="w.code" dense outlined :type="w.note ? 'info' : 'warning'" class="mt-2 mb-0">{{ t(w.textKey) }}</v-alert>
	</div>
</template>

<script>
'use strict'

// The warnings machine.calc answered (codes): a warning for what needs a second look, an info note for what is always true.

import { textMixin } from './text-mixin.js'

export default {
	mixins: [textMixin],
	props: {
		rows: { type: Array, default: () => [] } // lib/calc-warnings.js warningRows
	}
}
</script>
