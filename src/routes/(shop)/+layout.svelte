<script lang="ts">
	import { resolve } from '$app/paths';
	import {
		Badge,
		Button,
		CloseButton,
		Drawer,
		Accordion,
		AccordionItem,
		Footer,
		FooterCopyright,
		FooterLink,
		FooterLinkGroup,
		Search
	} from 'flowbite-svelte';
	import {
		BarsOutline,
		CartOutline,
		LockSolid,
		PhoneSolid,
		ShieldCheckSolid,
		ToolsOutline,
		UserCircleOutline
	} from 'flowbite-svelte-icons';
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
	<header class="sticky top-0 z-30 border-b border-shop-border bg-white">
		<!-- Bandeau utilitaire : contact et réassurance -->
		<div class="hidden border-b border-shop-border/70 bg-shop-subtle sm:block">
			<div
				class="mx-auto flex w-full max-w-screen-2xl items-center justify-between px-4 py-1.5 text-xs text-shop-muted sm:px-6 lg:px-8"
			>
				<div class="flex items-center gap-4">
					<a
						href="tel:0950922336"
						class="flex items-center gap-1.5 font-semibold text-shop-blue hover:underline"
					>
						<PhoneSolid class="h-3.5 w-3.5" /> 09 50 92 23 36
					</a>
					<span class="hidden md:inline">9h/12h – 14h/18h · Fermé sam. dim.</span>
				</div>
				<div class="flex items-center gap-5">
					<span class="hidden items-center gap-1.5 lg:flex">
						<ShieldCheckSolid class="h-3.5 w-3.5 text-shop-blue" /> Pièces 100 % origine
					</span>
					<span class="hidden items-center gap-1.5 lg:flex">
						<ToolsOutline class="h-3.5 w-3.5 text-shop-blue" /> S.A.V toutes marques
					</span>
					<span class="flex items-center gap-1.5">
						<LockSolid class="h-3.5 w-3.5 text-shop-blue" /> Paiement sécurisé
					</span>
				</div>
			</div>
		</div>

		<!-- Ligne principale : logo, recherche, compte, panier.
		     Sur 1,3 M de références la recherche est le premier geste : elle
		     occupe le centre et la plus grande largeur. -->
		<div
			class="mx-auto flex w-full max-w-screen-2xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3.5 sm:px-6 lg:px-8"
		>
			<a href={resolve('/')} class="shrink-0">
				<span class="block text-2xl leading-none font-black tracking-tight text-shop-blue">
					MECA <span class="text-shop-red">SERVICES</span>
				</span>
				<span class="text-[11px] tracking-widest text-shop-muted uppercase">
					Motoculture · Pièces détachées
				</span>
			</a>

			<form
				action="/recherche"
				method="get"
				class="order-3 w-full min-w-0 flex-1 md:order-none md:mx-auto md:w-auto lg:max-w-2xl"
			>
				<Search
					name="q"
					size="md"
					placeholder="Rechercher une pièce, une référence, un EAN…"
					class="border-shop-border bg-shop-subtle focus:border-primary-600 focus:bg-white"
				/>
			</form>

			<div class="ms-auto flex shrink-0 items-center gap-2 md:ms-0">
				<a
					href={resolve('/admin/login')}
					class="hidden items-center gap-2.5 rounded-lg px-3 py-2 transition hover:bg-shop-subtle sm:flex"
				>
					<UserCircleOutline class="h-7 w-7 text-shop-muted" />
					<span class="hidden text-left lg:block">
						<span class="block text-xs text-shop-muted">Bonjour</span>
						<span class="block text-sm leading-tight font-semibold text-shop-ink">
							{data.shopUser ? data.shopUser.name : 'Mon compte'}
						</span>
					</span>
				</a>

				<Button href="#panier" class="gap-2">
					<CartOutline class="h-5 w-5" />
					<span class="hidden sm:inline">Panier</span>
					<Badge rounded class="bg-white px-2 text-primary-700">0</Badge>
				</Button>
			</div>
		</div>

		<!-- Barre des rayons : accès au menu latéral + raccourcis directs -->
		<nav
			class="mx-auto flex w-full max-w-screen-2xl items-center gap-1 px-4 pb-2.5 sm:px-6 lg:px-8"
			aria-label="Navigation principale"
		>
			<Button size="sm" class="me-2 shrink-0 gap-2" onclick={() => (menuOpen = true)}>
				<BarsOutline class="h-4 w-4" />
				Tous nos rayons
			</Button>

			<div class="hidden items-center gap-0.5 overflow-x-auto lg:flex">
				{#each data.menu as entry (entry.id)}
					{#if isClearance(entry.slug)}
						<a
							href={categoryHref(entry.slug)}
							class="ms-1 rounded-full bg-shop-orange px-3 py-1.5 text-sm font-semibold whitespace-nowrap text-white transition hover:bg-shop-orange-light"
						>
							{entry.name}
						</a>
					{:else}
						<a
							href={categoryHref(entry.slug)}
							class="rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap text-shop-ink transition hover:bg-shop-subtle hover:text-shop-blue"
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
				<p class="text-sm leading-6 text-primary-200">
					<span class="font-semibold text-white">Magasin</span><br />
					4 La Merrerie, 50570 Carantilly
				</p>
				<p class="mt-3 text-sm leading-6 text-primary-200">
					<span class="font-semibold text-white">Contact</span><br />
					09 50 92 23 36<br />
					9h/12h – 14h/18h · Fermé sam. dim.
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
				<h2 class="mb-3 text-sm font-bold tracking-wider text-white uppercase">Produits</h2>
				<FooterLinkGroup class="space-y-2 text-sm text-primary-200">
					<FooterLink href="/recherche" class="hover:text-white hover:underline">
						Promotions
					</FooterLink>
					<FooterLink href="/recherche" class="hover:text-white hover:underline">
						Nouveaux produits
					</FooterLink>
					<FooterLink href="/recherche" class="hover:text-white hover:underline">
						Meilleures ventes
					</FooterLink>
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
			<div class="mx-auto w-full max-w-screen-2xl px-4 py-4 sm:px-6 lg:px-8">
				<FooterCopyright
					href={resolve('/')}
					by="MS Shop — Meca Services"
					year={new Date().getFullYear()}
					class="text-primary-200"
					classes={{ link: 'text-white hover:underline' }}
				/>
			</div>
		</div>
	</Footer>
</div>
