<script lang="ts">
	import { ImageOutline } from 'flowbite-svelte-icons';

	/**
	 * Bloc réservé à un visuel à venir : il matérialise l'emplacement et rappelle
	 * la dimension attendue, pour que l'intégration des images soit triviale.
	 */
	let {
		label,
		hint,
		class: className = ''
	}: {
		/** Ce que le visuel devra représenter (« Photo atelier », « Logo marque »…). */
		label: string;
		/** Dimension conseillée, ex. « 1600 × 600 ». */
		hint?: string;
		class?: string;
	} = $props();
</script>

<div
	class="flex h-full w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-shop-border bg-shop-subtle text-shop-muted {className}"
	role="img"
	aria-label={label}
>
	<ImageOutline class="h-8 w-8 opacity-60" />
	<p class="px-4 text-center text-xs font-medium">{label}</p>
	{#if hint}
		<p class="text-[11px] opacity-70">{hint}</p>
	{/if}
</div>
