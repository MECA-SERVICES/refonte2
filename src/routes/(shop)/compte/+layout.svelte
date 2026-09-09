<script lang="ts">
	import { page } from '$app/state';
	import { ArrowRightToBracketOutline } from 'flowbite-svelte-icons';
	import ShopButton from '$lib/components/shop/ShopButton.svelte';
	import Panel from '$lib/components/shop/Panel.svelte';
	import Heading from '$lib/components/shop/Heading.svelte';
	import type { Snippet } from 'svelte';

	/**
	 * Ossature de l'espace client.
	 *
	 * Le menu est porté par le layout et non par chaque page : sans lui, une page
	 * comme « Mes adresses » serait une impasse, sans moyen de rejoindre les
	 * autres rubriques. Il reste visible quelle que soit la section consultée.
	 */

	let { children }: { children: Snippet } = $props();

	const links = [
		{ href: '/compte', label: 'Tableau de bord' },
		{ href: '/compte/commandes', label: 'Mes commandes' },
		{ href: '/compte/adresses', label: 'Mes adresses' }
	];

	/**
	 * Rubrique courante. La comparaison est exacte sur « /compte » — un préfixe
	 * marquerait le tableau de bord actif sur toutes les sous-pages.
	 */
	const isCurrent = (href: string) =>
		href === '/compte' ? page.url.pathname === href : page.url.pathname.startsWith(href);
</script>

<div class="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start">
	<!-- ================= Navigation ================= -->
	<Panel padded={false} class="p-5 lg:sticky lg:top-6">
		<Heading size="card">Mon espace</Heading>

		<nav class="mt-4 space-y-2" aria-label="Espace client">
			{#each links as link (link.href)}
				{@const current = isCurrent(link.href)}
				<a
					href={link.href}
					aria-current={current ? 'page' : undefined}
					class="block border-[1.5px] px-4 py-2.5 text-sm font-semibold transition-colors {current
						? 'border-shop-ink bg-shop-ink text-white'
						: 'border-shop-border bg-white text-shop-ink hover:border-shop-ink hover:text-shop-blue'}"
				>
					{link.label}
				</a>
			{/each}
		</nav>

		<div class="mt-5 space-y-2 border-t-[1.5px] border-shop-border-soft pt-5">
			<a
				href="/panier"
				class="block border border-shop-border bg-white px-4 py-2.5 text-sm font-semibold text-shop-ink hover:text-shop-blue"
			>
				Mon panier
			</a>
			<a
				href="/recherche"
				class="block border border-shop-border bg-white px-4 py-2.5 text-sm font-semibold text-shop-ink hover:text-shop-blue"
			>
				Continuer mes achats
			</a>
		</div>

		<form method="POST" action="/deconnexion" class="mt-5">
			<input type="hidden" name="redirectTo" value="/" />
			<ShopButton type="submit" variant="outline" size="sm" block>
				<ArrowRightToBracketOutline class="me-2 h-4 w-4" /> Déconnexion
			</ShopButton>
		</form>
	</Panel>

	<div class="min-w-0">
		{@render children()}
	</div>
</div>
