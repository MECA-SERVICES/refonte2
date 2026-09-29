<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { ExclamationCircleOutline, TrashBinOutline } from 'flowbite-svelte-icons';
	import Breadcrumb from '$lib/components/shop/Breadcrumb.svelte';
	import ImagePlaceholder from '$lib/components/shop/ImagePlaceholder.svelte';
	import Panel from '$lib/components/shop/Panel.svelte';
	import ShopButton from '$lib/components/shop/ShopButton.svelte';
	import Heading from '$lib/components/shop/Heading.svelte';
	import SummaryRow from '$lib/components/shop/SummaryRow.svelte';
	import { formatPrice, shopProductPath } from '$lib/shop';
	import { computeCartTotals } from '$lib/cart';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const cart = $derived(data.cart);
	const lines = $derived(cart.lines);

	type Line = (typeof lines)[number];

	/** Un article inactif ou en rupture empêche de commander (règle R7). */
	const isBlocking = (line: Line) => !line.isActive || line.stock <= 0;

	/** Écart entre le prix du jour et celui de l'ajout (règle R11). */
	function priceDrift(line: Line) {
		if (!line.priceHtAtAdd) return 0;
		return Number(line.priceHt) - Number(line.priceHtAtAdd);
	}

	// -----------------------------------------------------------------------
	// Quantités : affichage optimiste, envoi « dernier clic gagne »
	//
	// Le chiffre affiché change au clic, sans attendre le serveur. L'envoi part
	// après une courte pause, et seul le dernier clic d'une rafale est transmis.
	//
	// Volontairement, on NE recharge PAS la page après coup : le serveur ne fait
	// que confirmer une valeur déjà à l'écran, et un rechargement ferait sauter
	// le chiffre. Les données ne sont rafraîchies qu'au retrait d'une ligne, où
	// la structure de la liste change réellement.
	//
	// La quantité minimale est 1 : pour retirer un article, on passe par le
	// bouton « Retirer », plus explicite qu'un décrément jusqu'à zéro.
	// -----------------------------------------------------------------------

	/** Quantités affichées en avance sur le serveur, par ligne. */
	let optimistic = $state<Record<number, number>>({});

	const shownQuantity = (line: Line) => optimistic[line.id] ?? line.quantity;

	/**
	 * Totaux recalculés sur les quantités affichées : le récapitulatif suit le
	 * clic. Le calcul est LE MÊME que celui du serveur (`computeCartTotals`,
	 * partagé via $lib/cart), régime compris : aucun écart ne peut apparaître
	 * entre l'affichage optimiste et la réponse.
	 */
	const shownTotals = $derived(
		computeCartTotals(
			lines.map((line) => ({ ...line, quantity: shownQuantity(line) })),
			data.tax.regime
		)
	);

	/** Éco-participation cumulée, comprise dans le total et rappelée à part (R6). */
	const shownEcotax = $derived(
		lines.reduce((sum, line) => sum + Number(line.ecotax ?? 0) * shownQuantity(line), 0)
	);

	/** Minuteries d'envoi par ligne : comptabilité interne, jamais affichée. */
	const timers: Record<number, ReturnType<typeof setTimeout>> = {};

	/**
	 * Intercepte la soumission du formulaire de quantité. Sans JavaScript, le
	 * formulaire poste normalement et la page se recharge — le parcours reste
	 * fonctionnel, simplement moins fluide.
	 */
	const queueQuantity: SubmitFunction = ({ formData, cancel }) => {
		cancel();

		const lineId = Number(formData.get('lineId'));
		const quantity = Math.max(1, Number(formData.get('quantity')));
		optimistic[lineId] = quantity;

		clearTimeout(timers[lineId]);
		timers[lineId] = setTimeout(() => void sendQuantity(lineId, quantity), 400);
	};

	async function sendQuantity(lineId: number, quantity: number) {
		const body = new FormData();
		body.set('lineId', String(lineId));
		body.set('quantity', String(quantity));

		await fetch('?/update', {
			method: 'POST',
			headers: { 'x-sveltekit-action': 'true' },
			body
		});

		// Recharge les données (dont le compteur d'en-tête). L'affichage optimiste
		// couvre l'attente : le chiffre à l'écran ne bouge pas pendant ce temps.
		await invalidateAll();
	}

	// Les envois en attente ne survivent pas à la page.
	$effect(() => () => Object.values(timers).forEach((timer) => clearTimeout(timer)));

	/**
	 * Étapes du tunnel. Seule la première est active : livraison et paiement
	 * attendent les sections 20 et 21 du cahier des charges.
	 */
	const steps = [
		{ n: 1, label: 'Mon panier', done: true },
		{ n: 2, label: 'Livraison', done: false },
		{ n: 3, label: 'Paiement', done: false }
	];
</script>

<svelte:head>
	<title>Mon panier — MS Shop</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<Breadcrumb items={[{ label: 'Mon panier' }]} />

<!-- ================= Étapes du tunnel ================= -->
<ol class="mb-7 flex items-center gap-3" aria-label="Étapes de la commande">
	{#each steps as step, i (step.n)}
		{#if i > 0}
			<li aria-hidden="true" class="h-px min-w-6 flex-1 bg-shop-border-soft sm:max-w-16"></li>
		{/if}
		<li>
			<span
				aria-current={step.done ? 'step' : undefined}
				class="flex items-center gap-2.5 {step.done ? '' : 'opacity-50'}"
			>
				<span
					class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-display text-sm font-bold {step.done
						? 'bg-shop-blue text-white'
						: 'bg-shop-subtle text-shop-muted'}"
				>
					{step.n}
				</span>
				<span class="hidden font-display text-sm font-bold text-shop-ink sm:inline">
					{step.label}
				</span>
			</span>
		</li>
	{/each}
</ol>

{#if form?.message}
	<p
		class="mb-5 rounded-[10px] border-[1.5px] border-shop-border-soft bg-white px-4 py-3 text-sm font-medium text-shop-ink"
	>
		{form.message}
	</p>
{/if}

{#if lines.length === 0}
	<!-- Panier vide : on renvoie vers le catalogue (parcours 5.7). -->
	<Panel padded={false} class="px-6 py-14 text-center">
		<p class="font-display text-lg font-extrabold text-shop-ink">Votre panier est vide.</p>
		<p class="mt-2 text-sm text-shop-muted">
			Parcourez le catalogue pour trouver la pièce ou le matériel qu'il vous faut.
		</p>
		<ShopButton href="/recherche" size="lg" class="mt-6">Découvrir le catalogue</ShopButton>
	</Panel>
{:else}
	<div class="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
		<!-- ================= Lignes ================= -->
		<Panel padded={false} class="min-w-0 overflow-hidden">
			{#each lines as line (line.id)}
				{@const drift = priceDrift(line)}
				{@const quantity = shownQuantity(line)}
				<div class="flex flex-wrap items-center gap-4 border-b border-shop-border-soft p-5">
					<a
						href={shopProductPath({ id: line.productId, slug: line.slug })}
						class="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-shop-subtle p-1.5"
					>
						{#if line.imageUrl}
							<img
								src={line.imageUrl}
								alt={line.name}
								loading="lazy"
								class="max-h-full max-w-full object-contain"
							/>
						{:else}
							<ImagePlaceholder label="Produit" class="border-0 bg-shop-subtle" />
						{/if}
					</a>

					<div class="min-w-0 flex-1 basis-52">
						{#if line.brandName}
							<p class="text-[11.5px] font-bold tracking-[0.1em] text-shop-muted uppercase">
								{line.brandName}
							</p>
						{/if}
						<a
							href={shopProductPath({ id: line.productId, slug: line.slug })}
							class="mt-0.5 block font-display text-base font-bold text-shop-ink hover:text-shop-blue"
						>
							{line.name}
						</a>
						<p class="mt-0.5 text-[12.5px] text-shop-faint">
							Réf. {line.reference} · {line.stock > 0 ? `En stock (${line.stock})` : 'Sur commande'}
						</p>

						{#if isBlocking(line)}
							<p
								class="mt-1.5 inline-flex items-center gap-1.5 rounded-[10px] bg-shop-promo px-2.5 py-1 text-xs font-bold text-shop-orange-deep"
							>
								<ExclamationCircleOutline class="h-4 w-4" />
								Indisponible — à retirer pour commander
							</p>
						{:else if drift > 0}
							<p class="mt-1.5 text-xs text-shop-orange-deep">Le prix a augmenté depuis l'ajout.</p>
						{:else if drift < 0}
							<p class="mt-1.5 text-xs text-shop-green">Le prix a baissé depuis l'ajout.</p>
						{/if}
					</div>

					<!-- Quantité : réponse immédiate, envoi différé (dernier clic gagne) -->
					<form method="POST" action="?/update" use:enhance={queueQuantity} class="shrink-0">
						<input type="hidden" name="lineId" value={line.id} />
						<div class="flex overflow-hidden rounded-[10px] border-[1.5px] border-shop-border">
							<button
								type="submit"
								name="quantity"
								value={quantity - 1}
								disabled={quantity <= 1}
								aria-label="Diminuer la quantité"
								class="bg-shop-subtle px-3.5 text-[17px] text-shop-ink-soft hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
							>
								−
							</button>
							<span
								class="min-w-8 px-1 py-2.5 text-center font-display font-bold text-shop-ink"
								aria-label="Quantité"
							>
								{quantity}
							</span>
							<button
								type="submit"
								name="quantity"
								value={quantity + 1}
								disabled={quantity >= line.stock}
								aria-label="Augmenter la quantité"
								class="bg-shop-subtle px-3.5 text-[17px] text-shop-ink-soft hover:bg-white disabled:opacity-40"
							>
								+
							</button>
						</div>
					</form>

					<div class="ms-auto shrink-0 text-right whitespace-nowrap">
						<p class="font-display text-lg font-extrabold tracking-[-0.01em] text-shop-red">
							{formatPrice(Number(line.priceTtc) * quantity)}
						</p>
						<p class="text-xs text-shop-muted">
							TTC · {formatPrice(line.priceTtc)} l'unité
						</p>
						<form method="POST" action="?/remove" use:enhance class="mt-1">
							<input type="hidden" name="lineId" value={line.id} />
							<button
								type="submit"
								class="inline-flex items-center gap-1 text-xs font-medium text-shop-muted hover:text-shop-red"
							>
								<TrashBinOutline class="h-3.5 w-3.5" /> Retirer
							</button>
						</form>
					</div>
				</div>
			{/each}

			<div class="flex flex-wrap justify-between gap-3 p-5 text-sm">
				<a href="/recherche" class="font-semibold text-shop-blue hover:underline">
					← Continuer mes achats
				</a>
				<span class="text-shop-muted">Préparation atelier : 24 h ouvrées</span>
			</div>
		</Panel>

		<!-- ================= Récapitulatif ================= -->
		<aside
			class="rounded-2xl border-[1.5px] border-shop-border-soft bg-white p-5 lg:sticky lg:top-44"
		>
			<Heading size="card" class="mb-4">Récapitulatif</Heading>

			<dl class="text-[14.5px] text-shop-ink-soft">
				<SummaryRow
					label="Sous-total ({shownTotals.itemCount} article{shownTotals.itemCount > 1 ? 's' : ''})"
				>
					{formatPrice(shownTotals.subtotalHt)} HT
				</SummaryRow>
				<SummaryRow label="TVA">{formatPrice(shownTotals.tax)}</SummaryRow>

				{#if shownEcotax > 0}
					<!-- Mention légale : l'éco-participation, comprise dans le prix,
					     doit apparaître distinctement (CDC 10, R6). -->
					<SummaryRow label="Dont éco-participation">{formatPrice(shownEcotax)}</SummaryRow>
				{/if}
				<SummaryRow label="Livraison" muted>Calculée à l'étape suivante</SummaryRow>
				<SummaryRow label="Préparation">24 h ouvrées</SummaryRow>
			</dl>

			<div
				class="mt-3 flex items-baseline justify-between gap-3 border-t-[1.5px] border-shop-border-soft pt-3.5"
			>
				<span class="font-display text-[17px] font-extrabold text-shop-ink">Total TTC</span>
				<span class="font-display text-[22px] font-extrabold tracking-[-0.01em] text-shop-red">
					{formatPrice(shownTotals.totalTtc)}
				</span>
			</div>

			{#if cart.hasBlockingLine}
				<p
					class="mt-4 rounded-[10px] bg-shop-promo px-3 py-2 text-xs font-bold text-shop-orange-deep"
				>
					Retirez les articles indisponibles pour poursuivre.
				</p>
			{/if}

			<ShopButton
				href={cart.hasBlockingLine ? undefined : '/commande'}
				variant="buy"
				size="lg"
				block
				disabled={cart.hasBlockingLine}
				class="mt-4"
			>
				Passer la commande
			</ShopButton>

			<p class="mt-3 text-center text-[12.5px] text-shop-muted">
				Paiement sécurisé · Retrait gratuit à l'atelier de Carantilly
			</p>

			<p
				class="mt-4 border-t border-shop-border-soft pt-4 text-[13px] leading-relaxed text-shop-muted"
			>
				Collectivité ou administration ? Payez sur
				<strong class="text-shop-ink">mandat administratif</strong> (Chorus Pro), sans carte bancaire.
			</p>
		</aside>
	</div>

	<form method="POST" action="?/clear" use:enhance class="mt-4">
		<button
			type="submit"
			class="text-sm font-medium text-shop-muted underline underline-offset-4 hover:text-shop-red"
		>
			Vider le panier
		</button>
	</form>
{/if}
