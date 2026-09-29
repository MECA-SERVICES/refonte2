<script lang="ts">
	import Panel from '$lib/components/shop/Panel.svelte';
	import Heading from '$lib/components/shop/Heading.svelte';
	import ShopButton from '$lib/components/shop/ShopButton.svelte';
	import { formatPrice } from '$lib/shop';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const order = $derived(data.order);
</script>

<svelte:head>
	<title>Commande {order.reference} confirmée — MS Shop</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="mx-auto max-w-2xl py-6 text-center">
	<!-- La coche verte confirme d'un regard que la commande est passée. -->
	<span
		class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary-50 text-shop-green"
		aria-hidden="true"
	>
		<svg
			width="32"
			height="32"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2.5"
			stroke-linecap="round"
			stroke-linejoin="round"
		>
			<path d="M4.5 12.5l5 5L19.5 7" />
		</svg>
	</span>
	<h1
		class="mt-4 font-display text-2xl font-extrabold tracking-[-0.02em] text-balance text-shop-ink sm:text-[32px]"
	>
		Merci ! Commande {order.reference} enregistrée
	</h1>
	<p class="mt-2 text-[15px] text-shop-muted">
		Conservez cette référence pour tout échange avec notre équipe.
	</p>

	<Panel class="mt-6 p-5 text-left">
		<Heading size="card">Règlement par virement</Heading>
		<p class="mt-2 text-[14.5px] leading-relaxed text-shop-ink-soft">
			Contactez-nous au <a href="tel:0950922336" class="font-bold text-shop-blue">09 50 92 23 36</a>
			pour obtenir nos coordonnées bancaires. Votre commande est préparée dès réception du règlement.
		</p>

		<dl class="mt-4 space-y-2 border-t-[1.5px] border-shop-border-soft pt-4 text-[14px]">
			<div class="flex justify-between gap-3">
				<dt class="text-shop-muted">Montant total</dt>
				<dd class="font-display font-bold text-shop-ink">{formatPrice(order.totalTtc)} TTC</dd>
			</div>
			<div class="flex justify-between gap-3">
				<dt class="text-shop-muted">État</dt>
				<dd class="font-semibold text-shop-ink">{order.stateLabel}</dd>
			</div>
			{#if order.carrierName}
				<div class="flex justify-between gap-3">
					<dt class="text-shop-muted">Livraison</dt>
					<dd class="font-semibold text-shop-ink">{order.carrierName}</dd>
				</div>
			{/if}
			{#if order.relayPointName}
				<div class="flex justify-between gap-3">
					<dt class="text-shop-muted">Point relais</dt>
					<dd class="font-semibold text-shop-ink">{order.relayPointName}</dd>
				</div>
			{/if}
		</dl>
	</Panel>

	<div class="mt-6 flex flex-wrap justify-center gap-3">
		<ShopButton variant="primary" href="/compte/commandes/{order.id}">
			Suivre ma commande
		</ShopButton>
		<ShopButton variant="outline" href="/recherche">Continuer mes achats</ShopButton>
	</div>
</div>
