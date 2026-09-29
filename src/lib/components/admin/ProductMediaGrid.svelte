<script lang="ts">
	/**
	 * Galerie d'images du produit, façon PrestaShop : les visuels sont affichés en
	 * vignettes (et non sous forme d'URL), la première image faisant office de
	 * couverture. Les vidéos et PDF n'ont pas d'aperçu : on affiche une icône.
	 *
	 * Les vignettes ont une taille **fixe** et se suivent en bandeau, comme dans
	 * PrestaShop 1.7. Une grille en fractions de largeur donnait des images de
	 * 150 à 200 px sur grand écran, hors de proportion avec le reste du
	 * formulaire.
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
	<!-- Bandeau qui défile plutôt qu'il ne s'étire : la taille d'une vignette ne
	     doit pas dépendre du nombre d'images ni de la largeur de l'écran. -->
	<div class="flex flex-wrap gap-3">
		{#each sorted as m, i (m.id)}
			<div
				class="group relative h-28 w-28 shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800"
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
							<FilePdfOutline class="h-6 w-6" />
						{:else}
							<VideoCameraOutline class="h-6 w-6" />
						{/if}
						<span class="line-clamp-2 px-1.5 text-center text-[10px] break-all">
							{m.url.split('/').pop()}
						</span>
					</div>
				{/if}

				{#if i === 0}
					<span
						class="absolute inset-x-0 bottom-0 bg-gray-700/85 py-0.5 text-center text-[10px] font-semibold text-white"
					>
						Image de couverture
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
						class="rounded bg-white/90 p-1 text-red-600 shadow-sm hover:bg-red-600 hover:text-white dark:bg-gray-900/90"
					>
						<TrashBinOutline class="h-3.5 w-3.5" />
					</button>
				</form>
			</div>
		{/each}
	</div>
{:else}
	<!-- Même gabarit qu'une vignette : l'emplacement vide annonce la taille
	     qu'auront les images. -->
	<div class="flex items-center gap-3">
		<div
			class="flex h-28 w-28 shrink-0 flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 text-center dark:border-gray-700"
		>
			<ImageOutline class="h-7 w-7 text-gray-300 dark:text-gray-600" />
		</div>
		<p class="text-sm text-gray-500 dark:text-gray-400">Aucune image pour ce produit.</p>
	</div>
{/if}
