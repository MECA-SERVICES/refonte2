<script lang="ts">
	/**
	 * Sélecteur de catégories façon PrestaShop : arborescence à cocher pour les
	 * catégories additionnelles, plus le choix de la catégorie principale.
	 *
	 * La catégorie principale est forcément rattachée au produit : sa case est
	 * cochée et verrouillée, et le serveur l'exclut des catégories additionnelles
	 * pour éviter un doublon.
	 */
	import { Label, Select, Checkbox, Input } from 'flowbite-svelte';
	import { CloseOutline } from 'flowbite-svelte-icons';

	type Cat = { id: number; name: string; parentId: number | null };

	let {
		categories,
		mainCategoryId = $bindable(''),
		selectedIds = $bindable([])
	}: {
		categories: Cat[];
		mainCategoryId?: string;
		selectedIds?: number[];
	} = $props();

	let search = $state('');

	// Index parent → enfants, pour parcourir l'arbre sans requête supplémentaire.
	// Objet simple (et non Map) : il est reconstruit à chaque recalcul et jamais
	// muté ensuite, la réactivité vient donc entièrement du $derived.by.
	const childrenOf = $derived.by(() => {
		const index: Record<number, Cat[]> = {};
		for (const c of categories) {
			if (c.parentId === null) continue;
			(index[c.parentId] ??= []).push(c);
		}
		for (const list of Object.values(index)) {
			list.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
		}
		return index;
	});

	function kidsOf(id: number): Cat[] {
		return childrenOf[id] ?? [];
	}

	// Les racines sont les catégories sans parent connu : un parent supprimé ne
	// doit pas rendre ses enfants invisibles.
	const knownIds = $derived(new Set(categories.map((c) => c.id)));
	const roots = $derived(
		categories
			.filter((c) => c.parentId === null || !knownIds.has(c.parentId))
			.sort((a, b) => a.name.localeCompare(b.name, 'fr'))
	);

	const q = $derived(search.trim().toLowerCase());

	/** Une branche reste visible si elle-même ou l'un de ses descendants correspond. */
	function matches(cat: Cat): boolean {
		if (!q) return true;
		if (cat.name.toLowerCase().includes(q)) return true;
		return kidsOf(cat.id).some(matches);
	}

	const mainId = $derived(Number(mainCategoryId));

	function toggle(id: number, checked: boolean) {
		if (checked) {
			if (!selectedIds.includes(id)) selectedIds = [...selectedIds, id];
		} else {
			selectedIds = selectedIds.filter((x) => x !== id);
		}
	}

	const selectItems = $derived([
		{ value: '', name: 'Aucune' },
		...[...categories]
			.sort((a, b) => a.name.localeCompare(b.name, 'fr'))
			.map((c) => ({ value: String(c.id), name: c.name }))
	]);

	const byId = $derived.by(() => {
		const index: Record<number, Cat> = {};
		for (const c of categories) index[c.id] = c;
		return index;
	});

	/**
	 * Chemin complet « Parent > Enfant ». Beaucoup de catégories portent le même
	 * nom (« Accessoires »…) : sans le chemin, les puces seraient ambiguës.
	 * La racine est omise, elle n'apporte rien à la lecture.
	 */
	function pathOf(id: number): string {
		const parts: string[] = [];
		let cur: Cat | undefined = byId[id];
		const seen = new Set<number>();
		while (cur && !seen.has(cur.id)) {
			seen.add(cur.id);
			parts.unshift(cur.name);
			cur = cur.parentId === null ? undefined : byId[cur.parentId];
		}
		return parts.length > 1 ? parts.slice(1).join(' > ') : parts.join(' > ');
	}

	// Puces triées par chemin, pour un ordre stable quand on coche/décoche.
	const selectedCats = $derived(
		selectedIds
			.filter((id) => byId[id] && id !== mainId)
			.map((id) => ({ id, path: pathOf(id) }))
			.sort((a, b) => a.path.localeCompare(b.path, 'fr'))
	);
</script>

<div class="space-y-4">
	<div>
		<Label for="categoryId" class="mb-2">Catégorie principale</Label>
		<Select
			id="categoryId"
			name="categoryId"
			placeholder=""
			bind:value={mainCategoryId}
			items={selectItems}
		/>
		<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
			Utilisée pour l'URL et le fil d'Ariane de la fiche produit.
		</p>
	</div>

	<div>
		<div class="mb-2 flex items-center justify-between">
			<Label>Catégories associées</Label>
			{#if selectedCats.length > 0}
				<button
					type="button"
					onclick={() => (selectedIds = [])}
					class="text-xs text-gray-500 underline hover:text-red-600 dark:text-gray-400"
				>
					Tout retirer
				</button>
			{/if}
		</div>

		<!--
			Récapitulatif des catégories cochées. Avec plusieurs milliers de
			catégories, une case cochée au fond de l'arbre est invisible : ces puces
			donnent l'état de la sélection en un coup d'œil.
		-->
		<div
			class="mb-2 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800"
		>
			{#if selectedCats.length === 0}
				<p class="text-sm text-gray-500 dark:text-gray-400">
					Aucune catégorie associée. Cochez-en dans l'arborescence ci-dessous.
				</p>
			{:else}
				<div class="flex flex-wrap gap-2">
					{#each selectedCats as cat (cat.id)}
						<span
							class="inline-flex items-center gap-1.5 rounded-full border border-cyan-200 bg-cyan-50 py-1 ps-3 pe-1 text-sm text-cyan-900 dark:border-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-100"
						>
							{cat.path}
							<button
								type="button"
								onclick={() => toggle(cat.id, false)}
								title="Retirer {cat.path}"
								aria-label="Retirer {cat.path}"
								class="rounded-full p-0.5 text-cyan-700 hover:bg-cyan-600 hover:text-white dark:text-cyan-200"
							>
								<CloseOutline class="h-3.5 w-3.5" />
							</button>
						</span>
					{/each}
				</div>
			{/if}
		</div>

		<Input bind:value={search} placeholder="Rechercher une catégorie…" class="mb-2" />

		<div
			class="max-h-72 overflow-y-auto rounded-lg border border-gray-200 p-3 dark:border-gray-700"
		>
			{#if roots.length === 0}
				<p class="text-sm text-gray-500 dark:text-gray-400">Aucune catégorie disponible.</p>
			{:else}
				{@render tree(roots, 0)}
			{/if}
		</div>

		<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
			{selectedCats.length} catégorie{selectedCats.length > 1 ? 's' : ''} associée{selectedCats.length >
			1
				? 's'
				: ''} en plus de la principale.
		</p>
	</div>
</div>

{#snippet tree(nodes: Cat[], depth: number)}
	{#each nodes as cat (cat.id)}
		{#if matches(cat)}
			{@const kids = kidsOf(cat.id)}
			{@const isMain = cat.id === mainId}
			<div style="padding-left: {depth * 1.25}rem">
				<Checkbox
					name="categoryIds"
					value={String(cat.id)}
					checked={isMain || selectedIds.includes(cat.id)}
					disabled={isMain}
					onchange={(e) => toggle(cat.id, (e.currentTarget as HTMLInputElement).checked)}
					class="py-1"
				>
					<span class="text-sm">
						{cat.name}
						{#if isMain}
							<span class="ms-1 text-xs text-cyan-600">(principale)</span>
						{/if}
					</span>
				</Checkbox>
			</div>
			{#if kids.length > 0}
				{@render tree(kids, depth + 1)}
			{/if}
		{/if}
	{/each}
{/snippet}
