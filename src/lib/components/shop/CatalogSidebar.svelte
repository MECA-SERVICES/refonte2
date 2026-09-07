<script lang="ts">
	import { page } from '$app/state';

	/**
	 * Colonne de navigation du catalogue : l'arborescence du rayon courant, puis
	 * les facettes de filtrage.
	 *
	 * Chaque option est un lien : l'état du filtre vit dans l'URL, donc il est
	 * partageable, indexable, et fonctionne sans JavaScript.
	 */

	type TreeEntry = { id: number; name: string; slug: string; total?: number; current?: boolean };
	type FacetItem = { value: string; label: string; total: number };

	let {
		tree = [],
		treeTitle = 'Catalogue',
		brands = [],
		selectedBrands = [],
		inStockOnly = false,
		inStockTotal = 0
	}: {
		tree?: TreeEntry[];
		treeTitle?: string;
		brands?: FacetItem[];
		selectedBrands?: string[];
		inStockOnly?: boolean;
		inStockTotal?: number;
	} = $props();

	const fmt = new Intl.NumberFormat('fr-FR');

	/**
	 * Construit l'URL d'un filtre sans muter celle de la page : un filtre qui
	 * change remet la pagination à zéro.
	 */
	function filterHref(changes: Record<string, string[] | boolean | null>) {
		const entries = [...page.url.searchParams.entries()].filter(
			([key]) => key !== 'page' && !(key in changes)
		);

		for (const [key, value] of Object.entries(changes)) {
			if (value === null || value === false) continue;
			if (value === true) entries.push([key, '1']);
			else for (const v of value) entries.push([key, v]);
		}

		const query = new URLSearchParams(entries).toString();
		return query ? `${page.url.pathname}?${query}` : page.url.pathname;
	}

	/** Ajoute ou retire une marque de la sélection courante. */
	function toggleBrand(value: string) {
		const next = selectedBrands.includes(value)
			? selectedBrands.filter((v) => v !== value)
			: [...selectedBrands, value];
		return filterHref({ marque: next });
	}

	const optionClass =
		'flex w-full items-center justify-between gap-2 border-l-[3px] px-2.5 py-1.5 text-left text-sm transition-colors';
</script>

<!--
	Le décalage `top` reprend la hauteur de l'en-tête collant : sans lui, la
	colonne glisserait sous la barre de navigation au défilement. `max-h` et le
	défilement interne évitent qu'une longue liste de marques ne dépasse l'écran.
-->
<aside
	class="border-[1.5px] border-shop-border bg-white lg:sticky lg:top-[12.5rem] lg:max-h-[calc(100vh-13.5rem)] lg:overflow-y-auto"
>
	{#if tree.length > 0}
		<div class="border-b border-shop-border-soft p-4">
			<p
				class="mb-3 font-display text-[13px] font-extrabold tracking-[0.1em] text-shop-ink uppercase"
			>
				{treeTitle}
			</p>
			{#each tree as entry (entry.id)}
				<a
					href="/categorie/{entry.slug}"
					class="flex justify-between gap-2 py-1.5 text-sm hover:text-shop-blue {entry.current
						? 'font-bold text-shop-red'
						: 'text-shop-ink-soft'}"
				>
					<span class="min-w-0 truncate">{entry.name}</span>
					{#if entry.total != null}
						<span class="shrink-0 text-[12.5px] text-shop-faint">{fmt.format(entry.total)}</span>
					{/if}
				</a>
			{/each}
		</div>
	{/if}

	<!-- Disponibilité : la facette la plus utile ici, l'essentiel du catalogue
	     étant en commande fournisseur. -->
	{#if inStockTotal > 0}
		<div class="border-b border-shop-border-soft p-4">
			<p class="mb-2.5 font-display text-[13.5px] font-bold text-shop-ink">Disponibilité</p>
			<a
				href={filterHref({ stock: !inStockOnly })}
				class="{optionClass} {inStockOnly
					? 'border-shop-red bg-shop-border-soft font-bold text-shop-ink'
					: 'border-transparent text-shop-ink-soft hover:bg-shop-subtle'}"
			>
				<span>En stock atelier</span>
				<span class="text-shop-faint">{fmt.format(inStockTotal)}</span>
			</a>
		</div>
	{/if}

	{#if brands.length > 0}
		<div class="border-b border-shop-border-soft p-4">
			<p class="mb-2.5 font-display text-[13.5px] font-bold text-shop-ink">Marque</p>
			<div class="max-h-72 overflow-y-auto">
				{#each brands as item (item.value)}
					{@const selected = selectedBrands.includes(item.value)}
					<a
						href={toggleBrand(item.value)}
						class="{optionClass} {selected
							? 'border-shop-red bg-shop-border-soft font-bold text-shop-ink'
							: 'border-transparent text-shop-ink-soft hover:bg-shop-subtle'}"
					>
						<span class="min-w-0 truncate">{item.label}</span>
						<span class="shrink-0 text-shop-faint">{fmt.format(item.total)}</span>
					</a>
				{/each}
			</div>
		</div>
	{/if}

	<div class="p-4 text-[13px] leading-relaxed text-shop-muted">
		Besoin d'un conseil ?
		<a href="tel:0950922336" class="font-bold text-shop-ink hover:text-shop-blue">
			09 50 92 23 36
		</a><br />
		Du lundi au vendredi, 9 h – 12 h et 14 h – 18 h.
	</div>
</aside>
