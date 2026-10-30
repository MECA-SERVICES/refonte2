<script lang="ts">
	import { enhance } from '$lib/components/admin/feedback.svelte';
	import { Button, Card, Input, Label, Textarea, Toggle } from 'flowbite-svelte';
	import { PlusOutline } from 'flowbite-svelte-icons';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { formatPrice } from '$lib/money';
	import { ActiveBadge, PageHeader } from '$lib/components/admin';
	import type { FixedAsset } from '$lib/server/db/fixed-asset.schema';
	import type { PageProps } from './$types';

	/**
	 * Immobilisations (module UTILE de Dolibarr) : outillage et matériel de
	 * l'atelier, du magasin et de l'activité paysage, avec leur prix d'achat.
	 * Une sortie de stock « Investissement » en ajoute une par pièce.
	 */

	let { data }: PageProps = $props();

	const dateFmt = new Intl.DateTimeFormat('fr-FR');
	let editing = $state<number | null>(null);
	let adding = $state(false);

	const closeOnSuccess: SubmitFunction =
		() =>
		async ({ result, update }) => {
			await update();
			if (result.type === 'success') {
				editing = null;
				adding = false;
			}
		};
</script>

<svelte:head><title>Immobilisations · Administration</title></svelte:head>

<PageHeader
	title="Immobilisations"
	subtitle="Matériel de l'entreprise : atelier, magasin, paysage"
	crumbs={[{ label: 'Accueil', href: '/admin' }, { label: 'Immobilisations' }]}
>
	{#snippet actions()}
		{#if !adding}
			<Button onclick={() => (adding = true)}>
				<PlusOutline class="me-2 h-4 w-4" /> Nouvelle immobilisation
			</Button>
		{/if}
	{/snippet}
</PageHeader>

{#snippet fields(a: Partial<FixedAsset>, prefix: string)}
	<div class="grid gap-3 sm:grid-cols-4">
		<div class="sm:col-span-2">
			<Label for="{prefix}-name" class="mb-1 text-xs">Nom</Label>
			<Input id="{prefix}-name" name="name" size="sm" required value={a.name ?? ''} />
		</div>
		<div>
			<Label for="{prefix}-usage" class="mb-1 text-xs">Usage</Label>
			<Input
				id="{prefix}-usage"
				name="usage"
				size="sm"
				list="fixed-asset-usages"
				value={a.usage ?? ''}
			/>
		</div>
		<div>
			<Label for="{prefix}-date" class="mb-1 text-xs">Acquise le</Label>
			<Input
				id="{prefix}-date"
				name="acquiredOn"
				type="date"
				size="sm"
				value={a.acquiredOn ?? ''}
			/>
		</div>
		<div class="sm:col-span-2">
			<Label for="{prefix}-desc" class="mb-1 text-xs">Désignation, n° de série</Label>
			<Textarea id="{prefix}-desc" name="description" rows={2} value={a.description ?? ''} />
		</div>
		<div>
			<Label for="{prefix}-price" class="mb-1 text-xs">Prix d'achat HT</Label>
			<Input
				id="{prefix}-price"
				name="purchasePrice"
				size="sm"
				inputmode="decimal"
				value={a.purchasePrice ? String(Number(a.purchasePrice)) : ''}
			/>
		</div>
		<div>
			<Label for="{prefix}-book" class="mb-1 text-xs">Valeur comptable</Label>
			<Input
				id="{prefix}-book"
				name="bookValue"
				size="sm"
				inputmode="decimal"
				value={a.bookValue ? String(Number(a.bookValue)) : ''}
			/>
		</div>
		<div class="sm:col-span-4">
			<Toggle name="isActive" checked={a.isActive ?? true}>En service</Toggle>
		</div>
	</div>
{/snippet}

<datalist id="fixed-asset-usages">
	{#each data.usageOptions as u (u)}<option value={u}></option>{/each}
</datalist>

{#if data.usages.length}
	<div class="mb-4 grid gap-4 sm:grid-cols-3">
		{#each data.usages as u (u.usage)}
			<Card class="max-w-none p-4">
				<p class="text-sm text-gray-500">{u.usage}</p>
				<p class="text-xl font-semibold text-gray-900 tabular-nums">{formatPrice(u.total)}</p>
				<p class="text-xs text-gray-500">{u.count} en service</p>
			</Card>
		{/each}
	</div>
{/if}

{#if adding}
	<Card class="mb-4 max-w-none p-5">
		<h2 class="mb-3 text-lg font-semibold text-gray-900">Nouvelle immobilisation</h2>
		<form
			method="POST"
			action="?/create"
			use:enhance={closeOnSuccess}
			data-success="Immobilisation ajoutée."
		>
			{@render fields({}, 'new')}
			<div class="mt-3 flex gap-2">
				<Button type="submit" size="sm">Ajouter</Button>
				<Button size="sm" color="alternative" onclick={() => (adding = false)}>Annuler</Button>
			</div>
		</form>
	</Card>
{/if}

<Card class="max-w-none p-0">
	{#if data.assets.length === 0}
		<p class="p-6 text-center text-sm text-gray-500">Aucune immobilisation.</p>
	{:else}
		<table class="w-full text-sm">
			<thead class="border-b border-gray-200 text-xs text-gray-600 uppercase">
				<tr>
					<th scope="col" class="px-4 py-3 text-start">Immobilisation</th>
					<th scope="col" class="px-4 py-3 text-start">Usage</th>
					<th scope="col" class="px-4 py-3 text-start">Acquise le</th>
					<th scope="col" class="px-4 py-3 text-end">Prix d'achat HT</th>
					<th scope="col" class="px-4 py-3 text-start">Statut</th>
					<th scope="col" class="px-4 py-3"><span class="sr-only">Actions</span></th>
				</tr>
			</thead>
			<tbody class="divide-y divide-gray-100">
				{#each data.assets as a (a.id)}
					{#if editing === a.id}
						<tr>
							<td colspan="6" class="px-4 py-3">
								<form
									method="POST"
									action="?/update"
									use:enhance={closeOnSuccess}
									data-success="Immobilisation enregistrée."
								>
									<input type="hidden" name="id" value={a.id} />
									{@render fields(a, `asset-${a.id}`)}
									<div class="mt-3 flex flex-wrap gap-2">
										<Button type="submit" size="xs">Enregistrer</Button>
										<Button size="xs" color="alternative" onclick={() => (editing = null)}>
											Annuler
										</Button>
										<Button
											type="submit"
											formaction="?/delete"
											size="xs"
											color="red"
											class="ms-auto">Supprimer</Button
										>
									</div>
								</form>
							</td>
						</tr>
					{:else}
						<tr class="align-top hover:bg-gray-50">
							<td class="px-4 py-2.5">
								<span class="font-medium text-gray-900">{a.name}</span>
								{#if a.productId}
									<a
										href="/admin/products/{a.productId}"
										class="ms-1 text-xs text-primary-700 hover:underline">produit</a
									>
								{/if}
								{#if a.description}
									<span class="block text-xs whitespace-pre-line text-gray-500"
										>{a.description}</span
									>
								{/if}
							</td>
							<td class="px-4 py-2.5">{a.usage ?? '—'}</td>
							<td class="px-4 py-2.5 tabular-nums">
								{a.acquiredOn ? dateFmt.format(new Date(a.acquiredOn)) : '—'}
							</td>
							<td class="px-4 py-2.5 text-end tabular-nums">
								{a.purchasePrice ? formatPrice(a.purchasePrice) : '—'}
							</td>
							<td class="px-4 py-2.5"><ActiveBadge active={a.isActive} /></td>
							<td class="px-4 py-2.5 text-end">
								<Button size="xs" color="alternative" onclick={() => (editing = a.id)}>
									Modifier
								</Button>
							</td>
						</tr>
					{/if}
				{/each}
			</tbody>
		</table>
	{/if}
</Card>
