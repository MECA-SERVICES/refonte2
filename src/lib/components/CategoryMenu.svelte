<script lang="ts">
	import { resolve } from '$app/paths';
	import { fly, fade } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import type { ShopMenuChild, ShopMenuEntry } from '$lib/server/shop';

	interface CategoryMenuProps {
		menu: ShopMenuEntry[];
		open: boolean;
		onClose: () => void;
	}

	let { menu, open = $bindable(), onClose }: CategoryMenuProps = $props();

	// Navigation en profondeur : seule la pile est un état, le niveau affiché s'en
	// déduit. Cela évite de recopier `menu` dans un état local, qui n'aurait
	// capturé que sa valeur initiale.
	let navigationStack = $state<ShopMenuChild[]>([]);
	const currentChildren = $derived(
		navigationStack.length > 0 ? (navigationStack[navigationStack.length - 1].children ?? []) : menu
	);

	const categoryHref = (slug: string) => resolve('/(shop)/categorie/[slug]', { slug });

	// Détecte si c'est une catégorie "Pièces détachées"
	function isPiecesCategory(name: string): boolean {
		return /pi[èe]ces?|consommable|accessoire/i.test(name);
	}

	// Navigation : descendre dans une catégorie
	function drillDown(category: ShopMenuChild) {
		if (category.children && category.children.length > 0) {
			navigationStack = [...navigationStack, category];
		}
	}

	// Navigation : remonter d'un niveau
	function goBack() {
		navigationStack = navigationStack.slice(0, -1);
	}

	// Réinitialise la navigation quand le menu se ferme
	function handleClose() {
		navigationStack = [];
		onClose();
	}

	// Snippet récursif pour afficher toutes les sous-catégories (mode pièces)
</script>

{#snippet categoryItem(child: ShopMenuChild, level = 0)}
	<a
		href={categoryHref(child.slug)}
		class={level === 0
			? 'block text-sm font-medium text-gray-700 transition-colors hover:text-shop-blue hover:underline'
			: 'block text-xs text-gray-600 transition-colors hover:text-shop-blue hover:underline'}
		onclick={handleClose}
	>
		{child.name}
	</a>
	{#if child.children && child.children.length > 0}
		<ul class="mt-1 ml-4 space-y-1 border-l-2 border-gray-200 pl-3">
			{#each child.children as subChild (subChild.id)}
				<li>
					{@render categoryItem(subChild, level + 1)}
				</li>
			{/each}
		</ul>
	{/if}
{/snippet}

{#if open}
	<!-- Overlay -->
	<button
		class="fixed inset-0 z-40 bg-black/40"
		onclick={handleClose}
		aria-label="Fermer le menu"
		transition:fade={{ duration: 200 }}
	></button>

	<!-- Sidebar LARGE avec 2 colonnes -->
	<div
		class="fixed top-0 left-0 z-50 flex h-screen bg-white shadow-2xl {navigationStack.length === 0
			? 'w-80'
			: 'w-full lg:w-[90vw] xl:w-[1200px]'}"
		transition:fly={{ x: -1200, duration: 400, easing: quintOut }}
	>
		<!-- COLONNE GAUCHE FIXE : Catégories racines -->
		<aside class="w-80 flex-shrink-0 border-r border-gray-200 bg-gray-50">
			<!-- Header -->
			<div class="border-b border-gray-200 bg-shop-blue px-6 py-4">
				<h2 class="text-lg font-bold text-white">Catégories</h2>
			</div>

			<!-- Liste des catégories racines -->
			<nav class="h-[calc(100vh-65px)] overflow-y-auto p-4">
				<ul class="space-y-1">
					{#each menu as category (category.id)}
						{@const isActive = navigationStack.length > 0 && navigationStack[0].id === category.id}
						{@const hasChildren = category.children && category.children.length > 0}
						<li>
							<button
								type="button"
								class="group flex w-full items-center justify-between rounded-lg px-4 py-3 text-left transition-all {isActive
									? 'bg-shop-blue text-white'
									: 'hover:bg-white hover:shadow-sm'}"
								onclick={() => {
									if (hasChildren) {
										navigationStack = [category];
									} else {
										window.location.href = categoryHref(category.slug);
									}
								}}
							>
								<span class="font-medium {isActive ? 'text-white' : 'text-gray-900'}">
									{category.name}
								</span>
								{#if hasChildren}
									<svg
										class="h-5 w-5 transition-all {isActive
											? 'text-white'
											: 'text-gray-400 group-hover:translate-x-0.5 group-hover:text-shop-blue'}"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M9 5l7 7-7 7"
										></path>
									</svg>
								{/if}
							</button>
						</li>
					{/each}
				</ul>
			</nav>
		</aside>

		<!-- COLONNE DROITE : Contenu drill-down -->
		{#if navigationStack.length > 0}
			<div class="flex flex-1 flex-col">
				<!-- Header avec breadcrumb -->
				<div class="border-b border-gray-200 bg-shop-blue px-8 py-4">
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-3">
							{#if navigationStack.length > 1}
								<button
									type="button"
									class="flex items-center gap-1 text-sm text-white transition-colors hover:text-shop-orange"
									onclick={goBack}
								>
									<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M15 19l-7-7 7-7"
										></path>
									</svg>
									Retour
								</button>
								<span class="text-white">•</span>
							{/if}
							<h2 class="text-xl font-bold text-white">
								{navigationStack[navigationStack.length - 1].name}
							</h2>
						</div>
						<button
							type="button"
							class="rounded-full p-2 text-white transition-colors hover:bg-shop-blue-light"
							onclick={handleClose}
							aria-label="Fermer"
						>
							<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M6 18L18 6M6 6l12 12"
								></path>
							</svg>
						</button>
					</div>
				</div>

				<!-- Contenu -->
				<div class="h-[calc(100vh-81px)] flex-1 overflow-y-auto p-8">
					{#if isPiecesCategory(navigationStack[0].name)}
						<!-- Mode PIÈCES DÉTACHÉES : Liste complète déroulée en 2 colonnes -->
						<div class="columns-2 gap-8">
							{#each currentChildren as category (category.id)}
								<div class="mb-4 break-inside-avoid">
									{@render categoryItem(category, 0)}
								</div>
							{/each}
						</div>
					{:else}
						<!-- Mode PRODUITS : cartes en 3 colonnes -->
						<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
							{#each currentChildren as category (category.id)}
								{@const hasChildren = category.children && category.children.length > 0}
								<button
									type="button"
									class="group flex items-center gap-4 rounded-lg border-2 border-gray-200 bg-white p-4 text-left transition-all hover:border-shop-blue hover:shadow-lg"
									onclick={() =>
										hasChildren
											? drillDown(category)
											: (window.location.href = categoryHref(category.slug))}
								>
									<!-- Nom + chevron -->
									<div class="flex flex-1 items-center justify-between">
										<span
											class="font-semibold text-gray-900 transition-colors group-hover:text-shop-blue"
										>
											{category.name}
										</span>
										{#if hasChildren}
											<svg
												class="h-5 w-5 text-gray-400 transition-all group-hover:translate-x-1 group-hover:text-shop-blue"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
											>
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M9 5l7 7-7 7"
												></path>
											</svg>
										{/if}
									</div>
								</button>
							{/each}
						</div>
					{/if}
				</div>
			</div>
		{/if}
	</div>
{/if}
