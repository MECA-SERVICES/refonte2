<script lang="ts">
	import { enhance } from '$lib/components/admin/feedback.svelte';
	import { untrack } from 'svelte';
	import { page } from '$app/state';
	import { Button, Card, Input, Label, Modal, Toggle } from 'flowbite-svelte';
	import { EditOutline, PlusOutline, TrashBinOutline } from 'flowbite-svelte-icons';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { formatNumber } from '$lib/money';
	import {
		deletionBlockerOf,
		locationScore,
		normalizeSearch,
		subtreeIds,
		subtreeQuantities
	} from '$lib/stock-locations';
	import { LocationPicker, PageHeader, StateBadge } from '$lib/components/admin';
	import type { PageProps } from './$types';

	/**
	 * Paramètres › Emplacements de stock : la structure du magasin. Chaque
	 * emplacement se modifie dans une fenêtre (nom, code, parent, actif) ; la
	 * suppression explique ce qui l'empêche avant de proposer la désactivation.
	 */

	let { data }: PageProps = $props();

	type Location = (typeof data.locations)[number];

	const byId = $derived(new Map(data.locations.map((l) => [l.id, l])));
	const totals = $derived(subtreeQuantities(data.locations));
	const childCount = $derived.by(() => {
		const counts: Record<number, number> = {};
		for (const l of data.locations) {
			const parent = l.ancestorIds.at(-1);
			if (parent !== undefined) counts[parent] = (counts[parent] ?? 0) + 1;
		}
		return counts;
	});
	const pickerLocations = $derived(
		data.locations.map((l) => ({ ...l, total: totals.get(l.id) ?? 0 }))
	);

	let filter = $state('');
	const rows = $derived(
		filter.trim()
			? data.locations
					.map((l, order) => ({ l, order, score: locationScore(filter, l) }))
					.filter((r) => r.score !== null)
					.sort((a, b) => a.score! - b.score! || a.order - b.order)
					.map((r) => r.l)
			: data.locations
	);

	function blockerOf(l: Location) {
		return deletionBlockerOf({ ...l, children: childCount[l.id] ?? 0, units: l.quantity });
	}

	// ----- Fenêtre de création / modification -----

	let editOpen = $state(false);
	let editing = $state<Location | null>(null);
	let name = $state('');
	let code = $state('');
	let description = $state('');
	let parentId = $state<number | null>(null);
	let active = $state(true);
	let priceOnLabel = $state(false);

	function openEditor(location: Location | null, parent: number | null = null) {
		editing = location;
		name = location?.name ?? '';
		code = location?.code ?? '';
		description = location?.description ?? '';
		parentId = location ? (location.ancestorIds.at(-1) ?? null) : parent;
		active = location?.isActive ?? true;
		priceOnLabel = location?.priceOnLabel ?? false;
		editOpen = true;
	}

	/** Lien « Gérer cet emplacement » depuis le stock : `?id=` ouvre sa fiche. */
	const requestedId = $derived(Number(page.url.searchParams.get('id')) || null);
	$effect(() => {
		const id = requestedId;
		// Une fois ouverte, la fiche ne se rouvre pas à chaque rechargement des données.
		untrack(() => {
			const target = id === null ? undefined : byId.get(id);
			if (target) openEditor(target);
		});
	});

	/** Le code est unique : l'emplacement qui le porte déjà, s'il y en a un. */
	const codeOwner = $derived.by(() => {
		const wanted = normalizeSearch(code.trim());
		if (!wanted) return null;
		return (
			data.locations.find(
				(l) => l.id !== editing?.id && normalizeSearch(l.code ?? '') === wanted
			) ?? null
		);
	});

	const closeOnSuccess: SubmitFunction =
		() =>
		async ({ result, update }) => {
			await update();
			if (result.type === 'success') editOpen = false;
		};

	// ----- Suppression -----

	let deleteOpen = $state(false);
	let deleting = $state<Location | null>(null);
	const deleteBlocker = $derived(deleting ? blockerOf(deleting) : null);
	const closeDelete: SubmitFunction =
		() =>
		async ({ result, update }) => {
			await update();
			if (result.type === 'success') deleteOpen = false;
		};
</script>

<svelte:head><title>Emplacements de stock · Paramètres</title></svelte:head>

<PageHeader
	title="Emplacements de stock"
	subtitle="Structure du magasin : créer, renommer, ranger, désactiver ou supprimer un emplacement. Les produits se rangent depuis Catalogue › Emplacements de stock."
	crumbs={[
		{ label: 'Accueil', href: '/admin' },
		{ label: 'Paramètres de la boutique' },
		{ label: 'Emplacements de stock' }
	]}
>
	{#snippet actions()}
		<Button color="alternative" href="/admin/stock-locations">Voir le stock</Button>
		<Button onclick={() => openEditor(null)}>
			<PlusOutline class="me-2 h-4 w-4" /> Nouvel emplacement
		</Button>
	{/snippet}
</PageHeader>

<Card class="max-w-none p-4">
	<div class="mb-4 flex flex-wrap items-center justify-between gap-3">
		<Input
			type="search"
			bind:value={filter}
			placeholder="Filtrer : code (4372) ou nom (droite 43 r7)"
			aria-label="Filtrer les emplacements"
			class="w-80"
		/>
		<p class="text-sm text-gray-500">
			{formatNumber(rows.length)} emplacement{rows.length > 1 ? 's' : ''}
			{filter.trim() ? `sur ${formatNumber(data.locations.length)}` : ''}
		</p>
	</div>

	<div class="overflow-x-auto">
		<table class="w-full text-sm">
			<thead class="border-b border-gray-200 text-xs text-gray-600 uppercase">
				<tr>
					<th scope="col" class="py-2 pe-3 text-start">Emplacement</th>
					<th scope="col" class="px-3 py-2 text-start">Code</th>
					<th scope="col" class="px-3 py-2 text-start">Contenu</th>
					<th scope="col" class="px-3 py-2 text-start">Origine</th>
					<th scope="col" class="px-3 py-2 text-start">État</th>
					<th scope="col" class="py-2 ps-3"><span class="sr-only">Actions</span></th>
				</tr>
			</thead>
			<tbody class="divide-y divide-gray-100">
				{#each rows as l (l.id)}
					{@const units = totals.get(l.id) ?? 0}
					{@const kids = childCount[l.id] ?? 0}
					<tr class="hover:bg-gray-50 {l.isActive ? '' : 'text-gray-500'}">
						<td
							class="py-2 pe-3"
							style:padding-inline-start={filter.trim() ? undefined : `${l.depth * 1.25}rem`}
						>
							{#if filter.trim() && l.depth > 0}
								<span class="block text-xs text-gray-500">
									{l.path.slice(0, l.path.length - l.name.length - 3)}
								</span>
							{/if}
							<span class="font-medium {l.isActive ? 'text-gray-900' : 'line-through'}"
								>{l.name}</span
							>
							{#if l.priceOnLabel}
								<StateBadge color="yellow" label="Prix sur étiquette" class="ms-2" />
							{/if}
						</td>
						<td class="px-3 py-2 font-mono text-xs">
							<span class="cursor-help" title={l.description ?? l.path}>{l.code ?? '—'}</span>
						</td>
						<td class="px-3 py-2 text-gray-600">
							{units ? `${formatNumber(units)} u.` : 'Vide'}{kids
								? ` · ${kids} sous-emplacement${kids > 1 ? 's' : ''}`
								: ''}
						</td>
						<td class="px-3 py-2 text-gray-600">{l.legacyDoliId ? 'Dolibarr' : 'MSShop'}</td>
						<td class="px-3 py-2">
							<StateBadge
								color={l.isActive ? 'green' : 'gray'}
								label={l.isActive ? 'Actif' : 'Désactivé'}
							/>
						</td>
						<td class="py-2 ps-3">
							<div class="flex justify-end gap-1.5">
								<Button size="xs" color="alternative" onclick={() => openEditor(l)}>
									<EditOutline class="me-1 h-3.5 w-3.5" /> Modifier
								</Button>
								<Button
									size="xs"
									color="alternative"
									onclick={() => openEditor(null, l.id)}
									aria-label="Ajouter un sous-emplacement à {l.path}"
									title="Ajouter un sous-emplacement"
								>
									<PlusOutline class="h-3.5 w-3.5" />
								</Button>
								<Button
									size="xs"
									color="alternative"
									onclick={() => {
										deleting = l;
										deleteOpen = true;
									}}
									aria-label="Supprimer {l.path}"
									title="Supprimer"
								>
									<TrashBinOutline class="h-3.5 w-3.5" />
								</Button>
							</div>
						</td>
					</tr>
				{:else}
					<tr><td colspan="6" class="py-8 text-center text-gray-500">Aucun emplacement.</td></tr>
				{/each}
			</tbody>
		</table>
	</div>
</Card>

<Modal
	bind:open={editOpen}
	size="md"
	title={editing ? `Modifier « ${editing.name} »` : 'Nouvel emplacement'}
>
	<form
		method="POST"
		action={editing ? '?/update' : '?/create'}
		use:enhance={closeOnSuccess}
		data-success={editing ? 'Emplacement modifié.' : 'Emplacement créé.'}
		class="space-y-4"
	>
		{#if editing}<input type="hidden" name="id" value={editing.id} />{/if}
		<div>
			<Label class="mb-2">Rangé dans</Label>
			<LocationPicker
				locations={pickerLocations}
				name="parentId"
				bind:value={parentId}
				label="Emplacement parent"
				rootLabel="— Emplacement principal (racine) —"
				exclude={editing ? subtreeIds(data.locations, editing.id) : []}
			/>
		</div>
		<div class="grid gap-4 sm:grid-cols-[minmax(0,1fr)_9rem]">
			<div>
				<Label for="location-name" class="mb-2">Nom</Label>
				<Input
					id="location-name"
					name="name"
					bind:value={name}
					required
					placeholder="ex. BOITE 6"
				/>
			</div>
			<div>
				<Label for="location-code" class="mb-2">Code d'étiquette</Label>
				<Input
					id="location-code"
					name="code"
					bind:value={code}
					placeholder="ex. 4376"
					color={codeOwner ? 'red' : undefined}
					aria-describedby="location-code-help"
				/>
			</div>
		</div>
		<p id="location-code-help" class="text-xs {codeOwner ? 'text-red-700' : 'text-gray-500'}">
			{#if codeOwner}
				Ce code est déjà celui de « {codeOwner.path} ». Chaque code désigne un seul emplacement.
			{:else}
				Unique. Facultatif, mais c'est lui qu'on tape pour retrouver l'emplacement.
			{/if}
		</p>
		<div>
			<Label for="location-description" class="mb-2">Description</Label>
			<Input
				id="location-description"
				name="description"
				bind:value={description}
				placeholder="ex. MAGASIN PIECES DETACHEES / PARTIE DROITE / ETAGERE 43 / RANGEE 7 / BOITE 6"
			/>
			<p class="mt-1 text-xs text-gray-500">
				Affichée au survol du code, comme dans Dolibarr. Vide : le chemin dans l'arbre.
			</p>
		</div>
		<input type="hidden" name="priceOnLabel" value={String(priceOnLabel)} />
		<Toggle bind:checked={priceOnLabel}>
			Emplacement de vente : prix TTC sur l'étiquette des produits rangés ici (et dessous)
		</Toggle>
		{#if editing}
			<input type="hidden" name="isActive" value={String(active)} />
			<Toggle bind:checked={active}>
				{active
					? 'Actif : proposé pour ranger des produits'
					: 'Désactivé : plus proposé au rangement'}
			</Toggle>
		{/if}
		<div class="flex justify-end gap-3 border-t border-gray-200 pt-4">
			<Button color="alternative" onclick={() => (editOpen = false)}>Annuler</Button>
			<Button type="submit" disabled={!name.trim() || codeOwner !== null}>
				{editing ? 'Enregistrer' : "Créer l'emplacement"}
			</Button>
		</div>
	</form>
</Modal>

<Modal bind:open={deleteOpen} size="sm" title="Supprimer un emplacement">
	{#if deleting}
		<p class="mb-1 text-sm text-gray-500">{deleting.path}</p>
		{#if deleteBlocker}
			<p class="mb-5 text-sm text-gray-800">
				<strong>Suppression impossible.</strong>
				{deleteBlocker}
			</p>
			<div class="flex justify-end gap-3">
				<Button color="alternative" onclick={() => (deleteOpen = false)}>Fermer</Button>
				{#if deleting.isActive}
					<form
						method="POST"
						action="?/update"
						use:enhance={closeDelete}
						data-success="Emplacement désactivé."
					>
						<input type="hidden" name="id" value={deleting.id} />
						<input type="hidden" name="name" value={deleting.name} />
						<input type="hidden" name="code" value={deleting.code ?? ''} />
						<input type="hidden" name="description" value={deleting.description ?? ''} />
						<input type="hidden" name="priceOnLabel" value={String(deleting.priceOnLabel)} />
						<input type="hidden" name="parentId" value={deleting.ancestorIds.at(-1) ?? ''} />
						<input type="hidden" name="isActive" value="false" />
						<Button type="submit">Désactiver à la place</Button>
					</form>
				{/if}
			</div>
		{:else}
			<p class="mb-5 text-sm text-gray-800">
				Supprimer « {deleting.name} » ? Il est vide et sans historique ; la suppression est définitive.
			</p>
			<form
				method="POST"
				action="?/delete"
				use:enhance={closeDelete}
				data-success="Emplacement supprimé."
				class="flex justify-end gap-3"
			>
				<input type="hidden" name="id" value={deleting.id} />
				<Button color="alternative" onclick={() => (deleteOpen = false)}>Annuler</Button>
				<Button type="submit" color="red">Supprimer</Button>
			</form>
		{/if}
	{/if}
</Modal>
