<script lang="ts">
	import Panel from '$lib/components/shop/Panel.svelte';
	import { formatPrice } from '$lib/money';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>{data.failed ? 'Paiement refusé' : 'Paiement en cours'} — MS Shop</title>
	<meta name="robots" content="noindex" />
	{#if !data.failed}
		<!--
			Le client arrive souvent avant la notification de la banque : un
			rafraîchissement suffit à afficher la confirmation dès qu'elle
			arrive, sans qu'il ait à faire quoi que ce soit.
		-->
		<meta http-equiv="refresh" content="5" />
	{/if}
</svelte:head>

<Panel class="mx-auto mt-10 max-w-lg px-6 py-10 text-center">
	{#if data.failed}
		<h1 class="font-display text-[22px] font-extrabold tracking-[-0.02em] text-shop-ink">
			Paiement refusé
		</h1>
		<p class="mt-3 text-shop-muted">
			Votre banque a refusé le règlement de la commande {data.reference}. Aucun montant n'a été
			débité.
		</p>
		<div class="mt-6 flex flex-wrap justify-center gap-2">
			<a
				href="/commande/paiement/{data.reference}"
				class="border-[1.5px] border-shop-ink bg-shop-ink px-4 py-2.5 font-display text-[14px] font-bold text-white hover:bg-shop-blue"
			>
				Réessayer le paiement
			</a>
			<a
				href="/compte/commandes"
				class="border-[1.5px] border-shop-border bg-white px-4 py-2.5 font-display text-[14px] font-bold text-shop-ink hover:border-shop-ink"
			>
				Mes commandes
			</a>
		</div>
	{:else}
		<h1 class="font-display text-[22px] font-extrabold tracking-[-0.02em] text-shop-ink">
			Paiement en cours de confirmation
		</h1>
		<p class="mt-3 text-shop-muted">
			Commande {data.reference} — {formatPrice(Number(data.totalTtc))} TTC
		</p>
		<p class="mt-2 text-sm text-shop-muted">
			Nous attendons la confirmation de votre banque. Cette page se met à jour automatiquement ;
			vous recevrez un email dès la validation.
		</p>
		<p class="mt-4 text-xs text-shop-muted">État actuel : {data.stateLabel}</p>
	{/if}
</Panel>
