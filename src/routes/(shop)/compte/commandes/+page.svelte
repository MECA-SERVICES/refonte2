<script lang="ts">
	import Panel from '$lib/components/shop/Panel.svelte';
	import Breadcrumb from '$lib/components/shop/Breadcrumb.svelte';
	import Heading from '$lib/components/shop/Heading.svelte';
	import ShopButton from '$lib/components/shop/ShopButton.svelte';
	import Pagination from '$lib/components/shop/Pagination.svelte';
	import { TruckOutline } from 'flowbite-svelte-icons';
	import { formatPrice } from '$lib/shop';
	import { priceSuffix } from '$lib/tax';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	/** Mode d'affichage du client : TTC au particulier, HT au professionnel (P2). */
	const suffix = $derived(priceSuffix(data.tax.displayMode));
	const amountOf = (o: (typeof data.orders)[number]) =>
		data.tax.displayMode === 'ht' ? o.totalHt : o.totalTtc;

	const dateFormat = new Intl.DateTimeFormat('fr-FR', {
		day: '2-digit',
		month: 'long',
		year: 'numeric'
	});
</script>

<svelte:head>
	<title>Mes commandes — MS Shop</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<Breadcrumb items={[{ label: 'Mon compte', href: '/compte' }, { label: 'Mes commandes' }]} />

<h1 class="font-display text-2xl font-extrabold tracking-[-0.02em] text-shop-ink sm:text-[30px]">
	Mes commandes
</h1>
<p class="mt-1 text-sm text-shop-muted">
	{#if data.total > 0}
		{data.total} commande{data.total > 1 ? 's' : ''} passée{data.total > 1 ? 's' : ''}.
	{:else}
		Vous n'avez pas encore passé de commande.
	{/if}
</p>

{#if data.orders.length === 0}
	<Panel class="mt-6 p-6">
		<Heading size="card">Aucune commande</Heading>
		<p class="mt-2 max-w-[52ch] text-[14.5px] text-shop-muted">
			Vos commandes s'afficheront ici, avec leur suivi et leurs documents.
		</p>
		<div class="mt-5">
			<ShopButton variant="primary" href="/recherche">Parcourir le catalogue</ShopButton>
		</div>
	</Panel>
{:else}
	<div class="mt-6 space-y-4">
		{#each data.orders as item (item.id)}
			<Panel class="p-5">
				<div class="flex flex-wrap items-start justify-between gap-4">
					<div class="min-w-0">
						<div class="flex flex-wrap items-center gap-2.5">
							<a
								href="/compte/commandes/{item.id}"
								class="font-display text-[15px] font-bold text-shop-ink hover:text-shop-blue"
							>
								{item.reference}
							</a>
							<span
								class="rounded-full px-2.5 py-1 font-display text-[11px] font-extrabold tracking-[0.06em] text-white uppercase"
								style="background-color: {item.stateColor ?? '#314192'}"
							>
								{item.stateLabel}
							</span>
						</div>

						<p class="mt-1.5 text-[13.5px] text-shop-muted">
							Passée le {dateFormat.format(item.createdAt)}
						</p>

						{#if item.isShipped && item.trackingNumber}
							<p class="mt-1.5 flex items-center gap-1.5 text-[13.5px] text-shop-muted">
								<TruckOutline class="h-4 w-4 text-shop-blue" />
								Suivi :
								{#if item.trackingUrl}
									<a
										href={item.trackingUrl}
										target="_blank"
										rel="noopener"
										class="font-semibold text-shop-blue hover:underline"
									>
										{item.trackingNumber}
									</a>
								{:else}
									<span class="font-semibold text-shop-ink">{item.trackingNumber}</span>
								{/if}
							</p>
						{/if}
					</div>

					<div class="flex shrink-0 flex-col items-end gap-2">
						<p class="font-display text-lg font-extrabold text-shop-red">
							{formatPrice(amountOf(item))}
							<span class="text-[13px] font-bold text-shop-muted">{suffix}</span>
						</p>
						<ShopButton variant="outline" size="sm" href="/compte/commandes/{item.id}">
							Voir le détail
						</ShopButton>
					</div>
				</div>
			</Panel>
		{/each}
	</div>

	<Pagination page={data.page} hasNextPage={data.hasNextPage} />
{/if}
