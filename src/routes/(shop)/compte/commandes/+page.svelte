<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { Popover, Select } from 'flowbite-svelte';
	import {
		ChevronDownOutline,
		FileLinesOutline,
		RefreshOutline,
		SearchOutline,
		TruckOutline
	} from 'flowbite-svelte-icons';
	import Panel from '$lib/components/shop/Panel.svelte';
	import Breadcrumb from '$lib/components/shop/Breadcrumb.svelte';
	import Heading from '$lib/components/shop/Heading.svelte';
	import ShopButton from '$lib/components/shop/ShopButton.svelte';
	import Pagination from '$lib/components/shop/Pagination.svelte';
	import { notifyAddedToCart } from '$lib/components/shop/cart-feedback.svelte';
	import { formatPrice, shopProductPath } from '$lib/shop';
	import { priceSuffix } from '$lib/tax';
	import type { PageProps } from './$types';

	/**
	 * Historique de commandes, sur le modèle des grandes places de marché :
	 * recherche, onglets, filtre de période, puis une carte par commande
	 * (bandeau récapitulatif, statut, articles, actions).
	 */

	let { data }: PageProps = $props();

	type OrderCard = (typeof data.orders)[number];

	/** Mode d'affichage du client : TTC au particulier, HT au professionnel (P2). */
	const suffix = $derived(priceSuffix(data.tax.displayMode));
	const amountOf = (o: OrderCard) => (data.tax.displayMode === 'ht' ? o.totalHt : o.totalTtc);

	const longDate = new Intl.DateTimeFormat('fr-FR', {
		day: 'numeric',
		month: 'long',
		year: 'numeric'
	});
	const shortDate = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' });

	const tabs = [
		{ key: 'commandes', label: 'Commandes' },
		{ key: 'racheter', label: 'Acheter à nouveau' },
		{ key: 'en-attente', label: "En attente d'expédition" }
	] as const;

	const periods = $derived([
		{ value: '3m', name: 'les 3 derniers mois' },
		{ value: '6m', name: 'les 6 derniers mois' },
		{ value: '12m', name: 'les 12 derniers mois' },
		...data.years.map((y) => ({ value: String(y), name: String(y) })),
		{ value: 'all', name: 'toutes les commandes' }
	]);

	/** Lien vers un onglet : recherche et période conservées, la page repart à 1. */
	function tabHref(key: string, { withSearch = true } = {}) {
		const entries: [string, string][] = [];
		if (key !== 'commandes') entries.push(['onglet', key]);
		if (withSearch && data.q) entries.push(['q', data.q]);
		if (data.period !== 'all') entries.push(['periode', data.period]);
		const query = new URLSearchParams(entries).toString();
		return query ? `?${query}` : page.url.pathname;
	}

	function applyPeriod(event: Event) {
		const value = (event.currentTarget as HTMLSelectElement).value;
		const entries = [...page.url.searchParams.entries()].filter(
			([key]) => key !== 'periode' && key !== 'page'
		);
		if (value !== 'all') entries.push(['periode', value]);
		goto(`?${new URLSearchParams(entries)}`, { keepFocus: true, noScroll: true });
	}

	/** Titre de statut de la carte : la date de livraison prime sur le libellé. */
	function statusTitle(o: OrderCard) {
		if (o.deliveredAt) return `Livrée le ${shortDate.format(o.deliveredAt)}`;
		return o.stateLabel;
	}

	/** Destinataire figé à l'achat (R3), ou le point relais retenu. */
	type FrozenAddress = {
		firstName?: string;
		lastName?: string;
		company?: string;
		line1?: string;
		line2?: string;
		postalCode?: string;
		city?: string;
	};
	const addressOf = (o: OrderCard) => o.shippingAddress as FrozenAddress | null;
	const recipientOf = (o: OrderCard) => {
		const a = addressOf(o);
		const name = [a?.firstName, a?.lastName].filter(Boolean).join(' ');
		return name || a?.company || null;
	};

	const rebuyFeedback = (name: string) => {
		return async ({
			result,
			update
		}: {
			result: { type: string };
			update: (opts?: { reset?: boolean }) => Promise<void>;
		}) => {
			await update({ reset: false });
			if (result.type === 'success') notifyAddedToCart(`« ${name} » ajouté au panier.`);
		};
	};

	const linkClass = 'font-semibold text-shop-blue hover:text-shop-blue-dark hover:underline';
</script>

<svelte:head>
	<title>Mes commandes — MS Shop</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<Breadcrumb items={[{ label: 'Mon compte', href: '/compte' }, { label: 'Mes commandes' }]} />

<!-- ================= En-tête : titre + recherche ================= -->
<div class="flex flex-wrap items-center justify-between gap-4">
	<h1 class="font-display text-2xl font-extrabold tracking-[-0.02em] text-shop-ink sm:text-[30px]">
		Mes commandes
	</h1>

	<form method="GET" role="search" class="flex w-full gap-2 sm:w-auto">
		{#if data.tab !== 'commandes' && data.tab !== 'racheter'}
			<input type="hidden" name="onglet" value={data.tab} />
		{/if}
		{#if data.period !== 'all'}
			<input type="hidden" name="periode" value={data.period} />
		{/if}
		<label class="relative min-w-0 flex-1 sm:w-80">
			<span class="sr-only">Rechercher dans mes commandes</span>
			<SearchOutline
				class="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-shop-muted"
			/>
			<input
				type="search"
				name="q"
				value={data.q}
				placeholder="Référence, article, n° de commande…"
				class="w-full rounded-[10px] border-[1.5px] border-shop-border bg-white py-2.5 pr-3 pl-9 text-sm text-shop-ink placeholder:text-shop-faint focus:border-shop-blue focus:ring-0"
			/>
		</label>
		<ShopButton type="submit" variant="primary" size="sm">Rechercher</ShopButton>
	</form>
</div>

<!-- ================= Onglets ================= -->
<nav
	class="mt-5 flex gap-1 overflow-x-auto border-b-[1.5px] border-shop-border-soft"
	aria-label="Vues de l'historique"
>
	{#each tabs as tab (tab.key)}
		{@const current = data.tab === tab.key}
		<a
			href={tabHref(tab.key)}
			aria-current={current ? 'page' : undefined}
			class="-mb-[1.5px] shrink-0 border-b-[3px] px-4 py-2.5 text-sm whitespace-nowrap transition-colors {current
				? 'border-shop-orange font-bold text-shop-ink'
				: 'border-transparent font-semibold text-shop-blue hover:text-shop-blue-dark'}"
		>
			{tab.label}
		</a>
	{/each}
</nav>

{#if data.tab === 'racheter'}
	<!-- ================= Acheter à nouveau ================= -->
	{#if data.rebuy.length === 0}
		<Panel class="mt-6 p-6">
			<Heading size="card">Rien à racheter pour l'instant</Heading>
			<p class="mt-2 max-w-[52ch] text-[14.5px] text-shop-muted">
				Les articles de vos commandes passées, toujours au catalogue, apparaîtront ici.
			</p>
		</Panel>
	{:else}
		<ul class="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
			{#each data.rebuy as item (item.id)}
				{@const available = item.stock > 0}
				<li>
					<Panel class="flex h-full gap-4 p-4">
						<a
							href={shopProductPath(item)}
							class="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-[10px] border-[1.5px] border-shop-border-soft bg-white p-1"
						>
							{#if item.imageUrl}
								<img
									src={item.imageUrl}
									alt={item.imageIsBrandLogo ? (item.brandName ?? '') : ''}
									loading="lazy"
									class="max-h-full max-w-full object-contain {item.imageIsBrandLogo ? 'p-2' : ''}"
								/>
							{:else}
								<span class="h-full w-full rounded-md bg-shop-subtle" aria-hidden="true"></span>
							{/if}
						</a>
						<div class="flex min-w-0 flex-1 flex-col">
							<a href={shopProductPath(item)} class="line-clamp-2 text-[14.5px] {linkClass}">
								{item.name}
							</a>
							<p class="mt-0.5 text-[12.5px] text-shop-muted">Réf. {item.reference}</p>
							{#if item.lastBoughtAt}
								<p class="mt-0.5 text-[12.5px] text-shop-muted">
									Acheté le {longDate.format(new Date(item.lastBoughtAt))}
								</p>
							{/if}
							<form
								method="POST"
								action="/panier?/add"
								use:enhance={() => rebuyFeedback(item.name)}
								class="mt-auto pt-3"
							>
								<input type="hidden" name="productId" value={item.id} />
								<input type="hidden" name="quantity" value="1" />
								<ShopButton
									type="submit"
									variant="buy"
									size="sm"
									class="rounded-full"
									disabled={!available}
								>
									<RefreshOutline class="h-4 w-4" />
									{available ? 'Acheter à nouveau' : 'Indisponible'}
								</ShopButton>
							</form>
						</div>
					</Panel>
				</li>
			{/each}
		</ul>
	{/if}
{:else}
	<!-- ================= Compteur + période ================= -->
	<div class="mt-5 flex flex-wrap items-center gap-3">
		<p class="text-sm text-shop-ink">
			<span class="font-bold">
				{data.total} commande{data.total > 1 ? 's' : ''}
			</span>
			{data.tab === 'en-attente' ? 'en attente' : `passée${data.total > 1 ? 's' : ''}`}
			{#if data.q}pour « {data.q} »{/if}
		</p>
		<label class="flex items-center gap-2">
			<span class="sr-only">Période</span>
			<Select
				items={periods}
				value={data.period}
				onchange={applyPeriod}
				size="sm"
				class="w-52 rounded-[10px] border-[1.5px] border-shop-border focus:border-shop-blue focus:ring-0"
			/>
		</label>
		{#if data.q}
			<a href={tabHref(data.tab, { withSearch: false })} class="text-sm {linkClass}">
				Effacer la recherche
			</a>
		{/if}
	</div>

	{#if data.orders.length === 0}
		<Panel class="mt-6 p-6">
			<Heading size="card">Aucune commande</Heading>
			<p class="mt-2 max-w-[52ch] text-[14.5px] text-shop-muted">
				{#if data.q || data.period !== 'all'}
					Aucune commande ne correspond à ces critères. Essayez une autre période ou une autre
					recherche.
				{:else if data.tab === 'en-attente'}
					Toutes vos commandes ont été expédiées.
				{:else}
					Vos commandes s'afficheront ici, avec leur suivi et leurs documents.
				{/if}
			</p>
			<div class="mt-5">
				<ShopButton variant="primary" href="/recherche">Parcourir le catalogue</ShopButton>
			</div>
		</Panel>
	{:else}
		<div class="mt-5 space-y-5">
			{#each data.orders as item (item.id)}
				{@const recipient = recipientOf(item)}
				{@const address = addressOf(item)}
				<article class="overflow-hidden rounded-[14px] border-[1.5px] border-shop-border">
					<!-- Bandeau récapitulatif -->
					<header
						class="flex flex-wrap items-start justify-between gap-x-8 gap-y-3 border-b-[1.5px] border-shop-border bg-shop-subtle px-5 py-3.5 text-[13px]"
					>
						<dl class="flex flex-wrap gap-x-8 gap-y-2">
							<div>
								<dt class="text-[11px] font-semibold tracking-[0.04em] text-shop-muted uppercase">
									Commande effectuée le
								</dt>
								<dd class="mt-0.5 text-shop-ink">{longDate.format(item.createdAt)}</dd>
							</div>
							<div>
								<dt class="text-[11px] font-semibold tracking-[0.04em] text-shop-muted uppercase">
									Total
								</dt>
								<dd class="mt-0.5 text-shop-ink">
									{formatPrice(amountOf(item))}
									<span class="text-shop-muted">{suffix}</span>
								</dd>
							</div>
							{#if recipient || item.relayPointName}
								<div>
									<dt class="text-[11px] font-semibold tracking-[0.04em] text-shop-muted uppercase">
										Livraison à
									</dt>
									<dd class="mt-0.5">
										<button
											type="button"
											id="ship-{item.id}"
											class="inline-flex items-center gap-1 {linkClass} font-normal"
										>
											{item.relayPointName ? `Relais ${item.relayPointName}` : recipient}
											<ChevronDownOutline class="h-3.5 w-3.5" />
										</button>
										<Popover
											triggeredBy="#ship-{item.id}"
											trigger="click"
											placement="bottom-start"
											class="w-64 text-[13px]"
										>
											<address class="leading-relaxed text-shop-ink not-italic">
												{#if recipient}<span class="font-bold">{recipient}</span><br />{/if}
												{#if address?.company && address.company !== recipient}{address.company}<br
													/>{/if}
												{#if address?.line1}{address.line1}<br />{/if}
												{#if address?.line2}{address.line2}<br />{/if}
												{#if address?.postalCode || address?.city}
													{address?.postalCode} {address?.city}
												{/if}
												{#if item.relayPointName}
													<span class="mt-2 block text-shop-muted">
														Point relais : {item.relayPointName}
													</span>
												{/if}
											</address>
										</Popover>
									</dd>
								</div>
							{/if}
						</dl>

						<div class="text-left sm:text-right">
							<p class="text-[11px] font-semibold tracking-[0.04em] text-shop-muted uppercase">
								N° de commande {item.reference}
							</p>
							<p class="mt-0.5 flex flex-wrap items-center gap-x-3 sm:justify-end">
								<a href="/compte/commandes/{item.id}" class={linkClass}> Détails de la commande </a>
								{#if item.hasInvoice}
									<span class="h-3.5 w-px bg-shop-border" aria-hidden="true"></span>
									<a
										href="/compte/commandes/{item.id}/facture"
										target="_blank"
										rel="noopener"
										class={linkClass}
									>
										Facture
									</a>
								{/if}
							</p>
						</div>
					</header>

					<!-- Statut, articles et actions -->
					<div class="grid gap-5 bg-white p-5 md:grid-cols-[minmax(0,1fr)_260px]">
						<div class="min-w-0">
							<h2
								class="flex items-center gap-2 font-display text-lg font-extrabold tracking-[-0.01em] text-shop-ink"
							>
								<span
									class="h-2.5 w-2.5 shrink-0 rounded-full"
									style="background-color: {item.stateColor ?? '#314192'}"
									aria-hidden="true"
								></span>
								{statusTitle(item)}
							</h2>
							{#if item.isShipped && !item.deliveredAt && item.carrierName}
								<p class="mt-0.5 text-[13.5px] text-shop-muted">
									Colis confié à {item.carrierName}.
								</p>
							{/if}

							<ul class="mt-4 space-y-5">
								{#each item.lines as line (line.id)}
									{@const href =
										line.productId && line.productSlug
											? shopProductPath({ id: line.productId, slug: line.productSlug })
											: null}
									<li class="flex gap-4">
										<div
											class="flex h-[88px] w-[88px] shrink-0 items-center justify-center overflow-hidden rounded-[10px] border-[1.5px] border-shop-border-soft bg-white p-1"
										>
											{#if line.imageUrl}
												<img
													src={line.imageUrl}
													alt={line.imageIsBrandLogo ? (line.brandName ?? '') : ''}
													loading="lazy"
													class="max-h-full max-w-full object-contain {line.imageIsBrandLogo
														? 'p-2'
														: ''}"
												/>
											{:else}
												<span class="h-full w-full rounded-md bg-shop-subtle" aria-hidden="true"
												></span>
											{/if}
										</div>
										<div class="min-w-0 flex-1">
											{#if href}
												<a {href} class="line-clamp-2 text-[14.5px] {linkClass} font-normal">
													{line.productName}
												</a>
											{:else}
												<p class="line-clamp-2 text-[14.5px] text-shop-ink">{line.productName}</p>
											{/if}
											<p class="mt-0.5 text-[12.5px] text-shop-muted">
												{#if line.productReference}Réf. {line.productReference} ·{/if}
												Qté {line.quantity}
											</p>

											<div class="mt-2.5 flex flex-wrap gap-2">
												{#if line.productId && line.buyable}
													<form
														method="POST"
														action="/panier?/add"
														use:enhance={() => rebuyFeedback(line.productName)}
													>
														<input type="hidden" name="productId" value={line.productId} />
														<input type="hidden" name="quantity" value="1" />
														<ShopButton
															type="submit"
															variant="buy"
															size="sm"
															class="rounded-full !py-2"
														>
															<RefreshOutline class="h-4 w-4" />
															Acheter à nouveau
														</ShopButton>
													</form>
												{/if}
												{#if href}
													<ShopButton
														variant="outline"
														size="sm"
														{href}
														class="rounded-full !py-2 font-semibold"
													>
														Voir l'article
													</ShopButton>
												{/if}
											</div>
										</div>
									</li>
								{/each}
							</ul>
						</div>

						<div class="flex flex-col gap-2">
							{#if item.trackingUrl}
								<ShopButton
									variant="primary"
									size="sm"
									block
									href={item.trackingUrl}
									target="_blank"
									rel="noopener"
									class="rounded-full"
								>
									<TruckOutline class="h-4 w-4" /> Suivre le colis
								</ShopButton>
							{:else if item.trackingNumber}
								<p class="rounded-[10px] bg-shop-subtle px-3 py-2 text-center text-[13px]">
									Suivi : <span class="font-semibold">{item.trackingNumber}</span>
								</p>
							{/if}
							<ShopButton
								variant="outline"
								size="sm"
								block
								href="/compte/commandes/{item.id}"
								class="rounded-full"
							>
								Détails de la commande
							</ShopButton>
							{#if item.hasInvoice}
								<ShopButton
									variant="outline"
									size="sm"
									block
									href="/compte/commandes/{item.id}/facture"
									target="_blank"
									rel="noopener"
									class="rounded-full"
								>
									<FileLinesOutline class="h-4 w-4" /> Télécharger la facture
								</ShopButton>
							{/if}
							{#if item.deliveredAt}
								<ShopButton
									variant="outline"
									size="sm"
									block
									href="/compte/reparations"
									class="rounded-full"
								>
									Demander une réparation
								</ShopButton>
							{/if}
						</div>
					</div>
				</article>
			{/each}
		</div>

		<Pagination page={data.page} hasNextPage={data.hasNextPage} />
	{/if}
{/if}
