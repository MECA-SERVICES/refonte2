<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { CloseButton, Drawer, Accordion, AccordionItem, Dropdown } from 'flowbite-svelte';
	import {
		ArrowRightToBracketOutline,
		BarsOutline,
		CartOutline,
		UserOutline
	} from 'flowbite-svelte-icons';
	import MegaMenu from '$lib/components/shop/MegaMenu.svelte';
	import SearchBox from '$lib/components/shop/SearchBox.svelte';
	import NavigationIndicator from '$lib/components/shop/NavigationIndicator.svelte';
	import CartToast from '$lib/components/shop/CartToast.svelte';
	import AnnouncementPopup from '$lib/components/shop/AnnouncementPopup.svelte';
	import { cartFeedback } from '$lib/components/shop/cart-feedback.svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	/** Menu latéral des rayons — un seul panneau pour mobile et desktop. */
	let menuOpen = $state(false);

	const categoryHref = (slug: string) => `/categorie/${slug}`;

	/**
	 * Sections du méga-menu : une par racine du catalogue. Chaque famille de
	 * second niveau devient une colonne, ses sous-familles les liens dessous.
	 */
	const megaSections = $derived(
		data.menu.map((root) => ({
			id: root.slug,
			label: root.name,
			href: categoryHref(root.slug),
			cta: `Voir tout ${root.name.toLowerCase()}`,
			hint: '',
			families: root.children
		}))
	);

	/** Trois promesses du bandeau utilitaire — la réassurance avant tout. */
	const topPromises = [
		'Pièces détachées 100 % origine',
		'S.A.V assuré dans notre atelier',
		'Paiement sécurisé'
	];

	/** Liens d'information du footer (pages CMS à venir — placeholders du squelette). */
	const infoLinks = [
		'Livraison France, Europe & Outre-mer',
		'Moyens de paiement',
		'Mandat administratif & Chorus Pro',
		'S.A.V & garantie',
		'Conditions générales de vente'
	];
</script>

<NavigationIndicator />
<CartToast bind:message={cartFeedback.message} />

<!-- Annonce en cours, choisie côté serveur selon l'adresse consultée. -->
<AnnouncementPopup popup={data.popup} />

<!-- `overflow-x-clip` : le hero de l'accueil déborde volontairement du
     conteneur (pleine largeur d'écran), sans créer de défilement horizontal. -->
<div class="flex min-h-screen flex-col overflow-x-clip bg-white text-shop-ink">
	<header class="sticky top-0 z-50">
		<!-- Bandeau utilitaire : promesses à gauche, accès directs à droite -->
		<div class="hidden bg-shop-blue-dark text-[13px] text-shop-on-dark sm:block">
			<div
				class="mx-auto flex w-full max-w-[1440px] flex-wrap items-center justify-between gap-x-7 gap-y-2 px-4 py-2 sm:px-6"
			>
				<div class="flex flex-wrap gap-x-5 gap-y-2">
					{#each topPromises as promise (promise)}
						<span class="flex items-center gap-2">
							<span class="h-1.5 w-1.5 rounded-full bg-shop-orange-light" aria-hidden="true"></span>
							{promise}
						</span>
					{/each}
				</div>
				<div class="flex flex-wrap items-center gap-x-5 gap-y-2">
					<a href="/inscription" class="hover:text-white">Mandat administratif · Chorus Pro</a>
					<a href="/compte/commandes" class="hover:text-white">Suivre ma commande</a>
					<a href="tel:0950922336" class="font-display font-bold text-white">09 50 92 23 36</a>
				</div>
			</div>
		</div>

		<!-- Ligne principale : identité, recherche, compte et panier -->
		<div class="border-b border-shop-border-soft bg-white">
			<div
				class="mx-auto flex w-full max-w-[1440px] flex-wrap items-center gap-x-7 gap-y-4 px-4 py-3 sm:px-6"
			>
				<a href={resolve('/')} class="shrink-0">
					<img
						src="/logo-msshop.png"
						alt="MSSHOP.FR — Meca Services, revendeur agréé, S.A.V assuré"
						class="h-20 w-auto"
					/>
				</a>

				<!-- Recherche avec aperçu instantané (tolérante aux fautes). -->
				<SearchBox id="search-header" class="flex-1 basis-[340px]" />

				<div class="flex shrink-0 items-center gap-2">
					{#if data.shopUser}
						<button
							type="button"
							class="flex items-center gap-2.5 rounded-[10px] px-3.5 py-2.5 text-sm font-medium text-shop-ink hover:bg-shop-subtle"
						>
							<UserOutline class="h-5.5 w-5.5" />
							<span class="max-w-36 truncate text-left leading-[1.1]">
								<span class="block text-[11px] text-shop-muted">Bonjour</span>
								{data.shopUser.name}
							</span>
						</button>
						<Dropdown simple class="w-52 rounded-xl p-1">
							<a
								href="/compte"
								class="block rounded-lg px-3 py-2 text-sm font-medium text-shop-ink hover:bg-shop-subtle"
							>
								Mon compte
							</a>
							<!-- Formulaire hors DropdownItem : celui-ci rend un lien, qui ne
							     peut pas contenir de bouton de soumission. -->
							<form method="POST" action="/deconnexion" class="block">
								<input type="hidden" name="redirectTo" value={page.url.pathname} />
								<button
									type="submit"
									class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-shop-ink hover:bg-shop-subtle"
								>
									<ArrowRightToBracketOutline class="h-4 w-4" /> Déconnexion
								</button>
							</form>
						</Dropdown>
					{:else}
						<a
							href="/connexion"
							class="hidden items-center gap-2.5 rounded-[10px] px-3.5 py-2.5 text-sm font-medium text-shop-ink hover:bg-shop-subtle sm:flex"
						>
							<UserOutline class="h-5.5 w-5.5" />
							<span class="text-left leading-[1.1]">
								<span class="block text-[11px] text-shop-muted">Bonjour</span>
								Mon compte
							</span>
						</a>
					{/if}

					<a
						href="/panier"
						class="flex items-center gap-2.5 rounded-[10px] bg-shop-ink px-4 py-2.5 font-display text-sm font-bold text-white transition-colors hover:bg-shop-blue"
					>
						<CartOutline class="h-5 w-5" />
						<span class="hidden sm:inline">Panier</span>
						{#key data.cartCount}
							<span
								class="inline-block animate-[cart-bump_0.4s_ease-out] rounded-full bg-shop-red px-2 py-px text-xs"
							>
								{data.cartCount}
							</span>
						{/key}
					</a>
				</div>
			</div>

			<!-- Accès au catalogue sur petit écran : le méga-menu cède la place
			     au tiroir latéral, plus praticable au doigt. -->
			<div class="px-4 pb-3.5 sm:px-6 lg:hidden">
				<button
					type="button"
					onclick={() => (menuOpen = true)}
					class="flex items-center gap-2 font-display text-[13.5px] font-bold text-shop-ink"
				>
					<BarsOutline class="h-4.5 w-4.5" /> Tous nos rayons
				</button>
			</div>
		</div>

		<!-- Navigation principale : méga-menu du catalogue (écrans larges) -->
		<div class="hidden lg:block">
			<MegaMenu sections={megaSections} brands={data.topBrands} />
		</div>
	</header>

	<!-- Menu latéral des rayons (mobile et desktop) -->
	<Drawer bind:open={menuOpen} placement="left" class="w-80 p-0 sm:w-96">
		<div class="flex items-center justify-between border-b border-shop-border-soft px-5 py-4">
			<h2 class="font-display text-lg font-extrabold text-shop-ink">Nos rayons</h2>
			<CloseButton onclick={() => (menuOpen = false)} />
		</div>

		<div class="overflow-y-auto p-3">
			<Accordion flush class="border-0">
				{#each data.menu as entry (entry.id)}
					{#if entry.children.length > 0}
						<AccordionItem
							class="py-3 text-sm font-semibold text-shop-ink"
							contentClass="py-2 ps-2"
						>
							{#snippet header()}{entry.name}{/snippet}
							<ul class="space-y-0.5">
								<li>
									<a
										href={categoryHref(entry.slug)}
										class="block rounded-lg px-3 py-1.5 text-sm font-medium text-shop-blue hover:bg-shop-subtle"
										onclick={() => (menuOpen = false)}
									>
										Tout « {entry.name} »
									</a>
								</li>
								{#each entry.children as child (child.id)}
									<li>
										<a
											href={categoryHref(child.slug)}
											class="block rounded-lg px-3 py-1.5 text-sm text-shop-muted hover:bg-shop-subtle hover:text-shop-ink"
											onclick={() => (menuOpen = false)}
										>
											{child.name}
										</a>
									</li>
								{/each}
							</ul>
						</AccordionItem>
					{:else}
						<a
							href={categoryHref(entry.slug)}
							class="block border-b border-shop-border-soft px-0 py-3 text-sm font-semibold text-shop-ink hover:text-shop-blue"
							onclick={() => (menuOpen = false)}
						>
							{entry.name}
						</a>
					{/if}
				{/each}
			</Accordion>

			<a
				href="/marques"
				class="mt-4 block rounded-[10px] border border-shop-border bg-shop-subtle px-4 py-3 text-center text-sm font-semibold text-shop-blue hover:bg-primary-100"
				onclick={() => (menuOpen = false)}
			>
				Parcourir les marques
			</a>

			<a
				href="/recherche"
				class="mt-2 block rounded-[10px] border border-shop-border bg-shop-subtle px-4 py-3 text-center text-sm font-semibold text-shop-blue hover:bg-primary-100"
				onclick={() => (menuOpen = false)}
			>
				Voir tout le catalogue
			</a>
		</div>
	</Drawer>

	<!-- Contenu de la page -->
	<main class="mx-auto w-full max-w-[1440px] flex-1 px-4 py-5 sm:px-6">
		{@render children()}
	</main>

	<!-- Pied de page -->
	{#snippet footerTitle(label: string)}
		<h2
			class="mb-3 font-display text-[12.5px] font-extrabold tracking-[0.12em] text-white uppercase"
		>
			{label}
		</h2>
	{/snippet}

	<footer class="bg-shop-ink text-shop-on-dark">
		<div
			class="mx-auto grid w-full max-w-[1440px] gap-8 px-4 py-10 sm:grid-cols-2 sm:px-6 lg:grid-cols-4"
		>
			<div>
				<!-- Le logo est sur fond blanc : le cartouche l'isole du footer sombre. -->
				<span class="mb-3.5 inline-flex overflow-hidden rounded-xl bg-white p-2">
					<img
						src="/logo-msshop.png"
						alt="MSSHOP.FR — Meca Services"
						loading="lazy"
						class="h-12 w-auto"
					/>
				</span>
				<p class="text-sm leading-relaxed">
					Atelier &amp; Click &amp; Collect<br />
					4 La Merrerie, 50570 Carantilly — Manche, Normandie<br />
					Lun – Ven · 9 h – 12 h / 14 h – 18 h
				</p>
				<p class="mt-3 font-display text-base font-bold text-white">
					<a href="tel:0950922336" class="hover:underline">09 50 92 23 36</a>
				</p>
			</div>
			<div>
				{@render footerTitle('Infos pratiques')}
				<ul class="space-y-2 text-sm">
					{#each infoLinks as label (label)}
						<li>
							<a href={resolve('/')} class="hover:text-white hover:underline">{label}</a>
						</li>
					{/each}
				</ul>
			</div>
			<div>
				{@render footerTitle('Nos univers')}
				<ul class="space-y-2 text-sm">
					{#each data.menu.slice(0, 5) as entry (entry.id)}
						<li>
							<a href="/categorie/{entry.slug}" class="hover:text-white hover:underline">
								{entry.name}
							</a>
						</li>
					{/each}
					<li>
						<a href="/vue-eclatee" class="hover:text-white hover:underline">
							Pièces détachées &amp; vues éclatées
						</a>
					</li>
				</ul>
			</div>
			<div>
				{@render footerTitle('Newsletter')}
				<p class="mb-3 text-sm leading-relaxed">
					Les bons plans et nouveautés de l'atelier, une fois par mois.
				</p>
				<!-- Collecte à brancher (liste de diffusion) : le formulaire matérialise
				     l'emplacement prévu par la maquette sans envoyer nulle part. -->
				<form class="flex overflow-hidden rounded-[10px]" aria-label="Inscription à la newsletter">
					<label class="sr-only" for="newsletter-email">Votre e-mail</label>
					<input
						id="newsletter-email"
						type="email"
						placeholder="Votre e-mail"
						class="min-w-0 flex-1 border-0 bg-white px-3.5 py-3 text-sm text-shop-ink focus:ring-0"
					/>
					<button
						type="submit"
						class="border-0 bg-shop-orange px-4 font-display text-sm font-bold text-white transition-colors hover:bg-shop-orange-deep"
					>
						OK
					</button>
				</form>
				<div class="mt-4 flex flex-wrap gap-1.5">
					{#each ['CB', 'Visa', 'Mastercard', 'Virement', 'Mandat admin.'] as mean (mean)}
						<span
							class="rounded-md bg-shop-rule-dark px-2 py-1 text-[11.5px] font-bold tracking-[0.04em] text-white"
						>
							{mean}
						</span>
					{/each}
				</div>
			</div>
		</div>
		<div class="border-t border-shop-rule-dark">
			<div
				class="mx-auto flex w-full max-w-[1440px] flex-wrap items-center justify-between gap-x-5 gap-y-2 px-4 py-4 text-[12.5px] text-shop-on-dark-dim sm:px-6"
			>
				<span>© {new Date().getFullYear()} MECA SERVICES — mecaservicesshop.fr</span>
				<div class="flex flex-wrap gap-4">
					<a href={resolve('/')} class="hover:text-white">Mentions légales</a>
					<a href={resolve('/')} class="hover:text-white">Protection des données</a>
					<a href={resolve('/')} class="hover:text-white">Gestion des cookies</a>
				</div>
			</div>
		</div>
	</footer>
</div>

<style>
	/* Le compteur du panier rebondit à chaque changement : signal bref, mais
	   suffisant pour rattacher l'ajout à l'icône du panier. */
	@keyframes cart-bump {
		0% {
			transform: scale(1);
		}
		40% {
			transform: scale(1.5);
		}
		100% {
			transform: scale(1);
		}
	}
</style>
