<script lang="ts">
	import { goto } from '$app/navigation';
	import { SearchOutline } from 'flowbite-svelte-icons';
	import ImagePlaceholder from './ImagePlaceholder.svelte';
	import { formatPrice, shopProductPath } from '$lib/shop';

	/**
	 * Barre de recherche avec aperçu instantané.
	 *
	 * À chaque frappe (débouncée), l'aperçu interroge `/recherche/apercu` —
	 * recherche trigramme tolérante aux fautes — et déroule les meilleurs
	 * produits et marques. Entrée sans sélection soumet le formulaire vers
	 * la page /recherche complète : la barre fonctionne donc aussi sans
	 * JavaScript.
	 */

	type PreviewProduct = {
		id: number;
		name: string;
		slug: string;
		reference: string;
		stock: number;
		priceTtc: string;
		brandName: string | null;
		imageUrl: string | null;
		imageIsBrandLogo: boolean;
	};
	type PreviewCategory = { name: string; slug: string };
	type PreviewBrand = { name: string; slug: string; logoUrl: string | null };

	let {
		id = 'searchbox',
		placeholder = 'Référence, marque ou modèle — ex. 587 42 07-01, Iseki SA250',
		initial = '',
		class: className = ''
	}: {
		/** Préfixe des ids ARIA — unique quand deux barres cohabitent. */
		id?: string;
		placeholder?: string;
		/** Valeur de départ (terme déjà recherché). */
		initial?: string;
		class?: string;
	} = $props();

	// Valeur de départ, volontairement jamais resynchronisée avec la prop.
	// svelte-ignore state_referenced_locally
	let value = $state(initial);
	let open = $state(false);
	let activeIndex = $state(-1);
	let products = $state<PreviewProduct[]>([]);
	let categories = $state<PreviewCategory[]>([]);
	let brands = $state<PreviewBrand[]>([]);
	let searched = $state('');
	let root: HTMLElement | undefined = $state();

	let timer: ReturnType<typeof setTimeout> | undefined;
	let controller: AbortController | undefined;

	/** L'aperçu attend une pause de frappe et annule la requête précédente. */
	function schedule(q: string) {
		clearTimeout(timer);
		if (q.trim().length < 2) {
			open = false;
			products = [];
			categories = [];
			brands = [];
			return;
		}
		timer = setTimeout(() => void fetchPreview(q), 180);
	}

	async function fetchPreview(q: string) {
		controller?.abort();
		controller = new AbortController();
		try {
			const res = await fetch(`/recherche/apercu?q=${encodeURIComponent(q)}`, {
				signal: controller.signal
			});
			if (!res.ok) return;
			const data = (await res.json()) as {
				products: PreviewProduct[];
				categories: PreviewCategory[];
				brands: PreviewBrand[];
			};
			products = data.products;
			categories = data.categories;
			brands = data.brands;
			searched = q;
			activeIndex = -1;
			open = true;
		} catch {
			// Requête annulée ou réseau : l'aperçu garde son état.
		}
	}

	function close() {
		open = false;
		activeIndex = -1;
	}

	function submitAll() {
		close();
		void goto(`/recherche?q=${encodeURIComponent(value.trim())}`);
	}

	function onKeydown(event: KeyboardEvent) {
		if (!open) return;
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			activeIndex = Math.min(activeIndex + 1, products.length - 1);
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			activeIndex = Math.max(activeIndex - 1, -1);
		} else if (event.key === 'Enter' && activeIndex >= 0) {
			event.preventDefault();
			const picked = products[activeIndex];
			close();
			void goto(shopProductPath(picked));
		} else if (event.key === 'Escape') {
			close();
		}
	}
</script>

<!-- Referme l'aperçu dès qu'on interagit ailleurs sur la page. -->
<svelte:document
	onpointerdown={(event) => {
		if (open && root && !root.contains(event.target as Node)) close();
	}}
/>

<form
	bind:this={root}
	action="/recherche"
	method="get"
	role="search"
	class="relative min-w-0 {className}"
	onsubmit={close}
>
	<div
		class="flex items-stretch overflow-hidden rounded-xl border-2 border-shop-border bg-white focus-within:border-shop-blue"
	>
		<label class="sr-only" for="{id}-input">Rechercher</label>
		<input
			id="{id}-input"
			type="search"
			name="q"
			{placeholder}
			bind:value
			autocomplete="off"
			role="combobox"
			aria-expanded={open}
			aria-controls="{id}-list"
			aria-activedescendant={activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined}
			oninput={() => schedule(value)}
			onfocus={() => value.trim().length >= 2 && products.length > 0 && (open = true)}
			onkeydown={onKeydown}
			class="min-w-0 flex-1 border-0 px-4 py-3 text-[15px] text-shop-ink placeholder:text-shop-muted focus:ring-0"
		/>
		<button
			type="submit"
			class="flex shrink-0 items-center gap-2 bg-shop-blue px-5 font-display text-sm font-bold text-white transition-colors hover:bg-shop-blue-dark"
		>
			<SearchOutline class="h-4.5 w-4.5" />
			<span class="hidden sm:inline">Rechercher</span>
		</button>
	</div>

	{#if open}
		<div
			class="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border-[1.5px] border-shop-border-soft bg-white shadow-[0_20px_50px_rgba(30,36,54,0.16)]"
		>
			{#if categories.length > 0}
				<!-- Les rayons d'abord : taper « robot tondeuse » propose d'ouvrir
				     toute la catégorie plutôt que de parcourir produit par produit. -->
				<nav class="border-b border-shop-border-soft" aria-label="Catégories correspondantes">
					{#each categories as cat (cat.slug)}
						<a
							href="/categorie/{cat.slug}"
							onclick={close}
							class="flex items-center justify-between gap-3 px-3.5 py-2.5 transition-colors hover:bg-shop-subtle"
						>
							<span class="min-w-0 truncate text-sm text-shop-ink">
								Voir tous les <strong class="font-display font-bold">« {cat.name} »</strong>
							</span>
							<span class="shrink-0 font-display font-extrabold text-shop-blue" aria-hidden="true">
								→
							</span>
						</a>
					{/each}
				</nav>
			{/if}

			{#if products.length > 0}
				<ul id="{id}-list" role="listbox" aria-label="Suggestions de produits">
					{#each products as item, i (item.id)}
						<li role="option" id="{id}-option-{i}" aria-selected={activeIndex === i}>
							<a
								href={shopProductPath(item)}
								onclick={close}
								onpointerenter={() => (activeIndex = i)}
								class="flex items-center gap-3 px-3.5 py-2.5 {activeIndex === i
									? 'bg-shop-subtle'
									: ''}"
							>
								<span
									class="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-shop-subtle"
								>
									{#if item.imageUrl}
										<img
											src={item.imageUrl}
											alt=""
											loading="lazy"
											class="h-full w-full object-contain {item.imageIsBrandLogo ? 'p-1' : ''}"
										/>
									{:else}
										<ImagePlaceholder label="" class="border-0" />
									{/if}
								</span>
								<span class="min-w-0 flex-1">
									<span class="block truncate text-sm font-semibold text-shop-ink">
										{item.name}
									</span>
									<span class="block truncate text-xs text-shop-faint">
										Réf. {item.reference}{item.brandName ? ` · ${item.brandName}` : ''}
									</span>
								</span>
								<span class="shrink-0 font-display text-sm font-extrabold text-shop-red">
									{formatPrice(item.priceTtc)}
								</span>
							</a>
						</li>
					{/each}
				</ul>
			{:else if categories.length === 0 && brands.length === 0}
				<p class="px-4 py-4 text-sm text-shop-muted">
					Aucun résultat pour « {searched} » — vérifiez la référence ou appelez l'atelier au
					<a href="tel:0950922336" class="font-bold text-shop-ink">09 50 92 23 36</a>.
				</p>
			{/if}

			{#if brands.length > 0}
				<div
					class="flex flex-wrap items-center gap-2 border-t border-shop-border-soft px-3.5 py-2.5"
				>
					<span class="text-xs font-bold tracking-[0.08em] text-shop-muted uppercase">Marques</span>
					{#each brands as brandHit (brandHit.slug)}
						<a
							href="/marque/{brandHit.slug}"
							onclick={close}
							class="rounded-full border-[1.5px] border-shop-border-soft px-3 py-1 text-[13px] font-bold text-shop-ink transition-colors hover:border-shop-blue hover:text-shop-blue"
						>
							{brandHit.name}
						</a>
					{/each}
				</div>
			{/if}

			{#if products.length > 0}
				<button
					type="button"
					onclick={submitAll}
					class="block w-full border-t border-shop-border-soft bg-shop-subtle px-4 py-3 text-left font-display text-sm font-bold text-shop-blue transition-colors hover:bg-primary-100"
				>
					Tous les résultats pour « {searched} » →
				</button>
			{/if}
		</div>
	{/if}
</form>
