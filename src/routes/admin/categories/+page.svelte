<script lang="ts">
	import { resolve } from '$app/paths';
	import { SvelteSet } from 'svelte/reactivity';
	import { Button, Card, Input } from 'flowbite-svelte';
	import { PlusOutline, EditOutline, ImageOutline } from 'flowbite-svelte-icons';
	import { PageHeader, CategoryTree, ActiveBadge } from '$lib/components/admin';
	import type { CategoryNode } from './+page.server';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	/**
	 * Branches ouvertes.
	 *
	 * Vide au départ : les racines sont dépliées par `defaultOpen`, qui suit les
	 * données. Les figer ici les rendrait insensibles à un rechargement.
	 */
	const opened = new SvelteSet<number>();
	let touched = $state(false);
	let selected = $state<CategoryNode | null>(null);
	let query = $state('');

	/** Racines dépliées d'emblée : un arbre entièrement replié n'apprend rien. */
	const expanded = $derived(
		touched || query.trim() ? opened : new SvelteSet(data.roots.map((r) => r.id))
	);

	/** Copie l'état courant avant toute modification manuelle. */
	function takeControl() {
		if (!touched) {
			for (const id of expanded) opened.add(id);
			touched = true;
		}
	}

	/** Ouvre une branche sans jamais la refermer. */
	function expand(id: number) {
		takeControl();
		opened.add(id);
	}

	function toggle(id: number) {
		// Au premier clic, on reprend l'état courant : sans cela, replier une
		// racine rouvrirait tout le reste.
		takeControl();
		if (opened.has(id)) opened.delete(id);
		else opened.add(id);
	}

	/**
	 * Chemin complet de la catégorie retenue.
	 *
	 * Une catégorie nommée « Accessoires » ne dit rien seule : c'est son chemin
	 * qui la situe dans le catalogue.
	 */
	function pathOf(target: CategoryNode): CategoryNode[] {
		const walk = (nodes: CategoryNode[], trail: CategoryNode[]): CategoryNode[] | null => {
			for (const node of nodes) {
				const next = [...trail, node];
				if (node.id === target.id) return next;
				const found = walk(node.children, next);
				if (found) return found;
			}
			return null;
		};
		return walk(data.roots, []) ?? [target];
	}

	const path = $derived(selected ? pathOf(selected) : []);

	/**
	 * Arbre restreint aux branches contenant le terme cherché.
	 *
	 * Une catégorie est conservée si elle correspond, ou si l'un de ses
	 * descendants correspond : sinon les résultats profonds seraient inatteignables.
	 */
	function filterTree(nodes: CategoryNode[], term: string): CategoryNode[] {
		const needle = term.trim().toLowerCase();
		if (!needle) return nodes;

		const keep = (node: CategoryNode): CategoryNode | null => {
			const children = node.children.map(keep).filter((c): c is CategoryNode => c !== null);
			const matches = node.name.toLowerCase().includes(needle);
			return matches || children.length > 0 ? { ...node, children } : null;
		};

		return nodes.map(keep).filter((n): n is CategoryNode => n !== null);
	}

	const visibleRoots = $derived(filterTree(data.roots, query));

	/** Une recherche déplie tout : replié, l'utilisateur ne verrait pas ses résultats. */
	function collectIds(nodes: CategoryNode[], into: number[] = []): number[] {
		for (const node of nodes) {
			into.push(node.id);
			collectIds(node.children, into);
		}
		return into;
	}

	$effect(() => {
		if (query.trim()) {
			opened.clear();
			for (const id of collectIds(visibleRoots)) opened.add(id);
			touched = true;
		}
	});
</script>

<svelte:head><title>Catégories · Administration</title></svelte:head>

<PageHeader
	title="Catégories"
	subtitle="{data.total} catégories"
	crumbs={[{ label: 'Accueil', href: '/admin' }, { label: 'Catégories' }]}
>
	{#snippet actions()}
		<Button href="/admin/categories/new">
			<PlusOutline class="me-2 h-4 w-4" /> Nouvelle catégorie
		</Button>
	{/snippet}
</PageHeader>

<div class="grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:items-start">
	<!-- ================= Arborescence ================= -->
	<Card class="max-w-none p-4 lg:sticky lg:top-4">
		<Input
			type="search"
			bind:value={query}
			placeholder="Filtrer les catégories…"
			aria-label="Filtrer les catégories"
			class="mb-3"
		/>

		<div class="max-h-[70vh] overflow-y-auto">
			{#if visibleRoots.length === 0}
				<p class="py-8 text-center text-sm text-gray-500">
					Aucune catégorie ne correspond à « {query} ».
				</p>
			{:else}
				<CategoryTree
					nodes={visibleRoots}
					selectedId={selected?.id ?? null}
					{expanded}
					onselect={(node) => (selected = node)}
					ontoggle={toggle}
				/>
			{/if}
		</div>
	</Card>

	<!-- ================= Détail ================= -->
	{#if selected}
		<Card class="max-w-none p-6">
			<!-- Le chemin situe la catégorie : chaque niveau est cliquable. -->
			<nav class="mb-3 flex flex-wrap items-center gap-1 text-xs text-gray-500">
				{#each path as step, i (step.id)}
					{#if i > 0}<span aria-hidden="true">›</span>{/if}
					<button
						type="button"
						onclick={() => (selected = step)}
						class="hover:text-gray-800 hover:underline dark:hover:text-gray-200"
					>
						{step.name}
					</button>
				{/each}
			</nav>

			<div class="flex flex-wrap items-start justify-between gap-4">
				<div class="min-w-0">
					<h2 class="text-xl font-semibold text-gray-900 dark:text-white">{selected.name}</h2>
					<p class="mt-1 text-sm text-gray-500">/{selected.slug}</p>
				</div>
				<div class="flex flex-wrap gap-2">
					<ActiveBadge active={selected.isActive} />
					<Button size="sm" href={resolve('/admin/categories/[id]', { id: String(selected.id) })}>
						<EditOutline class="me-2 h-4 w-4" /> Éditer
					</Button>
				</div>
			</div>

			<dl class="mt-6 grid gap-4 sm:grid-cols-3">
				<div>
					<dt class="text-xs tracking-wide text-gray-500 uppercase">Produits</dt>
					<dd class="mt-1 text-2xl font-bold text-gray-900 tabular-nums dark:text-white">
						{selected.productCount}
					</dd>
				</div>
				<div>
					<dt class="text-xs tracking-wide text-gray-500 uppercase">Sous-catégories</dt>
					<dd class="mt-1 text-2xl font-bold text-gray-900 tabular-nums dark:text-white">
						{selected.children.length}
					</dd>
				</div>
				<div>
					<dt class="text-xs tracking-wide text-gray-500 uppercase">Position</dt>
					<dd class="mt-1 text-2xl font-bold text-gray-900 tabular-nums dark:text-white">
						{selected.position}
					</dd>
				</div>
			</dl>

			{#if selected.children.length > 0}
				<div class="mt-6 border-t border-gray-200 pt-5 dark:border-gray-700">
					<h3 class="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
						Sous-catégories directes
					</h3>
					<div class="flex flex-wrap gap-2">
						{#each selected.children as child (child.id)}
							<button
								type="button"
								onclick={() => {
									expand(selected!.id);
									selected = child;
								}}
								class="rounded-full border border-gray-200 px-3 py-1 text-sm text-gray-700 hover:border-gray-400 dark:border-gray-700 dark:text-gray-300"
							>
								{child.name}
								{#if child.productCount > 0}
									<span class="text-gray-400">· {child.productCount}</span>
								{/if}
							</button>
						{/each}
					</div>
				</div>
			{/if}

			<div class="mt-6 flex flex-wrap gap-2 border-t border-gray-200 pt-5 dark:border-gray-700">
				<Button
					color="alternative"
					size="sm"
					href={resolve('/admin/products') + `?f_category=${encodeURIComponent(selected.name)}`}
				>
					Voir les produits
				</Button>
				<Button color="alternative" size="sm" href="/categorie/{selected.slug}" target="_blank">
					Ouvrir sur la boutique
				</Button>
			</div>
		</Card>
	{:else}
		<Card class="max-w-none p-10 text-center">
			<ImageOutline class="mx-auto h-10 w-10 text-gray-300 dark:text-gray-600" />
			<p class="mt-3 text-gray-600 dark:text-gray-300">
				Sélectionnez une catégorie dans l'arborescence pour en voir le détail.
			</p>
		</Card>
	{/if}
</div>
