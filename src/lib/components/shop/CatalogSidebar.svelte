<script lang="ts">
	import { formatNumber } from '$lib/money';
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
	/** Caractéristique technique : un libellé, ses valeurs et leurs volumes. */
	type SpecFacet = { name: string; values: { value: string; total: number }[] };

	let {
		tree = [],
		treeTitle = 'Catalogue',
		natures = [],
		selectedNatures = [],
		brands = [],
		selectedBrands = [],
		inStockOnly = false,
		inStockTotal = 0,
		specs = [],
		selectedSpecs = []
	}: {
		tree?: TreeEntry[];
		treeTitle?: string;
		/** Familles « Produits » / « Pièces détachées » — page de recherche. */
		natures?: FacetItem[];
		selectedNatures?: string[];
		brands?: FacetItem[];
		selectedBrands?: string[];
		inStockOnly?: boolean;
		inStockTotal?: number;
		/** Caractéristiques proposées, calculées sur le rayon courant. */
		specs?: SpecFacet[];
		/** Sélections en cours, au format « Libellé:Valeur ». */
		selectedSpecs?: string[];
	} = $props();

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

	/**
	 * Coche une valeur d'un filtre à cases, ou la décoche si elle l'était déjà.
	 * Les valeurs cochées se cumulent : « Iseki » et « Kubota » montrent les deux.
	 */
	function toggleHref(key: string, selected: string[], value: string) {
		const next = selected.includes(value)
			? selected.filter((v) => v !== value)
			: [...selected, value];
		return filterHref({ [key]: next });
	}

	/**
	 * Sélectionne une caractéristique, ou la retire si elle l'était déjà.
	 *
	 * Une seule à la fois, contrairement aux marques : deux valeurs d'un même
	 * libellé (« 46 cm » et « 53 cm ») ne peuvent pas être vraies ensemble.
	 */
	function toggleSpec(name: string, value: string) {
		const token = `${name}:${value}`;
		const next = selectedSpecs.includes(token) ? [] : [token];
		return filterHref({ spec: next });
	}

	/** Préfixe d'identifiants ARIA, unique par instance. */
	const uid = $props.id();

	const blockTitleClass =
		'mb-2.5 font-display text-[12.5px] font-extrabold tracking-[0.12em] text-shop-muted uppercase';

	const optionClass =
		'flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors';
</script>

<!-- Option d'un filtre à cases : un lien plutôt qu'un champ de formulaire,
     chaque case change l'URL — le filtre reste partageable et fonctionne
     sans JavaScript. -->
{#snippet checkOption(item: FacetItem, selected: boolean, href: string)}
	<a
		{href}
		role="checkbox"
		aria-checked={selected}
		class="{optionClass} {selected
			? 'bg-primary-50 font-bold text-shop-blue'
			: 'text-shop-ink-soft hover:bg-shop-subtle'}"
	>
		<span class="flex min-w-0 items-center gap-2.5">
			<span
				class="flex h-4 w-4 shrink-0 items-center justify-center rounded border-[1.5px] {selected
					? 'border-shop-blue bg-shop-blue text-white'
					: 'border-shop-border bg-white'}"
				aria-hidden="true"
			>
				{#if selected}
					<svg viewBox="0 0 12 12" class="h-2.5 w-2.5" fill="none">
						<path
							d="M2.5 6.2 5 8.5l4.5-5"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
					</svg>
				{/if}
			</span>
			<span class="min-w-0 truncate">{item.label}</span>
		</span>
		<span class="shrink-0 text-shop-faint">{formatNumber(item.total)}</span>
	</a>
{/snippet}

<!--
	Le décalage `top` reprend la hauteur de l'en-tête collant : sans lui, la
	colonne glisserait sous la barre de navigation au défilement. `max-h` et le
	défilement interne évitent qu'une longue liste de marques ne dépasse l'écran.
-->
<aside
	class="rounded-2xl border-[1.5px] border-shop-border-soft bg-white lg:sticky lg:top-[12.5rem] lg:max-h-[calc(100vh-13.5rem)] lg:overflow-y-auto"
>
	{#if tree.length > 0}
		<div class="border-b border-shop-border-soft p-5">
			<p class={blockTitleClass}>{treeTitle}</p>
			{#each tree as entry (entry.id)}
				<a
					href="/categorie/{entry.slug}"
					class="flex justify-between gap-2 py-1.5 text-sm hover:text-shop-blue {entry.current
						? 'font-bold text-shop-blue'
						: 'text-shop-ink-soft'}"
				>
					<span class="min-w-0 truncate">{entry.name}</span>
					{#if entry.total != null}
						<span class="shrink-0 text-[12.5px] text-shop-faint">{formatNumber(entry.total)}</span>
					{/if}
				</a>
			{/each}
		</div>
	{/if}

	{#if natures.length > 0}
		<div class="border-b border-shop-border-soft p-5">
			<p class={blockTitleClass} id="{uid}-natures">Type</p>
			<div role="group" aria-labelledby="{uid}-natures">
				{#each natures as item (item.value)}
					{@render checkOption(
						item,
						selectedNatures.includes(item.value),
						toggleHref('type', selectedNatures, item.value)
					)}
				{/each}
			</div>
		</div>
	{/if}

	<!-- Disponibilité : la facette la plus utile ici, l'essentiel du catalogue
	     étant en commande fournisseur. -->
	{#if inStockTotal > 0}
		<div class="border-b border-shop-border-soft p-5">
			<p class={blockTitleClass}>Disponibilité</p>
			<a
				href={filterHref({ stock: !inStockOnly })}
				class="{optionClass} {inStockOnly
					? 'bg-primary-50 font-bold text-shop-blue'
					: 'text-shop-ink-soft hover:bg-shop-subtle'}"
			>
				<span class="flex min-w-0 items-center gap-2">
					<span class="h-2 w-2 shrink-0 rounded-full bg-shop-green" aria-hidden="true"></span>
					En stock magasin
				</span>
				<span class="shrink-0 text-shop-faint">{formatNumber(inStockTotal)}</span>
			</a>
		</div>
	{/if}

	{#if brands.length > 0}
		<div class="border-b border-shop-border-soft p-5">
			<p class={blockTitleClass} id="{uid}-brands">Marque</p>
			<div class="max-h-72 overflow-y-auto" role="group" aria-labelledby="{uid}-brands">
				{#each brands as item (item.value)}
					{@render checkOption(
						item,
						selectedBrands.includes(item.value),
						toggleHref('marque', selectedBrands, item.value)
					)}
				{/each}
			</div>
		</div>
	{/if}

	{#each specs as facet (facet.name)}
		<div class="border-b border-shop-border-soft p-5">
			<p class={blockTitleClass}>{facet.name}</p>
			<div class="max-h-64 overflow-y-auto">
				{#each facet.values as item (item.value)}
					{@const selected = selectedSpecs.includes(`${facet.name}:${item.value}`)}
					<a
						href={toggleSpec(facet.name, item.value)}
						class="{optionClass} {selected
							? 'bg-primary-50 font-bold text-shop-blue'
							: 'text-shop-ink-soft hover:bg-shop-subtle'}"
					>
						<span class="min-w-0 truncate">{item.value}</span>
						<span class="shrink-0 text-shop-faint">{formatNumber(item.total)}</span>
					</a>
				{/each}
			</div>
		</div>
	{/each}

	<div class="p-5 text-[13px] leading-relaxed text-shop-muted">
		Besoin d'un conseil ?
		<a href="tel:0950922336" class="font-bold text-shop-ink hover:text-shop-blue">
			09 50 92 23 36
		</a><br />
		Du lundi au vendredi, 9 h – 12 h et 14 h – 18 h.
	</div>
</aside>
