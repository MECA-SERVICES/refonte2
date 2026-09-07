<script lang="ts">
	import { page } from '$app/state';

	/** Puces des filtres actifs : chacune est un lien qui retire ce seul filtre. */

	type Chip = { key: string; value: string; label: string };

	let { chips }: { chips: Chip[] } = $props();

	/** URL débarrassée d'une valeur de filtre ; la pagination repart à zéro. */
	function removeHref(chip: Chip) {
		const entries = [...page.url.searchParams.entries()].filter(
			([key, value]) => key !== 'page' && !(key === chip.key && value === chip.value)
		);
		const query = new URLSearchParams(entries).toString();
		return query ? `${page.url.pathname}?${query}` : page.url.pathname;
	}

	/** URL sans aucun filtre, tri conservé. */
	const clearHref = $derived.by(() => {
		const tri = page.url.searchParams.get('tri');
		return tri ? `${page.url.pathname}?tri=${tri}` : page.url.pathname;
	});
</script>

{#if chips.length > 0}
	<div class="my-4 flex flex-wrap items-center gap-2">
		{#each chips as chip (chip.key + chip.value)}
			<a
				href={removeHref(chip)}
				class="border-[1.5px] border-shop-ink bg-shop-border-soft px-3 py-1.5 text-[13px] font-bold text-shop-ink hover:bg-white"
			>
				{chip.label} ✕
			</a>
		{/each}

		{#if chips.length > 1}
			<a href={clearHref} class="px-2 text-[13px] font-semibold text-shop-muted hover:underline">
				Tout effacer
			</a>
		{/if}
	</div>
{/if}
