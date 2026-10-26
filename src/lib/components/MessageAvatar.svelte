<script lang="ts">
	import { createAvatar } from '@dicebear/core';
	import { thumbs } from '@dicebear/collection';

	/**
	 * Avatar d'un message (demande client 12.6).
	 *
	 * Client : illustration DiceBear « thumbs », calculée ici même à partir de
	 * son identifiant — aucun appel à un service extérieur, aucune donnée
	 * transmise. Équipe : le logo de la boutique, en attendant la photo
	 * personnalisée de chaque administrateur (stockage de fichiers à venir).
	 */
	let {
		customerId = null,
		team = false,
		size = 36
	}: { customerId?: number | null; team?: boolean; size?: number } = $props();

	const uri = $derived(
		team || customerId === null
			? null
			: createAvatar(thumbs, { seed: `client-${customerId}`, size }).toDataUri()
	);
</script>

{#if uri}
	<img
		src={uri}
		alt=""
		width={size}
		height={size}
		class="shrink-0 rounded-full"
		style:width="{size}px"
		style:height="{size}px"
	/>
{:else}
	<span
		class="flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-gray-200 bg-white"
		style:width="{size}px"
		style:height="{size}px"
	>
		<img src="/logo-msshop.png" alt="" class="h-full w-full object-contain p-0.5" />
	</span>
{/if}
