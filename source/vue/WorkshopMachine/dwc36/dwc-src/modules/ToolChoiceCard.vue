<template>
	<v-card outlined :hover="clickable" class="toolwiz-card" :class="{ 'toolwiz-card--click': clickable, 'toolwiz-card--on': selected }" :color="selected ? 'primary' : undefined" :dark="selected" :style="accent ? { borderLeft: '4px solid ' + accent } : undefined" @click="clickable && $emit('pick')">
		<slot />
	</v-card>
</template>

<script>
'use strict'

// The ONE card of the "New tool" assistant: every group of cards (type choice, free numbers, what the tool carries, tests) puts these inside a
// `.toolwiz-cards` grid, so equal columns, equal row heights, same padding and touch height (>= 44 px) in all of them. Long texts wrap or clamp
// (`.toolwiz-clamp-1`, `.toolwiz-clamp-2`) and never change the size.
export default {
	props: { selected: { type: Boolean, default: false }, accent: { type: String, default: '' }, clickable: { type: Boolean, default: false } }
}
</script>

<style>
.toolwiz-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); grid-auto-rows: 1fr; align-items: stretch; gap: 8px; }
/* the types of tool (6 cards): three columns when there is room, then two, then one; never five narrow ones with the name cut */
.toolwiz-cards--types { grid-template-columns: repeat(auto-fit, minmax(max(240px, calc((100% - 16px) / 3)), 1fr)); }
.toolwiz-cards--wide { grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); grid-auto-rows: auto; }
.toolwiz-cards--compact { grid-template-columns: repeat(auto-fill, minmax(64px, 1fr)); }
.toolwiz-card { box-sizing: border-box; min-width: 0; min-height: 88px; padding: 12px; display: flex; flex-direction: column; justify-content: center; }
.toolwiz-cards--compact .toolwiz-card { min-height: 44px; align-items: center; }
.toolwiz-card--click { cursor: pointer; }
.toolwiz-clamp-1, .toolwiz-clamp-2 { overflow: hidden; display: -webkit-box; -webkit-box-orient: vertical; overflow-wrap: anywhere; }
.toolwiz-clamp-1 { -webkit-line-clamp: 1; }
.toolwiz-clamp-2 { -webkit-line-clamp: 2; }
</style>
