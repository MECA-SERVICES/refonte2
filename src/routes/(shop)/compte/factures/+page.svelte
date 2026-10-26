<script lang="ts">
	import Breadcrumb from '$lib/components/shop/Breadcrumb.svelte';
	import Heading from '$lib/components/shop/Heading.svelte';
	import Panel from '$lib/components/shop/Panel.svelte';
	import { formatPrice } from '$lib/money';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const date = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' });
</script>

<svelte:head>
	<title>Mes factures — MS Shop</title>
</svelte:head>

<Breadcrumb items={[{ label: 'Mon compte', href: '/compte' }, { label: 'Mes factures' }]} />

<h1 class="font-display text-2xl font-extrabold tracking-[-0.02em] text-shop-ink sm:text-[30px]">
	Mes factures
</h1>

{#if data.invoices.length === 0}
	<Panel class="mt-5 p-8 text-center" tone="subtle">
		<Heading as="p" size="card">Aucune facture pour l'instant.</Heading>
		<p class="mt-1 text-sm text-shop-muted">Les factures de vos commandes apparaîtront ici.</p>
	</Panel>
{:else}
	<!-- Demande client 12.8 : les seules factures, sans le détail des commandes. -->
	<ul class="mt-5 space-y-3">
		{#each data.invoices as invoice (invoice.id)}
			<li>
				<Panel class="flex flex-wrap items-center justify-between gap-3 p-5">
					<div class="min-w-0">
						<p class="font-display text-base font-bold text-shop-ink">Facture {invoice.number}</p>
						<p class="mt-0.5 text-sm text-shop-muted">
							{date.format(new Date(invoice.issuedAt))} · commande
							<a href="/compte/commandes/{invoice.orderId}" class="underline underline-offset-2">
								{invoice.orderReference}
							</a>
						</p>
					</div>
					<div class="flex items-center gap-4">
						<span class="font-display text-base font-extrabold text-shop-ink">
							{formatPrice(invoice.totalTtc)}
						</span>
						<a
							href="/compte/commandes/{invoice.orderId}/facture"
							target="_blank"
							rel="noopener"
							class="rounded-[10px] border-[1.5px] border-shop-border px-4 py-2 font-display text-sm font-bold text-shop-ink transition-colors hover:border-shop-blue hover:text-shop-blue"
						>
							Télécharger (PDF)
						</a>
					</div>
				</Panel>
			</li>
		{/each}
	</ul>
{/if}
