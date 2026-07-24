<script lang="ts">
	/**
	 * Vignette des listes admin (produits, marques…).
	 *
	 * Les images viennent de domaines externes (MinIO, ancien site) : chargement
	 * différé, et l'image se masque si l'URL est cassée pour laisser le cadre vide
	 * plutôt qu'une icône navigateur.
	 */
	import { ImageOutline } from 'flowbite-svelte-icons';

	let {
		src,
		alt,
		size = 'md'
	}: {
		src?: string | null;
		alt: string;
		size?: 'sm' | 'md';
	} = $props();

	const box = $derived(size === 'sm' ? 'h-9 w-9' : 'h-11 w-11');
</script>

<div
	class="flex {box} items-center justify-center overflow-hidden rounded border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-700"
>
	{#if src}
		<img
			{src}
			{alt}
			loading="lazy"
			class="h-full w-full object-contain"
			onerror={(e) => ((e.currentTarget as HTMLImageElement).style.visibility = 'hidden')}
		/>
	{:else}
		<ImageOutline class="h-5 w-5 text-gray-300 dark:text-gray-500" />
	{/if}
</div>
