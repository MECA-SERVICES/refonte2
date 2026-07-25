<script lang="ts">
	/**
	 * Galerie d'images du produit, façon PrestaShop : les visuels sont affichés en
	 * vignettes (et non sous forme d'URL), la première image faisant office de
	 * couverture. Les vidéos et PDF n'ont pas d'aperçu : on affiche une icône.
	 */
	import { enhance } from '$app/forms';
	import {
		TrashBinOutline,
		ImageOutline,
		FilePdfOutline,
		VideoCameraOutline
	} from 'flowbite-svelte-icons';

	type Media = {
		id: number;
		type: string;
		url: string;
		alt: string | null;
		position: number;
	};

	let { media, productName }: { media: Media[]; productName: string } = $props();

	// La couverture est la première par position — même règle que PrestaShop.
	const sorted = $derived([...media].sort((a, b) => a.position - b.position));
</script>

{#if sorted.length > 0}
	<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
		{#each sorted as m, i (m.id)}
			<div
				class="group relative aspect-square overflow-hidden rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800"
			>
				{#if m.type === 'image'}
					<img
						src={m.url}
						alt={m.alt ?? productName}
						loading="lazy"
						class="h-full w-full object-contain"
						onerror={(e) => ((e.currentTarget as HTMLImageElement).style.visibility = 'hidden')}
					/>
				{:else}
					<div class="flex h-full w-full flex-col items-center justify-center gap-2 text-gray-400">
						{#if m.type === 'pdf'}
							<FilePdfOutline class="h-8 w-8" />
						{:else}
							<VideoCameraOutline class="h-8 w-8" />
						{/if}
						<span class="px-2 text-center text-xs break-all">{m.url.split('/').pop()}</span>
					</div>
				{/if}

				{#if i === 0}
					<span
						class="absolute top-1.5 left-1.5 rounded bg-cyan-600 px-1.5 py-0.5 text-[10px] font-semibold text-white"
					>
						Couverture
					</span>
				{/if}

				<!-- Suppression au survol : garde la grille lisible au repos. -->
				<form
					method="POST"
					action="?/deleteMedia"
					use:enhance
					class="absolute top-1.5 right-1.5 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100"
				>
					<input type="hidden" name="mediaId" value={m.id} />
					<button
						type="submit"
						title="Supprimer l'image"
						class="rounded bg-white/90 p-1.5 text-red-600 shadow-sm hover:bg-red-600 hover:text-white dark:bg-gray-900/90"
					>
						<TrashBinOutline class="h-4 w-4" />
					</button>
				</form>
			</div>
		{/each}
	</div>
{:else}
	<div
		class="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 py-10 text-center dark:border-gray-700"
	>
		<ImageOutline class="h-8 w-8 text-gray-300 dark:text-gray-600" />
		<p class="mt-2 text-sm text-gray-500 dark:text-gray-400">Aucune image pour ce produit.</p>
	</div>
{/if}
