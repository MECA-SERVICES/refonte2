<script lang="ts">
	import { page } from '$app/state';
	import {
		A404NotFoundShopping,
		LaptopServerError,
		PasswordLockKey
	} from 'flowbite-svelte-illustrations';
	import SearchBox from '$lib/components/shop/SearchBox.svelte';
	import ShopButton from '$lib/components/shop/ShopButton.svelte';

	/**
	 * Page d'erreur de la boutique, rendue dans son layout : en-tête, recherche
	 * et menu des rayons restent là pour que le visiteur retrouve son chemin.
	 */

	/** Teintes de la charte pour les illustrations Flowbite (bleu marine). */
	const palette = { color1: '#314192', color2: '#7f8bc7', color3: '#c7cee8', color4: '#e7ebf5' };

	type Kind = 'notFound' | 'forbidden' | 'server';
	const kind = $derived<Kind>(
		page.status === 404
			? 'notFound'
			: page.status === 401 || page.status === 403
				? 'forbidden'
				: 'server'
	);

	const copy = {
		notFound: {
			eyebrow: 'Erreur 404',
			title: 'Cette page est introuvable',
			text: "La pièce que vous cherchez a peut-être changé de référence, ou cette adresse n'existe plus. Une recherche par référence ou par modèle vous y mènera."
		},
		forbidden: {
			eyebrow: 'Accès refusé',
			title: "Vous n'avez pas accès à cette page",
			text: 'Connectez-vous avec le compte concerné, ou revenez à la boutique.'
		},
		server: {
			eyebrow: 'Erreur',
			title: 'Un incident est survenu',
			text: 'Nous n’avons pas pu afficher cette page. Réessayez dans un instant ; si le problème persiste, écrivez-nous.'
		}
	} satisfies Record<Kind, { eyebrow: string; title: string; text: string }>;

	const c = $derived({
		...copy[kind],
		eyebrow: kind === 'server' ? `Erreur ${page.status}` : copy[kind].eyebrow
	});

	/**
	 * Message précis levé par la page (« Produit introuvable », « Commande
	 * introuvable »…). Les messages génériques n'apportent rien au visiteur.
	 */
	const detail = $derived.by(() => {
		const message = page.error?.message ?? '';
		const generic = [
			'Not Found',
			'Internal Error',
			'Page introuvable',
			'Forbidden',
			'Unauthorized'
		];
		return message && !generic.includes(message) ? message : null;
	});

	/** Quelques rayons pour repartir, tirés du menu chargé par le layout. */
	const rayons = $derived(((page.data.menu ?? []) as { name: string; slug: string }[]).slice(0, 6));
</script>

<svelte:head>
	<title>{c.title} — MS Shop</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<!--
	`items-stretch` : la colonne de l'illustration prend la hauteur du bloc de
	texte, et l'image s'y inscrit sans la dépasser.
-->
<section
	class="grid gap-8 py-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-stretch md:gap-10 md:py-12"
>
	<div class="order-2 md:order-1">
		<p
			class="font-display text-xs font-extrabold tracking-[0.14em] text-shop-orange-deep uppercase"
		>
			{c.eyebrow}
		</p>
		<h1
			class="mt-2 font-display text-3xl leading-[1.1] font-extrabold tracking-[-0.025em] text-balance text-shop-ink sm:text-[40px]"
		>
			{c.title}
		</h1>
		{#if detail}
			<p class="mt-3 font-display text-[15px] font-bold text-shop-blue">{detail}.</p>
		{/if}
		<p class="mt-3 max-w-[52ch] text-[15.5px] leading-relaxed text-shop-muted">{c.text}</p>

		{#if kind === 'notFound'}
			<SearchBox id="search-error" class="mt-6 max-w-xl" />
		{/if}

		<div class="mt-6 flex flex-wrap gap-2.5">
			<ShopButton href="/" variant="primary">Retour à l'accueil</ShopButton>
			{#if kind === 'server'}
				<ShopButton variant="outline" onclick={() => location.reload()}>Réessayer</ShopButton>
			{:else if kind === 'forbidden'}
				<ShopButton
					href="/connexion?redirectTo={encodeURIComponent(page.url.pathname)}"
					variant="outline"
				>
					Se connecter
				</ShopButton>
			{:else}
				<ShopButton href="/recherche" variant="outline">Parcourir le catalogue</ShopButton>
			{/if}
			<ShopButton href="/contact" variant="outline">Nous contacter</ShopButton>
		</div>

		{#if kind === 'notFound' && rayons.length}
			<div class="mt-8 border-t-[1.5px] border-shop-border-soft pt-5">
				<p class="text-[13px] font-bold text-shop-ink">Nos rayons</p>
				<ul class="mt-2.5 flex flex-wrap gap-2">
					{#each rayons as r (r.slug)}
						<li>
							<a
								href="/categorie/{r.slug}"
								class="inline-block rounded-full border-[1.5px] border-shop-border-soft bg-white px-3.5 py-1.5 text-[13px] font-semibold text-shop-ink transition-colors hover:border-shop-blue hover:text-shop-blue"
							>
								{r.name}
							</a>
						</li>
					{/each}
				</ul>
			</div>
		{/if}
	</div>

	<!-- Hauteur fixe sur mobile ; sur écran large, celle du bloc de texte. -->
	<div class="relative order-1 h-56 w-full sm:h-72 md:order-2 md:h-auto" aria-hidden="true">
		{#if kind === 'notFound'}
			<A404NotFoundShopping {...palette} height="100%" class="absolute inset-0 h-full w-full" />
		{:else if kind === 'forbidden'}
			<PasswordLockKey {...palette} height="100%" class="absolute inset-0 h-full w-full" />
		{:else}
			<LaptopServerError {...palette} height="100%" class="absolute inset-0 h-full w-full" />
		{/if}
	</div>
</section>
