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
		BarsOutline,
		CartOutline,
		LockSolid,
		PhoneSolid,
		SearchOutline,
		ShieldCheckSolid,
		ToolsOutline,
		UserCircleOutline
	} from 'flowbite-svelte-icons';
	import { ArrowRightToBracketOutline } from 'flowbite-svelte-icons';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	/** Menu latéral des rayons — un seul panneau pour mobile et desktop. */
	let menuOpen = $state(false);

	const categoryHref = (slug: string) => `/categorie/${slug}`;
	const isClearance = (slug: string) => slug.includes('destockage');

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

<div class="flex min-h-screen flex-col bg-white">
	<header class="sticky top-0 z-30 bg-white">
		<!-- Bandeau utilitaire : hotline à gauche, horaires à droite -->
		<div class="hidden border-b border-shop-border/70 sm:block">
			<div
				class="mx-auto flex w-full max-w-screen-2xl items-center justify-between px-4 py-2 text-xs sm:px-6 lg:px-8"
			>
				<div class="flex items-center gap-3">
					<span class="rounded-full bg-shop-subtle px-3 py-1 font-medium text-shop-ink">
						Hotline
					</span>
					<a href="tel:0950922336" class="font-bold text-shop-ink hover:text-shop-blue">
						<PhoneSolid class="me-1 inline h-3.5 w-3.5 text-shop-blue" /> 09 50 92 23 36
					</a>
				</div>
				<p class="text-shop-muted">9h/12h – 14h/18h · Fermé samedi et dimanche</p>
			</div>
		</div>

		<!-- Ligne principale : logo à gauche, compte et panier à droite -->
		<div
			class="mx-auto flex w-full max-w-screen-2xl items-center justify-between gap-6 px-4 py-4 sm:px-6 lg:px-8"
		>
			<a href={resolve('/')} class="shrink-0">
				<span class="block text-2xl leading-none font-black tracking-tight text-shop-blue">
					MECA <span class="text-shop-red">SERVICES</span>
				</span>
				<span class="text-[11px] tracking-widest text-shop-muted uppercase">
					Motoculture · Pièces détachées
				</span>
			</a>

			<div class="flex shrink-0 items-center gap-2 sm:gap-5">
				{#if data.shopUser}
					<!-- Client connecté : le bloc ouvre le menu du compte. -->
					<button type="button" class="group flex items-center gap-3">
						<span
							class="flex h-11 w-11 items-center justify-center rounded-full bg-shop-subtle transition-colors group-hover:bg-primary-100"
						>
							<UserCircleOutline class="h-5 w-5 text-shop-ink" />
						</span>
						<span class="hidden text-left lg:block">
							<span class="block text-[10px] font-medium tracking-wide text-shop-muted uppercase">
								Bonjour
							</span>
							<span class="block max-w-32 truncate text-sm leading-tight font-bold text-shop-ink">
								{data.shopUser.name}
							</span>
						</span>
					</button>
					<Dropdown simple class="w-52 p-1">
						<a
							href="/compte"
							class="block rounded-lg px-3 py-2 text-sm font-medium text-shop-ink hover:bg-shop-subtle"
						>
							Mon compte
						</a>
						<!-- Formulaire hors DropdownItem : celui-ci rend un lien, qui ne peut
						     pas contenir de bouton de soumission. -->
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
					<a href="/connexion" class="group flex items-center gap-3">
						<span
							class="flex h-11 w-11 items-center justify-center rounded-full bg-shop-subtle transition-colors group-hover:bg-primary-100"
						>
							<UserCircleOutline class="h-5 w-5 text-shop-ink" />
						</span>
						<span class="hidden text-left lg:block">
							<span class="block text-[10px] font-medium tracking-wide text-shop-muted uppercase">
								Bonjour
							</span>
							<span class="block text-sm leading-tight font-bold text-shop-ink">Mon compte</span>
						</span>
					</a>
				{/if}

				<a href="/panier" class="group flex items-center gap-3">
					<span
						class="relative flex h-11 w-11 items-center justify-center rounded-full bg-shop-subtle transition-colors group-hover:bg-primary-100"
					>
						<CartOutline class="h-5 w-5 text-shop-ink" />
						{#if data.cartCount > 0}
							<span
								class="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-shop-red px-1 text-[11px] font-bold text-white"
							>
								{data.cartCount}
							</span>
						{/if}
					</span>
					<span class="hidden text-left lg:block">
						<span class="block text-[10px] font-medium tracking-wide text-shop-muted uppercase">
							Panier
						</span>
						<span class="block text-sm leading-tight font-bold text-shop-ink">
							{data.cartCount} article{data.cartCount > 1 ? 's' : ''}
						</span>
					</span>
				</a>
			</div>
		</div>

		<!-- Barre bleue : recherche en pilule (rayons intégrés) + réassurance -->
		<div class="bg-shop-blue">
			<div
				class="mx-auto flex w-full max-w-screen-2xl items-center gap-8 px-4 py-3 sm:px-6 lg:px-8"
			>
				<form action="/recherche" method="get" class="min-w-0 flex-1 lg:max-w-3xl">
					<div class="flex h-11 items-center rounded-full bg-white p-1">
						<button
							type="button"
							class="flex h-full shrink-0 items-center gap-2 rounded-full px-4 text-sm font-bold text-shop-ink transition-colors hover:bg-shop-subtle"
							onclick={() => (menuOpen = true)}
						>
							<BarsOutline class="h-4 w-4" />
							<span class="hidden sm:inline">Tous nos rayons</span>
						</button>
						<span class="h-5 w-px shrink-0 bg-shop-border" aria-hidden="true"></span>
						<input
							type="search"
							name="q"
							placeholder="Rechercher une pièce, une référence, un EAN…"
							class="h-full w-full min-w-0 border-0 bg-transparent px-4 text-sm text-shop-ink placeholder:text-shop-muted focus:ring-0"
						/>
						<button
							type="submit"
							class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-shop-blue text-white transition-colors hover:bg-shop-blue-dark"
							aria-label="Rechercher"
						>
							<SearchOutline class="h-4 w-4" />
						</button>
					</div>
				</form>

				<div
					class="hidden shrink-0 items-center gap-8 text-xs font-semibold tracking-wide text-white uppercase xl:flex"
				>
					<span class="flex items-center gap-2">
						<ShieldCheckSolid class="h-4 w-4" /> Pièces 100 % origine
					</span>
					<span class="flex items-center gap-2">
						<ToolsOutline class="h-4 w-4" /> S.A.V toutes marques
					</span>
					<span class="flex items-center gap-2">
						<LockSolid class="h-4 w-4" /> Paiement sécurisé
					</span>
				</div>
			</div>
		</div>

		<!-- Raccourcis rayons -->
		<nav class="hidden border-b border-shop-border/70 lg:block" aria-label="Navigation principale">
			<div
				class="mx-auto flex w-full max-w-screen-2xl items-center gap-0.5 overflow-x-auto px-4 py-1.5 sm:px-6 lg:px-8"
			>
				{#each data.menu as entry (entry.id)}
					{#if isClearance(entry.slug)}
						<a
							href={categoryHref(entry.slug)}
							class="ms-1 rounded-full bg-shop-orange px-3 py-1 text-[13px] font-semibold whitespace-nowrap text-white transition hover:bg-shop-orange-light"
						>
							{entry.name}
						</a>
					{:else}
						<a
							href={categoryHref(entry.slug)}
							class="rounded-md px-3 py-1 text-[13px] font-medium whitespace-nowrap text-shop-ink transition hover:bg-shop-subtle hover:text-shop-blue"
						>
							{entry.name}
						</a>
					{/if}
				{/each}
			</div>
		</nav>
	</header>

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
				class="mt-4 block rounded-lg bg-shop-subtle px-4 py-3 text-center text-sm font-semibold text-shop-blue hover:bg-primary-100"
				onclick={() => (menuOpen = false)}
			>
				Voir tout le catalogue
			</a>
		</div>
	</Drawer>

	<!-- Contenu de la page -->
	<main class="mx-auto w-full max-w-screen-2xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
		{@render children()}
	</main>

	<!-- Pied de page -->
	<Footer class="rounded-none bg-primary-800 text-white">
		<div
			class="mx-auto grid w-full max-w-screen-2xl gap-8 px-4 py-10 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8"
		>
			<div>
				<h2 class="mb-3 text-sm font-bold tracking-wider text-white uppercase">MS Shop</h2>
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
				<h2 class="mb-3 text-sm font-bold tracking-wider text-white uppercase">Informations</h2>
				<FooterLinkGroup class="space-y-2 text-sm text-primary-200">
					{#each infoLinks as label (label)}
						<FooterLink href={resolve('/')} class="hover:text-white hover:underline">
							{label}
						</FooterLink>
					{/each}
				</FooterLinkGroup>
			</div>
			<div>
				<h2 class="mb-3 text-sm font-bold tracking-wider text-white uppercase">Nos rayons</h2>
				<FooterLinkGroup class="space-y-2 text-sm text-primary-200">
					{#each data.menu.slice(0, 6) as entry (entry.id)}
						<FooterLink href="/categorie/{entry.slug}" class="hover:text-white hover:underline">
							{entry.name}
						</FooterLink>
					{/each}
				</FooterLinkGroup>
			</div>
			<div>
				<h2 class="mb-3 text-sm font-bold tracking-wider text-white uppercase">
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
				class="mx-auto flex w-full max-w-screen-2xl flex-col items-center justify-between gap-3 px-4 py-4 sm:flex-row sm:px-6 lg:px-8"
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
