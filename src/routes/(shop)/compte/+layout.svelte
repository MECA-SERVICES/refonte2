<script lang="ts">
	import { page } from '$app/state';
	import { ArrowRightToBracketOutline } from 'flowbite-svelte-icons';
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
		{ href: '/compte/machines', label: 'Mon parc machines' },
		{ href: '/compte/reparations', label: 'Mes réparations' },
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

		<nav class="mt-4 space-y-1" aria-label="Espace client">
			{#each links as link (link.href)}
				{@const current = isCurrent(link.href)}
				<a
					href={link.href}
					aria-current={current ? 'page' : undefined}
					class="block rounded-[10px] px-3.5 py-2.5 text-sm transition-colors {current
						? 'bg-primary-50 font-bold text-shop-blue'
						: 'font-semibold text-shop-ink hover:bg-shop-subtle'}"
				>
					{link.label}
				</a>
			{/each}
		</nav>

		<div class="mt-4 space-y-1 border-t-[1.5px] border-shop-border-soft pt-4">
			<a
				href="/panier"
				class="block rounded-[10px] px-3.5 py-2.5 text-sm font-semibold text-shop-ink hover:bg-shop-subtle"
			>
				Mon panier
			</a>
			<a
				href="/recherche"
				class="block rounded-[10px] px-3.5 py-2.5 text-sm font-semibold text-shop-ink hover:bg-shop-subtle"
			>
				Continuer mes achats
			</a>
		</div>

		<form
			method="POST"
			action="/deconnexion"
			class="mt-4 border-t-[1.5px] border-shop-border-soft pt-4"
		>
			<input type="hidden" name="redirectTo" value="/" />
			<button
				type="submit"
				class="flex w-full items-center gap-2 rounded-[10px] px-3.5 py-2.5 text-left text-sm font-medium text-shop-muted transition-colors hover:bg-shop-subtle hover:text-shop-ink"
			>
				<ArrowRightToBracketOutline class="h-4 w-4" /> Déconnexion
			</button>
		</form>
	</Panel>

	<div class="min-w-0">
		{@render children()}
	</div>
</div>
