<script lang="ts">
	import { resolve } from '$app/paths';
	import {
		Badge,
		Button,
		Drawer,
		Dropdown,
		DropdownItem,
		Footer,
		FooterCopyright,
		Input
	} from 'flowbite-svelte';
	import {
		BarsOutline,
		CartSolid,
		ChevronDownOutline,
		LockSolid,
		PhoneSolid,
		SearchOutline,
		ShieldCheckSolid,
		ToolsOutline,
		UserCircleOutline
	} from 'flowbite-svelte-icons';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	let mobileMenuOpen = $state(false);

	const categoryHref = (slug: string) => resolve('/(shop)/categorie/[slug]', { slug });

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

<div class="flex min-h-screen flex-col bg-[#f7f7f7]">
	<header class="bg-white shadow-sm">
		<!-- Bandeau haut : contact + compte -->
		<div class="border-b border-gray-200">
			<div class="flex w-full items-center justify-between px-4 py-1.5 text-sm sm:px-6 lg:px-8">
				<div class="flex items-center gap-4">
					<span class="hidden text-gray-600 sm:inline">Nous contacter :</span>
					<a
						href="tel:0950922336"
						class="flex items-center gap-1.5 font-bold text-shop-red hover:underline"
					>
						<PhoneSolid class="h-4 w-4" /> 09 50 92 23 36
					</a>
					<span class="hidden text-gray-500 md:inline">9h/12h – 14h/18h · Fermé sam. dim.</span>
				</div>
				<a
					href={resolve('/admin/login')}
					class="flex items-center gap-1.5 text-gray-700 hover:text-shop-blue"
				>
					<UserCircleOutline class="h-5 w-5" />
					{data.shopUser ? data.shopUser.name : 'Mon compte'}
				</a>
			</div>
		</div>

		<!-- Ligne principale : logo, recherche, panier -->
		<div class="flex w-full flex-wrap items-center gap-4 px-4 py-4 sm:px-6 lg:px-8">
			<a href={resolve('/')} class="shrink-0">
				<span class="block text-2xl leading-none font-black tracking-tight text-shop-blue">
					MECA <span class="text-shop-red">SERVICES</span>
				</span>
				<span class="text-xs tracking-widest text-gray-500 uppercase">
					Motoculture · Pièces détachées
				</span>
			</a>

			<form action="/recherche" method="get" class="order-3 w-full flex-1 md:order-none md:w-auto">
				<div class="flex">
					<Input
						type="search"
						name="q"
						placeholder="Rechercher une pièce, une référence, un EAN…"
						class="rounded-e-none border-gray-300 bg-white focus:border-shop-blue focus:ring-shop-blue"
					/>
					<Button
						type="submit"
						class="rounded-s-none bg-shop-blue px-4 focus-within:ring-shop-blue-light hover:bg-shop-blue-dark"
						aria-label="Rechercher"
					>
						<SearchOutline class="h-5 w-5" />
					</Button>
				</div>
			</form>

			<Button
				href="#panier"
				class="ms-auto shrink-0 bg-shop-blue focus-within:ring-shop-blue-light hover:bg-shop-blue-dark"
			>
				<CartSolid class="me-2 h-5 w-5" />
				Panier
				<Badge rounded class="ms-2 bg-white px-2 text-shop-blue">0</Badge>
			</Button>
		</div>

		<!-- Barre de navigation catégories (bleu marine, comme l'ancienne boutique) -->
		<nav class="bg-shop-blue" aria-label="Catégories">
			<div class="w-full px-4 sm:px-6 lg:px-8">
				<!-- Mobile : bouton menu -->
				<button
					type="button"
					class="flex items-center gap-2 py-3 text-sm font-medium text-white lg:hidden"
					onclick={() => (mobileMenuOpen = true)}
				>
					<BarsOutline class="h-5 w-5" /> Menu
				</button>

				<!-- Desktop : catégories racines + sous-catégories en menu déroulant -->
				<ul class="hidden flex-wrap lg:flex">
					{#each data.menu as entry (entry.id)}
						<li>
							{#if entry.children.length > 0}
								<button
									type="button"
									id="shopnav-{entry.id}"
									class="flex items-center gap-1 px-4 py-3 text-sm font-medium text-white uppercase hover:bg-shop-blue-light"
								>
									{entry.name}
									<ChevronDownOutline class="h-4 w-4" />
								</button>
								<Dropdown simple triggeredBy="#shopnav-{entry.id}" class="min-w-56">
									<DropdownItem href={categoryHref(entry.slug)} class="font-semibold">
										Tout « {entry.name} »
									</DropdownItem>
									{#each entry.children as child (child.id)}
										<DropdownItem href={categoryHref(child.slug)}>{child.name}</DropdownItem>
									{/each}
								</Dropdown>
							{:else}
								<a
									href={categoryHref(entry.slug)}
									class="block px-4 py-3 text-sm font-medium text-white uppercase hover:bg-shop-blue-light"
								>
									{entry.name}
								</a>
							{/if}
						</li>
					{/each}
				</ul>
			</div>
		</nav>
	</header>

	<!-- Menu mobile -->
	<Drawer bind:open={mobileMenuOpen} placement="left" class="w-72">
		<div class="mb-4 flex items-center justify-between">
			<span class="text-lg font-bold text-shop-blue">Catégories</span>
			<button type="button" class="text-gray-500" onclick={() => (mobileMenuOpen = false)}>
				✕
			</button>
		</div>
		<ul class="space-y-1">
			{#each data.menu as entry (entry.id)}
				<li>
					<a
						href={categoryHref(entry.slug)}
						class="block rounded px-2 py-2 font-medium text-gray-900 hover:bg-gray-100"
						onclick={() => (mobileMenuOpen = false)}
					>
						{entry.name}
					</a>
					{#if entry.children.length > 0}
						<ul class="ms-3 border-s border-gray-200">
							{#each entry.children as child (child.id)}
								<li>
									<a
										href={categoryHref(child.slug)}
										class="block px-3 py-1.5 text-sm text-gray-600 hover:text-shop-blue"
										onclick={() => (mobileMenuOpen = false)}
									>
										{child.name}
									</a>
								</li>
							{/each}
						</ul>
					{/if}
				</li>
			{/each}
		</ul>
	</Drawer>

	<!-- Contenu de la page -->
	<main class="w-full flex-1 px-4 py-6 sm:px-6 lg:px-8">
		{@render children()}
	</main>

	<!-- Bande de réassurance (reprise de l'ancienne boutique) -->
	<section class="border-t border-gray-200 bg-white" aria-label="Nos garanties">
		<div class="grid w-full gap-6 px-4 py-8 sm:grid-cols-3 sm:px-6 lg:px-8">
			<div class="flex items-center gap-3">
				<ShieldCheckSolid class="h-9 w-9 shrink-0 text-shop-blue" />
				<p class="text-sm font-medium text-gray-800">
					Nos pièces détachées de marque sont 100 % origine
				</p>
			</div>
			<div class="flex items-center gap-3">
				<ToolsOutline class="h-9 w-9 shrink-0 text-shop-blue" />
				<p class="text-sm font-medium text-gray-800">Nous assurons le S.A.V de tous les produits</p>
			</div>
			<div class="flex items-center gap-3">
				<LockSolid class="h-9 w-9 shrink-0 text-shop-blue" />
				<p class="text-sm font-medium text-gray-800">Paiement sécurisé</p>
			</div>
		</div>
	</section>

	<!-- Pied de page (bleu marine, titres orange — charte de l'ancienne boutique) -->
	<Footer class="rounded-none bg-shop-blue text-white">
		<div class="grid w-full gap-8 px-4 py-10 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
			<div>
				<h2 class="mb-3 text-sm font-bold tracking-wider text-shop-orange uppercase">MS Shop</h2>
				<p class="text-sm leading-6">
					<span class="font-semibold">Magasin</span><br />
					4 La Merrerie, 50570 Carantilly
				</p>
				<p class="mt-3 text-sm leading-6">
					<span class="font-semibold">Contact</span><br />
					09 50 92 23 36<br />
					9h/12h – 14h/18h<br />
					Fermé samedi et dimanche
				</p>
			</div>
			<div>
				<h2 class="mb-3 text-sm font-bold tracking-wider text-shop-orange uppercase">
					Informations
				</h2>
				<ul class="space-y-2 text-sm">
					{#each infoLinks as label (label)}
						<li><a href={resolve('/')} class="hover:underline">{label}</a></li>
					{/each}
				</ul>
			</div>
			<div>
				<h2 class="mb-3 text-sm font-bold tracking-wider text-shop-orange uppercase">Produits</h2>
				<ul class="space-y-2 text-sm">
					<li><a href={resolve('/(shop)/recherche')} class="hover:underline">Promotions</a></li>
					<li>
						<a href={resolve('/(shop)/recherche')} class="hover:underline">Nouveaux produits</a>
					</li>
					<li>
						<a href={resolve('/(shop)/recherche')} class="hover:underline">Meilleures ventes</a>
					</li>
				</ul>
			</div>
			<div>
				<h2 class="mb-3 text-sm font-bold tracking-wider text-shop-orange uppercase">
					Nos univers marques
				</h2>
				<ul class="space-y-2 text-sm">
					<li>EGO Power+ — Outils sans fil 56V</li>
					<li>Navimow Segway — Robots tondeuses</li>
					<li>ISEKI — Micro-tracteurs & pièces</li>
					<li>Etesia — Tondeuses professionnelles</li>
					<li>Outils Wolf — Tondeuses & jardin</li>
					<li>Roques & Lecoeur — Débroussaillage</li>
				</ul>
			</div>
		</div>
		<div class="border-t border-shop-blue-light">
			<div class="w-full px-4 py-4 sm:px-6 lg:px-8">
				<FooterCopyright
					href={resolve('/')}
					by="MS Shop — Meca Services"
					year={new Date().getFullYear()}
					class="text-white"
					classes={{ link: 'text-white hover:underline' }}
				/>
			</div>
		</div>
	</Footer>
</div>
