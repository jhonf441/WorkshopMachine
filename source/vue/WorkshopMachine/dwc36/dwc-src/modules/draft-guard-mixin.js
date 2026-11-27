'use strict'

// The "unsaved changes" guard of a module that holds a DRAFT (a table of values the person typed that goes to the machine through a plan review). The module says:
//   guardDirty()   true while the draft differs from what the machine has
//   guardSave()    "Save and leave": opens the plan review of the draft and answers 'later' (the review is the module's own confirmation), or false when it cannot
//   guardDiscard() throws the draft away
// The review is the module's `ps` (createPlanFlow state): closed without applying, the person stays on the page; the module calls guardApplied() once applied and reloaded.
// The logic and the dialog are vue/_shared36 (unsaved-guard.js, WfUnsavedDialog.vue, mounted once by Machine.vue).

import { registerGuard, resumeLeave, dropLeave } from '../unsaved-guard.js' // vue/_shared36

export const draftGuardMixin = {
	created() {
		this.$_guardOff = registerGuard({
			dirty: () => !!this.guardDirty(),
			save: () => this.guardSave(),
			discard: () => this.guardDiscard()
		})
	},
	beforeDestroy() {
		if (this.$_guardOff) this.$_guardOff()
		this.$_guardOff = null
	},
	methods: {
		// the plan was applied and the module read the machine again (its draft is the machine's now): the way out goes on
		guardApplied() {
			resumeLeave()
		}
	},
	watch: {
		'ps.status'(now) {
			if (now === 'idle' || now === 'error') dropLeave() // closed, or the plan could not be made: the person stays to see why
		}
	}
}
