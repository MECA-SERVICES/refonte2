<script lang="ts">
	import { page } from '$app/state';

	/**
	 * Page d'erreur de secours, hors layout de la boutique.
	 *
	 * Les erreurs de la vitrine sont rendues par `(shop)/+error.svelte`, dans
	 * son layout ; celle-ci ne sert que si ce layout lui-même échoue, ou pour
	 * une adresse inconnue hors boutique.
	 */
	const notFound = $derived(page.status === 404);
</script>

<svelte:head>
	<title>{notFound ? 'Page introuvable' : 'Erreur'} — MS Shop</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main
	class="flex min-h-screen flex-col items-center justify-center bg-white px-4 py-16 text-center"
>
	<a href="/"><img src="/logo-msshop.png" alt="MS Shop" class="h-20 w-auto" /></a>
	<p class="mt-10 font-display text-6xl font-extrabold tracking-[-0.03em] text-shop-blue">
		{page.status}
	</p>
	<h1 class="mt-3 font-display text-2xl font-extrabold text-shop-ink">
		{notFound ? 'Cette page est introuvable' : 'Un incident est survenu'}
	</h1>
	<p class="mt-2 max-w-md text-[15px] text-shop-muted">
		{notFound
			? "L'adresse demandée n'existe pas ou n'est plus disponible."
			: 'Réessayez dans un instant ; si le problème persiste, contactez-nous.'}
	</p>
	<a
		href="/"
		class="mt-6 inline-flex items-center rounded-[10px] bg-shop-blue px-5 py-3 font-display text-[15px] font-bold text-white hover:bg-shop-blue-dark"
	>
		Retour à l'accueil
	</a>
</main>
