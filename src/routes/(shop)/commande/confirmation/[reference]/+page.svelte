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

<div class="mx-auto max-w-2xl py-6">
	<p class="font-display text-[13px] font-extrabold tracking-[0.12em] text-shop-blue uppercase">
		Commande enregistrée
	</p>
	<h1
		class="mt-2 font-display text-2xl font-extrabold tracking-[-0.02em] text-shop-ink sm:text-[32px]"
	>
		Merci, votre commande est bien reçue
	</h1>
	<p class="mt-2 text-[15px] text-shop-muted">
		Votre référence de commande est <strong class="text-shop-ink">{order.reference}</strong>.
		Conservez-la pour tout échange avec notre équipe.
	</p>

	<Panel class="mt-6 p-5">
		<Heading size="card">Règlement par virement</Heading>
		<p class="mt-2 text-[14.5px] leading-relaxed text-shop-ink-soft">
			Contactez-nous au <a href="tel:0950922336" class="font-bold text-shop-blue">09 50 92 23 36</a>
			pour obtenir nos coordonnées bancaires. Votre commande est préparée dès réception du
			règlement.
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

	<div class="mt-6 flex flex-wrap gap-3">
		<ShopButton variant="primary" href="/compte/commandes/{order.id}">
			Suivre ma commande
		</ShopButton>
		<ShopButton variant="outline" href="/recherche">Continuer mes achats</ShopButton>
	</div>
</div>
