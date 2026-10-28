<script lang="ts">
	/**
	 * État d'un stock (module Dolibarr « UTILE ») : occasion et garantie se
	 * signalent ; le neuf, cas courant, ne s'affiche que si `always`.
	 */
	import { conditionLabel } from '$lib/stock-locations';
	import StateBadge from './StateBadge.svelte';

	let {
		condition,
		always = false,
		class: className = ''
	}: { condition: string; always?: boolean; class?: string } = $props();

	const color = $derived(
		condition === 'used' ? 'yellow' : condition === 'warranty' ? 'blue' : 'gray'
	);
</script>

{#if always || condition !== 'new'}
	<StateBadge {color} label={conditionLabel(condition)} class={className} />
{/if}
