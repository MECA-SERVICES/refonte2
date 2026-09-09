<script lang="ts">
	import Panel from '$lib/components/shop/Panel.svelte';
	import Breadcrumb from '$lib/components/shop/Breadcrumb.svelte';
	import Heading from '$lib/components/shop/Heading.svelte';
	import SummaryRow from '$lib/components/shop/SummaryRow.svelte';
	import { formatPrice, shopProductPath } from '$lib/shop';
	import { priceSuffix } from '$lib/tax';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const order = $derived(data.order);
	const suffix = $derived(priceSuffix(data.tax.displayMode));

	/**
	 * Adresses figées à l'achat, stockées en JSON.
	 *
	 * Le carnet d'adresses a pu changer depuis : c'est bien la copie de la
	 * commande qui fait foi (R3).
	 */
	type FrozenAddress = {
		firstName?: string;
		lastName?: string;
		company?: string;
		line1?: string;
		line2?: string;
		postalCode?: string;
		city?: string;
		country?: string;
		phone?: string;
	};

	const shipping = $derived(order.shippingAddress as FrozenAddress | null);
	const billing = $derived(order.billingAddress as FrozenAddress | null);

	const dateFormat = new Intl.DateTimeFormat('fr-FR', {
		day: '2-digit',
		month: 'long',
		year: 'numeric'
	});
</script>

<svelte:head>
	<title>Commande {order.reference} — MS Shop</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<Breadcrumb
	items={[
		{ label: 'Mon compte', href: '/compte' },
		{ label: 'Mes commandes', href: '/compte/commandes' },
		{ label: order.reference }
	]}
/>

<div class="flex flex-wrap items-center gap-3">
	<h1 class="font-display text-2xl font-extrabold tracking-[-0.02em] text-shop-ink sm:text-[30px]">
		{order.reference}
	</h1>
	<span
		class="px-2.5 py-1 font-display text-[11px] font-bold tracking-wide text-white uppercase"
		style="background-color: {order.stateColor ?? '#314192'}"
	>
		{order.stateLabel}
	</span>
</div>
<p class="mt-1 text-sm text-shop-muted">
	Passée le {dateFormat.format(order.createdAt)}
	{#if order.deliveredAt}· Livrée le {dateFormat.format(order.deliveredAt)}{/if}
</p>

{#if order.trackingNumber}
	<Panel class="mt-5 p-4" tone="subtle">
		<p class="text-[14.5px] text-shop-ink">
			<span class="font-semibold">Suivi du colis :</span>
			{#if order.trackingUrl}
				<a
					href={order.trackingUrl}
					target="_blank"
					rel="noopener"
					class="font-semibold text-shop-blue hover:underline"
				>
					{order.trackingNumber}
				</a>
			{:else}
				{order.trackingNumber}
			{/if}
		</p>
	</Panel>
{/if}

<div class="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
	<!-- ================= Articles ================= -->
	<Panel class="p-5">
		<Heading size="card">Articles commandés</Heading>

		<ul class="mt-4 divide-y divide-shop-border-soft">
			{#each order.lines as line (line.id)}
				<li class="flex gap-4 py-4 first:pt-0 last:pb-0">
					<div class="min-w-0 flex-1">
						{#if line.productId && line.productSlug}
							<a
								href={shopProductPath({ id: line.productId, slug: line.productSlug })}
								class="font-semibold text-shop-ink hover:text-shop-blue"
							>
								{line.productName}
							</a>
						{:else}
							<span class="font-semibold text-shop-ink">{line.productName}</span>
						{/if}

						{#if line.productReference}
							<p class="mt-0.5 text-[13px] text-shop-muted">Réf. {line.productReference}</p>
						{/if}

						<p class="mt-1 text-[13.5px] text-shop-muted">
							{line.quantity} ×
							{formatPrice(data.tax.displayMode === 'ht' ? line.unitPriceHt : line.unitPriceTtc)}
							{suffix}
						</p>
					</div>

					<p class="shrink-0 font-display font-bold text-shop-ink">
						{formatPrice(data.tax.displayMode === 'ht' ? line.totalHt : line.totalTtc)}
						<span class="text-[12px] font-bold text-shop-muted">{suffix}</span>
					</p>
				</li>
			{/each}
		</ul>
	</Panel>

	<div class="space-y-6">
		<!-- ================= Totaux ================= -->
		<Panel class="p-5">
			<Heading size="card">Récapitulatif</Heading>

			<!-- La ventilation complète est due quel que soit le mode d'affichage (R16). -->
			<div class="mt-4 space-y-1">
				<SummaryRow label="Sous-total">{formatPrice(order.totalHt)} HT</SummaryRow>

				{#if Number(order.discountAmount) > 0}
					<SummaryRow label="Remise">− {formatPrice(order.discountAmount)} HT</SummaryRow>
				{/if}

				{#if Number(order.shippingFee) > 0}
					<SummaryRow label="Livraison">{formatPrice(order.shippingFee)} HT</SummaryRow>
				{/if}

				<SummaryRow label="TVA">{formatPrice(order.totalTva)}</SummaryRow>
			</div>

			<div class="mt-3 flex items-baseline justify-between border-t-[1.5px] border-shop-ink pt-3">
				<span class="font-display text-[17px] font-extrabold text-shop-ink">Total TTC</span>
				<span class="font-display text-xl font-extrabold text-shop-ink">
					{formatPrice(order.totalTtc)}
				</span>
			</div>

			{#if order.invoiceNote}
				<p class="mt-4 border-t-[1.5px] border-shop-border-soft pt-4 text-[13px] text-shop-muted">
					{order.invoiceNote}
				</p>
			{/if}
		</Panel>

		<!-- ================= Adresses ================= -->
		{#snippet addressBlock(title: string, value: FrozenAddress | null)}
			<Panel class="p-5">
				<Heading size="card">{title}</Heading>
				{#if value}
					<address class="mt-3 text-[14.5px] leading-relaxed text-shop-ink-soft not-italic">
						{value.firstName}
						{value.lastName}{#if value.company}<br />{value.company}{/if}<br />
						{value.line1}{#if value.line2}<br />{value.line2}{/if}<br />
						{value.postalCode}
						{value.city}{#if value.country && value.country !== 'FR'}
							— {value.country}{/if}
						{#if value.phone}<br />{value.phone}{/if}
					</address>
				{:else}
					<p class="mt-3 text-[14px] text-shop-muted">Non renseignée.</p>
				{/if}
			</Panel>
		{/snippet}

		{@render addressBlock('Adresse de livraison', shipping)}
		{@render addressBlock('Adresse de facturation', billing)}
	</div>
</div>
