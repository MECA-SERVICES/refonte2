<script lang="ts">
	import { enhance } from '$lib/components/admin/feedback.svelte';
	import { Button, Card, Input } from 'flowbite-svelte';
	import { TrashBinOutline } from 'flowbite-svelte-icons';
	import { formatNumber, formatPrice } from '$lib/money';
	import {
		ActiveBadge,
		ConfirmDialog,
		ContactsCard,
		PageHeader,
		Pagination,
		StateBadge,
		SupplierForm,
		listFilterHref
	} from '$lib/components/admin';
	import type { PageProps } from './$types';

	/**
	 * Fiche fournisseur (CDC 11, § 5.3) : coordonnées et notes internes, puis
	 * les produits qu'il approvisionne avec ses conditions (référence, prix
	 * d'achat, délai, quantité minimale), par pages.
	 */

	let { data, form }: PageProps = $props();

	const s = $derived(data.supplier);
	let confirmOpen = $state(false);
	let deleteForm = $state<HTMLFormElement | null>(null);
</script>

<svelte:head><title>{s.name} · Fournisseurs</title></svelte:head>

<PageHeader
	title={s.name}
	subtitle="{formatNumber(data.linked)} produit{data.linked > 1
		? 's'
		: ''} approvisionné{data.linked > 1 ? 's' : ''}, fournisseur principal de {formatNumber(
		data.main
	)}"
	crumbs={[
		{ label: 'Accueil', href: '/admin' },
		{ label: 'Fournisseurs', href: '/admin/suppliers' },
		{ label: s.name }
	]}
>
	{#snippet actions()}
		<ActiveBadge active={s.isActive} />
		{#if !data.linked && !data.main}
			<Button color="red" onclick={() => (confirmOpen = true)}>
				<TrashBinOutline class="me-2 h-4 w-4" /> Supprimer
			</Button>
		{/if}
	{/snippet}
</PageHeader>

<div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] xl:items-start">
	<div class="space-y-6">
		<SupplierForm supplier={s} action="?/update" message={form?.message} />
		<ContactsCard contacts={data.contacts} />
	</div>

	<Card class="max-w-none p-5">
		<div class="mb-4 flex flex-wrap items-center justify-between gap-3">
			<h2 class="text-lg font-semibold text-gray-900">Produits approvisionnés</h2>
			<form method="GET" class="flex gap-2">
				<Input
					type="search"
					name="q"
					value={data.q}
					size="sm"
					placeholder="Référence, nom ou réf. fournisseur"
					aria-label="Chercher un produit du fournisseur"
					class="w-64"
				/>
				<Button type="submit" size="sm" color="alternative">Chercher</Button>
			</form>
		</div>
		<div class="overflow-x-auto">
			<table class="w-full text-sm">
				<thead class="border-b border-gray-200 text-xs text-gray-600 uppercase">
					<tr>
						<th scope="col" class="py-2 pe-3 text-start">Produit</th>
						<th scope="col" class="px-2 py-2 text-start">Réf. fournisseur</th>
						<th scope="col" class="px-2 py-2 text-end">Prix d'achat HT</th>
						<th scope="col" class="px-2 py-2 text-end">Délai</th>
						<th scope="col" class="px-2 py-2 text-end">Qté min.</th>
						<th scope="col" class="px-2 py-2 text-end">Stock</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-gray-100">
					{#each data.products.rows as p (p.productId)}
						<tr class="align-top">
							<td class="py-2 pe-3">
								<a href="/admin/products/{p.productId}" class="font-medium hover:underline"
									>{p.name}</a
								>
								<span class="block text-xs text-gray-500">
									{p.reference}{p.isActive ? '' : ' · hors boutique'}
								</span>
								{#if p.isMain}<StateBadge color="green" label="Principal" class="mt-1" />{/if}
							</td>
							<td class="px-2 py-2 font-mono text-xs">{p.supplierReference ?? ''}</td>
							<td class="px-2 py-2 text-end tabular-nums"
								>{p.purchasePrice ? formatPrice(p.purchasePrice) : ''}</td
							>
							<td class="px-2 py-2 text-end tabular-nums"
								>{p.deliveryDays !== null ? `${p.deliveryDays} j` : ''}</td
							>
							<td class="px-2 py-2 text-end tabular-nums">{p.minQuantity ?? ''}</td>
							<td class="px-2 py-2 text-end tabular-nums">{p.stock}</td>
						</tr>
					{:else}
						<tr
							><td colspan="6" class="py-8 text-center text-gray-500"
								>Aucun produit {data.q ? 'ne correspond' : 'rattaché'}.</td
							></tr
						>
					{/each}
				</tbody>
			</table>
		</div>
		<Pagination
			page={data.products.page}
			pageCount={data.products.pageCount}
			total={data.products.total}
			hrefFor={(page) =>
				listFilterHref(`/admin/suppliers/${s.id}`, [
					['q', data.q],
					['page', page]
				])}
		/>
	</Card>
</div>

<form
	method="POST"
	action="?/delete"
	bind:this={deleteForm}
	use:enhance
	data-success="Fournisseur supprimé."
	class="hidden"
></form>
<ConfirmDialog
	bind:open={confirmOpen}
	title="Supprimer le fournisseur"
	message="Ce fournisseur n'approvisionne aucun produit : il sera définitivement supprimé."
	confirmLabel="Supprimer"
	onconfirm={() => deleteForm?.requestSubmit()}
/>
