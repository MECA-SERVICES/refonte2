<script lang="ts">
	import { enhance } from '$lib/components/admin/feedback.svelte';
	import { Button, Card } from 'flowbite-svelte';
	import { PrinterOutline } from 'flowbite-svelte-icons';
	import { formatNumber } from '$lib/money';
	import { DOLIBARR_STOCK_COLORS as COLORS } from '$lib/admin-colors';
	import { reasonLabel, VOUCHER_KINDS } from '$lib/stock-vouchers';
	import {
		ConditionBadge,
		ConfirmDialog,
		PageHeader,
		StateBadge,
		Thumbnail
	} from '$lib/components/admin';
	import type { PageProps } from './$types';

	/** Un bon d'entrée ou de sortie : ses lignes, ses étiquettes, son annulation. */

	let { data }: PageProps = $props();

	const meta = $derived(VOUCHER_KINDS[data.slug]);
	const v = $derived(data.voucher);
	const isReceipt = $derived(v.kind === 'receipt');
	const byId = $derived(new Map(data.locations.map((l) => [l.id, l])));
	const dateFmt = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short' });
	const units = $derived(
		data.lines.filter((l) => !l.note).reduce((s, l) => s + Math.abs(l.quantity), 0)
	);
	const canCancel = $derived(!v.cancelledAt && !v.legacyDoliKey);

	let confirmOpen = $state(false);
	let cancelForm = $state<HTMLFormElement | null>(null);
</script>

<svelte:head><title>{meta.one} {v.reference ?? v.id} · Administration</title></svelte:head>

<PageHeader
	title="{isReceipt ? 'Réception' : 'Sortie'} {v.reference ?? `n° ${v.id}`}"
	subtitle="{dateFmt.format(new Date(v.createdAt))} · {isReceipt
		? (v.supplier ?? 'fournisseur non précisé')
		: `motif ${reasonLabel(v.reason).toLowerCase()}`} · {formatNumber(units)} pièce{units > 1
		? 's'
		: ''}"
	crumbs={[
		{ label: 'Accueil', href: '/admin' },
		{ label: meta.title, href: `/admin/stock/vouchers/${data.slug}` },
		{ label: v.reference ?? `n° ${v.id}` }
	]}
>
	{#snippet actions()}
		{#if v.cancelledAt}<StateBadge color="gray" label="Annulé" />{/if}
		{#if v.legacyDoliKey}<span class="text-sm text-gray-500">Repris de Dolibarr</span>{/if}
		{#if isReceipt && data.labelIds.length && !v.cancelledAt}
			<Button
				color="alternative"
				href="/admin/products/labels?ids={data.labelIds.join(',')}"
				target="_blank"
			>
				<PrinterOutline class="me-2 h-4 w-4" /> Étiquettes ({data.labelIds.length})
			</Button>
		{/if}
		{#if canCancel}
			<Button color="alternative" onclick={() => (confirmOpen = true)}>Annuler le bon</Button>
		{/if}
	{/snippet}
</PageHeader>

{#if v.note}<p class="mb-4 text-sm text-gray-700">{v.note}</p>{/if}

<Card class="max-w-none p-0">
	<table class="w-full text-sm">
		<thead class="border-b border-gray-200 text-xs text-gray-600 uppercase">
			<tr>
				<th scope="col" class="px-4 py-3 text-start">Produit</th>
				<th scope="col" class="px-4 py-3 text-start">Emplacement</th>
				<th scope="col" class="px-4 py-3 text-start">N° de série</th>
				<th scope="col" class="px-4 py-3 text-end">Quantité</th>
			</tr>
		</thead>
		<tbody class="divide-y divide-gray-100">
			{#each data.lines as line (line.id)}
				{@const at = line.locationId ? byId.get(line.locationId) : null}
				<tr class={line.note ? 'text-gray-500' : ''}>
					<td class="px-4 py-2">
						<div class="flex items-center gap-3">
							<Thumbnail src={line.imageUrl} alt={line.name} size="sm" />
							<div class="min-w-0">
								<a href="/admin/products/{line.productId}" class="font-medium hover:underline"
									>{line.name}</a
								>
								<p class="text-xs text-gray-500">
									Réf. {line.reference}{line.note ? ` · ${line.note}` : ''}
								</p>
							</div>
						</div>
					</td>
					<td class="px-4 py-2">
						{#if at}
							<a
								href="/admin/stock-locations?id={at.id}"
								class="cursor-help font-mono text-xs hover:underline"
								title={at.description ?? at.path}>{at.code ?? at.path}</a
							>
						{:else}
							<span class="text-xs text-gray-400">—</span>
						{/if}
						<ConditionBadge condition={line.condition} class="ms-1" />
					</td>
					<td class="px-4 py-2 font-mono text-xs">{line.serialNumber ?? ''}</td>
					<td
						class="px-4 py-2 text-end font-semibold text-gray-900 tabular-nums"
						style:background-color={line.quantity > 0 ? COLORS.inStock : COLORS.outOfStock}
					>
						{line.quantity > 0 ? '+' : ''}{line.quantity}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</Card>

{#if canCancel}
	<form
		bind:this={cancelForm}
		method="POST"
		action="?/cancel"
		use:enhance
		data-success="Bon annulé : le stock a été remis comme avant."
		class="hidden"
	></form>
	<ConfirmDialog
		bind:open={confirmOpen}
		title="Annuler le bon"
		message="Chaque ligne sera contrepassée : le stock revient comme avant ce bon. Impossible si les pièces ont déjà bougé depuis."
		confirmLabel="Annuler le bon"
		onconfirm={() => cancelForm?.requestSubmit()}
	/>
{/if}
