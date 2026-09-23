<script lang="ts">
	import { onMount } from 'svelte';
	import Panel from '$lib/components/shop/Panel.svelte';
	import { formatPrice } from '$lib/money';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let form = $state<HTMLFormElement | null>(null);

	/*
	 * Soumission automatique : la page n'est qu'un relais vers la banque.
	 * Le bouton reste présent et visible — si le script échoue, le client
	 * garde un moyen d'aller au bout de son paiement.
	 */
	onMount(() => form?.submit());
</script>

<svelte:head>
	<title>Redirection vers le paiement — MS Shop</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<Panel class="mx-auto mt-10 max-w-lg px-6 py-10 text-center">
	<h1 class="font-display text-[22px] font-extrabold tracking-[-0.02em] text-shop-ink">
		Redirection vers le paiement sécurisé
	</h1>

	<p class="mt-3 text-shop-muted">
		Commande {data.reference} — {formatPrice(Number(data.totalTtc))} TTC
	</p>

	<p class="mt-2 text-sm text-shop-muted">
		Vous allez être redirigé vers la page sécurisée de notre banque. Ne fermez pas cette fenêtre.
	</p>

	<form bind:this={form} method="POST" action={data.action}>
		{#each Object.entries(data.fields) as [name, value] (name)}
			<input type="hidden" {name} {value} />
		{/each}

		<button
			type="submit"
			class="mt-6 w-full border-[1.5px] border-shop-ink bg-shop-ink px-4 py-2.5 font-display text-[14px] font-bold text-white hover:bg-shop-blue"
		>
			Poursuivre vers le paiement
		</button>
	</form>
</Panel>
