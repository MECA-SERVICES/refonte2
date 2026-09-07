<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from 'flowbite-svelte';
	import {
		ArrowRightOutline,
		ExclamationCircleOutline,
		TrashBinOutline
	} from 'flowbite-svelte-icons';
	import Breadcrumb from '$lib/components/shop/Breadcrumb.svelte';
	import ImagePlaceholder from '$lib/components/shop/ImagePlaceholder.svelte';
	import QuantityStepper from '$lib/components/shop/QuantityStepper.svelte';
	import { formatPrice, shopProductPath } from '$lib/shop';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const cart = $derived(data.cart);
	const lines = $derived(cart.lines);

	/** Un article inactif ou en rupture empêche de commander (règle R7). */
	const isBlocking = (line: (typeof lines)[number]) => !line.isActive || line.stock <= 0;

	/** Écart entre le prix du jour et celui de l'ajout (règle R11). */
	function priceDrift(line: (typeof lines)[number]) {
		if (!line.priceHtAtAdd) return 0;
		return Number(line.priceHt) - Number(line.priceHtAtAdd);
	}
</script>

<svelte:head>
	<title>Mon panier — MS Shop</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<Breadcrumb items={[{ label: 'Mon panier' }]} />

<h1 class="text-2xl font-extrabold tracking-tight text-shop-ink sm:text-3xl">Mon panier</h1>

{#if form?.message}
	<p class="mt-4 rounded-xl bg-shop-subtle px-4 py-3 text-sm font-medium text-shop-ink">
		{form.message}
	</p>
{/if}

{#if lines.length === 0}
	<!-- Panier vide : on renvoie vers le catalogue (parcours 5.7). -->
	<div class="mt-8 rounded-2xl bg-shop-subtle px-6 py-14 text-center">
		<p class="text-lg font-bold text-shop-ink">Votre panier est vide.</p>
		<p class="mt-2 text-sm text-shop-muted">
			Parcourez le catalogue pour trouver la pièce ou le matériel qu'il vous faut.
		</p>
		<Button size="lg" href="/recherche" class="mt-6">
			Découvrir le catalogue <ArrowRightOutline class="ms-2 h-4 w-4" />
		</Button>
	</div>
{:else}
	<div class="mt-8 grid gap-8 lg:grid-cols-[1fr_340px] lg:items-start">
		<!-- ================= Lignes ================= -->
		<div>
			<div
				class="hidden border-b border-shop-border pb-2 text-xs font-semibold tracking-wide text-shop-muted uppercase sm:flex"
			>
				<span class="flex-1">Article</span>
				<span class="w-28 text-center">Prix unitaire</span>
				<span class="w-32 text-center">Quantité</span>
				<span class="w-28 text-right">Total</span>
			</div>

			<ul class="divide-y divide-shop-border border-b border-shop-border">
				{#each lines as line (line.id)}
					{@const drift = priceDrift(line)}
					<li class="flex gap-4 py-5">
						<a href={shopProductPath(line)} class="w-20 shrink-0 sm:w-24">
							{#if line.imageUrl}
								<img
									src={line.imageUrl}
									alt={line.name}
									loading="lazy"
									class="aspect-square w-full rounded-xl border border-shop-border bg-white object-contain p-1.5"
								/>
							{:else}
								<ImagePlaceholder label="Photo" class="aspect-square" />
							{/if}
						</a>

						<div class="flex min-w-0 flex-1 flex-col">
							{#if line.brandName}
								<p class="text-xs font-medium tracking-wide text-shop-muted uppercase">
									{line.brandName}
								</p>
							{/if}
							<a
								href={shopProductPath(line)}
								class="text-[15px] leading-snug font-bold text-shop-ink hover:text-shop-blue"
							>
								{line.name}
							</a>
							<p class="mt-0.5 text-xs text-shop-muted">Réf. {line.reference}</p>

							{#if isBlocking(line)}
								<p
									class="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-shop-red"
								>
									<ExclamationCircleOutline class="h-4 w-4" />
									Article indisponible — à retirer pour commander
								</p>
							{:else if drift > 0}
								<p class="mt-2 text-xs text-shop-orange">
									Le prix de cet article a augmenté depuis son ajout.
								</p>
							{:else if drift < 0}
								<p class="mt-2 text-xs text-green-600">
									Bonne nouvelle : le prix a baissé depuis son ajout.
								</p>
							{/if}

							<form method="POST" action="?/remove" use:enhance class="mt-3">
								<input type="hidden" name="lineId" value={line.id} />
								<button
									type="submit"
									class="inline-flex items-center gap-1.5 text-xs font-medium text-shop-muted hover:text-shop-red"
								>
									<TrashBinOutline class="h-4 w-4" /> Retirer
								</button>
							</form>
						</div>

						<!-- Prix unitaire : colonne dédiée sur écran large. -->
						<div class="hidden w-28 shrink-0 text-center sm:block">
							<p class="text-sm font-semibold text-shop-ink">{formatPrice(line.priceTtc)}</p>
							<p class="text-xs text-shop-muted">TTC</p>
						</div>

						<div class="hidden w-32 shrink-0 justify-center sm:flex">
							<form method="POST" action="?/update" use:enhance>
								<input type="hidden" name="lineId" value={line.id} />
								<QuantityStepper
									id="qty-{line.id}"
									value={line.quantity}
									min={0}
									max={line.stock}
									submitOnChange
								/>
							</form>
						</div>

						<div class="w-28 shrink-0 text-right">
							<p class="text-base font-bold text-shop-red">
								{formatPrice(Number(line.priceTtc) * line.quantity)}
							</p>
							<p class="text-xs text-shop-muted">TTC</p>
							<!-- Sur mobile, le sélecteur suit le total faute de colonne dédiée. -->
							<form
								method="POST"
								action="?/update"
								use:enhance
								class="mt-2 flex justify-end sm:hidden"
							>
								<input type="hidden" name="lineId" value={line.id} />
								<QuantityStepper
									id="qty-mobile-{line.id}"
									value={line.quantity}
									min={0}
									max={line.stock}
									submitOnChange
								/>
							</form>
						</div>
					</li>
				{/each}
			</ul>

			<form method="POST" action="?/clear" use:enhance class="mt-4">
				<button
					type="submit"
					class="text-sm font-medium text-shop-muted underline underline-offset-4 hover:text-shop-red"
				>
					Vider le panier
				</button>
			</form>
		</div>

		<!-- ================= Récapitulatif ================= -->
		<aside class="rounded-2xl bg-shop-subtle p-6 lg:sticky lg:top-28">
			<h2 class="text-base font-extrabold tracking-wide text-shop-ink uppercase">Récapitulatif</h2>

			<dl class="mt-4 space-y-2 text-sm">
				<div class="flex justify-between">
					<dt class="text-shop-muted">Sous-total HT</dt>
					<dd class="font-semibold text-shop-ink">{formatPrice(cart.totals.subtotalHt)}</dd>
				</div>
				<div class="flex justify-between">
					<dt class="text-shop-muted">TVA</dt>
					<dd class="font-semibold text-shop-ink">{formatPrice(cart.totals.tax)}</dd>
				</div>
				<div class="flex justify-between">
					<dt class="text-shop-muted">Frais de port</dt>
					<dd class="text-shop-muted">Estimés à l'étape suivante</dd>
				</div>
			</dl>

			<div class="mt-4 flex items-baseline justify-between border-t border-shop-border pt-4">
				<span class="font-bold text-shop-ink">Total TTC</span>
				<span class="text-2xl font-extrabold text-shop-red">
					{formatPrice(cart.totals.totalTtc)}
				</span>
			</div>

			{#if cart.hasBlockingLine}
				<p class="mt-4 rounded-xl bg-white px-3 py-2 text-xs font-medium text-shop-red">
					Retirez les articles indisponibles pour poursuivre.
				</p>
			{/if}

			<Button size="lg" disabled class="mt-5 w-full">
				Passer commande <ArrowRightOutline class="ms-2 h-4 w-4" />
			</Button>
			<p class="mt-2 text-center text-xs text-shop-muted">
				Le tunnel de commande sera disponible prochainement.
			</p>

			<a
				href="/recherche"
				class="mt-4 block text-center text-sm font-semibold text-shop-blue hover:underline"
			>
				Continuer mes achats
			</a>
		</aside>
	</div>
{/if}
