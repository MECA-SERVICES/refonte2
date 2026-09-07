<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import {
		CloseButton,
		Drawer,
		Accordion,
		AccordionItem,
		Dropdown,
		Footer,
		FooterCopyright,
		FooterLink,
		FooterLinkGroup
	} from 'flowbite-svelte';
	import {
		ArrowRightToBracketOutline,
		BarsOutline,
		CartOutline,
		PhoneSolid,
		SearchOutline
	} from 'flowbite-svelte-icons';
	import MegaMenu from '$lib/components/shop/MegaMenu.svelte';
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

	/** Liens d'information du footer (pages CMS à venir — placeholders du squelette). */
	const infoLinks = [
		'Moyens de paiement',
		'Modes de livraison',
		'Conditions générales de vente',
		'Mandat administratif ou Chorus',
		'Services S.A.V',
		'Paiement en 3 ou 4 fois'
	];
</script>

<div class="flex min-h-screen flex-col bg-shop-subtle">
	<header class="sticky top-0 z-30">
		<!-- Bandeau utilitaire : ancrage local à gauche, contacts et accès à droite -->
		<div class="hidden bg-shop-blue-dark text-[13px] text-shop-on-dark sm:block">
			<div
				class="mx-auto flex w-full max-w-[1360px] flex-wrap items-center justify-between gap-4 px-4 py-2.5 sm:px-6 lg:px-8"
			>
				<span>
					Atelier &amp; expédition à Carantilly (50) — Normandie · Commandes préparées sous 24 h
				</span>
				<div class="flex flex-wrap items-center gap-5">
					<a href="tel:0950922336" class="font-display font-bold text-white hover:underline">
						<PhoneSolid class="me-1 inline h-3.5 w-3.5" /> 09 50 92 23 36
					</a>
					<a href="/compte" class="hover:text-white">Suivre ma commande</a>
					<a href="/inscription" class="hover:text-white">Compte pro &amp; collectivités</a>
				</div>
			</div>
		</div>

		<!-- Ligne principale : identité, recherche catégorisée, actions -->
		<div class="border-b border-shop-border bg-shop-subtle">
			<div
				class="mx-auto flex w-full max-w-[1360px] flex-wrap items-center gap-5 px-4 py-4 sm:px-6 lg:px-8"
			>
				<a href={resolve('/')} class="flex shrink-0 items-center gap-3">
					<span
						class="flex h-[46px] w-[46px] items-center justify-center bg-shop-blue font-display text-[17px] font-extrabold tracking-[-0.02em] text-shop-subtle"
					>
						MS
					</span>
					<span class="leading-[1.05]">
						<span
							class="block font-display text-[19px] font-extrabold tracking-[-0.01em] text-shop-ink"
						>
							MECA SERVICES
						</span>
						<span class="block text-[11px] tracking-[0.16em] text-shop-muted uppercase">
							Motoculture &amp; pièces détachées
						</span>
					</span>
				</a>

				<!-- Recherche : le rayon se choisit avant de saisir, comme sur les
				     catalogues techniques où le même mot existe dans dix familles. -->
				<form
					action="/recherche"
					method="get"
					class="flex min-w-0 flex-1 basis-[340px] border-[1.5px] border-shop-ink bg-white"
				>
					<label class="sr-only" for="search-scope">Périmètre de recherche</label>
					<select
						id="search-scope"
						name="rayon"
						class="hidden border-0 border-r-[1.5px] border-shop-ink bg-shop-border-soft py-0 pr-8 pl-3 text-sm text-shop-ink focus:ring-0 sm:block"
					>
						<option value="">Tout le catalogue</option>
						{#each data.menu as entry (entry.id)}
							<option value={entry.slug}>{entry.name}</option>
						{/each}
					</select>

					<label class="sr-only" for="search-q">Rechercher</label>
					<input
						id="search-q"
						type="search"
						name="q"
						placeholder="Référence, marque, modèle — ex. 587 42 07-01 ou Husqvarna 550 XP"
						class="min-w-0 flex-1 border-0 px-3.5 py-3 text-sm text-shop-ink placeholder:text-shop-muted focus:ring-0"
					/>
					<button
						type="submit"
						class="shrink-0 bg-shop-blue px-5 font-display text-sm font-bold text-shop-subtle transition-colors hover:bg-shop-blue-dark"
					>
						<SearchOutline class="inline h-4 w-4 sm:hidden" />
						<span class="hidden sm:inline">Rechercher</span>
					</button>
				</form>

				<div class="flex shrink-0 items-center gap-2.5">
					{#if data.shopUser}
						<button
							type="button"
							class="max-w-40 truncate border-[1.5px] border-shop-border px-3.5 py-2.5 text-sm font-medium text-shop-ink"
						>
							{data.shopUser.name}
						</button>
						<Dropdown simple class="w-52 rounded-none p-1">
							<a
								href="/compte"
								class="block px-3 py-2 text-sm font-medium text-shop-ink hover:bg-shop-subtle"
							>
								Mon compte
							</a>
							<!-- Formulaire hors DropdownItem : celui-ci rend un lien, qui ne
							     peut pas contenir de bouton de soumission. -->
							<form method="POST" action="/deconnexion" class="block">
								<input type="hidden" name="redirectTo" value={page.url.pathname} />
								<button
									type="submit"
									class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-shop-ink hover:bg-shop-subtle"
								>
									<ArrowRightToBracketOutline class="h-4 w-4" /> Déconnexion
								</button>
							</form>
						</Dropdown>
					{:else}
						<a
							href="/connexion"
							class="hidden border-[1.5px] border-shop-border px-3.5 py-2.5 text-sm font-medium text-shop-ink hover:border-shop-ink sm:block"
						>
							Mon compte
						</a>
					{/if}

					<a
						href="/inscription"
						class="hidden border-[1.5px] border-shop-ink bg-white px-3.5 py-2.5 text-sm font-bold text-shop-ink lg:block"
					>
						Demander un devis
					</a>

					<a
						href="/panier"
						class="bg-shop-blue px-4 py-2.5 font-display text-sm font-bold text-white transition-colors hover:bg-shop-blue-dark"
					>
						<CartOutline class="me-1 inline h-4 w-4" />
						Panier · {data.cartCount}
					</a>
				</div>
			</div>

			<!-- Accès au catalogue sur petit écran : le méga-menu cède la place
			     au tiroir latéral, plus praticable au doigt. -->
			<div class="px-4 pb-3.5 sm:px-6 lg:hidden lg:px-8">
				<button
					type="button"
					onclick={() => (menuOpen = true)}
					class="flex items-center gap-2 font-display text-[13.5px] font-semibold tracking-[0.02em] text-shop-ink uppercase"
				>
					<BarsOutline class="h-4 w-4" /> Tous nos rayons
				</button>
			</div>
		</div>
		<!-- Navigation principale : méga-menu du catalogue (écrans larges) -->
		<div class="hidden lg:block">
			<MegaMenu sections={megaSections} />
		</div>
	</header>

	<!-- Bandeau promotionnel : une opération commerciale à la fois. -->
	<div class="border-b border-shop-border bg-shop-promo">
		<div
			class="mx-auto flex w-full max-w-[1360px] flex-wrap justify-between gap-2.5 px-4 py-2.5 text-sm text-shop-ink sm:px-6 lg:px-8"
		>
			<span>
				<strong class="font-display">Préparation d'hiver</strong>
				— 15 % sur les fraises à neige et les produits de dégivrage jusqu'au 30 novembre.
			</span>
			<a href="/recherche" class="font-semibold text-shop-blue hover:underline">
				Voir la sélection →
			</a>
		</div>
	</div>

	<!-- Menu latéral des rayons (mobile et desktop) -->
	<Drawer bind:open={menuOpen} placement="left" class="w-80 p-0 sm:w-96">
		<div class="flex items-center justify-between border-b border-shop-border px-5 py-4">
			<h2 class="text-lg font-bold text-shop-ink">Nos rayons</h2>
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
										class="block rounded-md px-3 py-1.5 text-sm font-medium text-shop-blue hover:bg-shop-subtle"
										onclick={() => (menuOpen = false)}
									>
										Tout « {entry.name} »
									</a>
								</li>
								{#each entry.children as child (child.id)}
									<li>
										<a
											href={categoryHref(child.slug)}
											class="block rounded-md px-3 py-1.5 text-sm text-shop-muted hover:bg-shop-subtle hover:text-shop-ink"
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
							class="block border-b border-shop-border/70 px-0 py-3 text-sm font-semibold text-shop-ink hover:text-shop-blue"
							onclick={() => (menuOpen = false)}
						>
							{entry.name}
						</a>
					{/if}
				{/each}
			</Accordion>

			<a
				href="/recherche"
				class="mt-4 block border border-shop-border bg-shop-subtle px-4 py-3 text-center text-sm font-semibold text-shop-blue hover:bg-primary-100"
				onclick={() => (menuOpen = false)}
			>
				Voir tout le catalogue
			</a>
		</div>
	</Drawer>

	<!-- Contenu de la page -->
	<main class="mx-auto w-full max-w-[1360px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
		{@render children()}
	</main>

	<!-- Pied de page -->
	<Footer class="rounded-none bg-primary-800 text-white">
		<div
			class="mx-auto grid w-full max-w-[1360px] gap-8 px-4 py-10 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8"
		>
			<div>
				<h2
					class="mb-3 font-display text-[13px] font-bold tracking-[0.1em] text-shop-orange-light uppercase"
				>
					MS Shop
				</h2>
				<p class="text-xs font-semibold tracking-wide text-primary-200 uppercase">Hotline</p>
				<a href="tel:0950922336" class="mt-1 block text-2xl font-extrabold text-white">
					09 50 92 23 36
				</a>
				<p class="mt-1 text-sm text-primary-200">9h/12h – 14h/18h · Fermé sam. dim.</p>
				<p class="mt-4 text-sm leading-6 text-primary-200">
					<span class="font-semibold text-white">Magasin & atelier</span><br />
					4 La Merrerie, 50570 Carantilly
				</p>
			</div>
			<div>
				<h2
					class="mb-3 font-display text-[13px] font-bold tracking-[0.1em] text-shop-orange-light uppercase"
				>
					Informations
				</h2>
				<FooterLinkGroup class="space-y-2 text-sm text-primary-200">
					{#each infoLinks as label (label)}
						<FooterLink href={resolve('/')} class="hover:text-white hover:underline">
							{label}
						</FooterLink>
					{/each}
				</FooterLinkGroup>
			</div>
			<div>
				<h2
					class="mb-3 font-display text-[13px] font-bold tracking-[0.1em] text-shop-orange-light uppercase"
				>
					Nos rayons
				</h2>
				<FooterLinkGroup class="space-y-2 text-sm text-primary-200">
					{#each data.menu.slice(0, 6) as entry (entry.id)}
						<FooterLink href="/categorie/{entry.slug}" class="hover:text-white hover:underline">
							{entry.name}
						</FooterLink>
					{/each}
				</FooterLinkGroup>
			</div>
			<div>
				<h2
					class="mb-3 font-display text-[13px] font-bold tracking-[0.1em] text-shop-orange-light uppercase"
				>
					Nos univers marques
				</h2>
				<ul class="space-y-2 text-sm text-primary-200">
					<li>EGO Power+ — Outils sans fil 56V</li>
					<li>Navimow Segway — Robots tondeuses</li>
					<li>ISEKI — Micro-tracteurs & pièces</li>
					<li>Etesia — Tondeuses professionnelles</li>
					<li>Outils Wolf — Tondeuses & jardin</li>
					<li>Roques & Lecoeur — Débroussaillage</li>
				</ul>
			</div>
		</div>
		<div class="border-t border-white/10">
			<div
				class="mx-auto flex w-full max-w-[1360px] flex-col items-center justify-between gap-3 px-4 py-4 sm:flex-row sm:px-6 lg:px-8"
			>
				<FooterCopyright
					href={resolve('/')}
					by="MS Shop — Meca Services"
					year={new Date().getFullYear()}
					class="text-primary-200"
					classes={{ link: 'text-white hover:underline' }}
				/>
				<p class="flex flex-wrap items-center justify-center gap-2 text-xs text-primary-200">
					<span>Paiement sécurisé</span>
					{#each ['CB', 'Visa', 'Mastercard', 'Sofinco 3×-4×'] as mean (mean)}
						<span class="rounded border border-white/20 px-2 py-0.5 font-semibold text-white">
							{mean}
						</span>
					{/each}
				</p>
			</div>
		</div>
	</Footer>
</div>
