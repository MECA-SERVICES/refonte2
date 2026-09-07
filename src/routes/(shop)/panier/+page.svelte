<script lang="ts">
	import { enhance } from '$app/forms';
	import { ExclamationCircleOutline, TrashBinOutline } from 'flowbite-svelte-icons';
	import Breadcrumb from '$lib/components/shop/Breadcrumb.svelte';
	import ImagePlaceholder from '$lib/components/shop/ImagePlaceholder.svelte';
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
<ol class="mb-7 flex flex-wrap gap-2" aria-label="Étapes de la commande">
	{#each steps as step (step.n)}
		<li>
			<span
				aria-current={step.done ? 'step' : undefined}
				class="block border-[1.5px] border-shop-ink px-4 py-2.5 font-display text-sm font-bold {step.done
					? 'bg-shop-ink text-shop-subtle'
					: 'bg-transparent text-shop-ink opacity-45'}"
			>
				{step.n} · {step.label}
			</span>
		</li>
	{/each}
</ol>

{#if form?.message}
	<p
		class="mb-5 border-[1.5px] border-shop-border bg-white px-4 py-3 text-sm font-medium text-shop-ink"
	>
		{form.message}
	</p>
{/if}

{#if lines.length === 0}
	<!-- Panier vide : on renvoie vers le catalogue (parcours 5.7). -->
	<div class="border-[1.5px] border-shop-border bg-white px-6 py-14 text-center">
		<p class="font-display text-lg font-extrabold text-shop-ink">Votre panier est vide.</p>
		<p class="mt-2 text-sm text-shop-muted">
			Parcourez le catalogue pour trouver la pièce ou le matériel qu'il vous faut.
		</p>
		<a
			href="/recherche"
			class="mt-6 inline-block bg-shop-blue px-6 py-3.5 font-display text-[15px] font-bold text-white hover:bg-shop-blue-dark"
		>
			Découvrir le catalogue
		</a>
	</div>
{:else}
	<div class="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
		<!-- ================= Lignes ================= -->
		<div class="min-w-0 border-[1.5px] border-shop-border bg-white">
			{#each lines as line (line.id)}
				{@const drift = priceDrift(line)}
				<div class="flex flex-wrap items-center gap-4 border-b border-shop-border-soft p-5">
					<a
						href={shopProductPath(line)}
						class="flex h-24 w-24 shrink-0 items-center justify-center border border-shop-border bg-white p-1.5"
					>
						{#if line.imageUrl}
							<img
								src={line.imageUrl}
								alt={line.name}
								loading="lazy"
								class="max-h-full max-w-full object-contain"
							/>
						{:else}
							<ImagePlaceholder label="Produit" class="border-0" />
						{/if}
					</a>

					<div class="min-w-0 flex-1 basis-52">
						{#if line.brandName}
							<p class="text-xs font-bold tracking-[0.1em] text-shop-muted uppercase">
								{line.brandName}
							</p>
						{/if}
						<a
							href={shopProductPath(line)}
							class="mt-0.5 block font-display text-base font-bold text-shop-ink hover:text-shop-blue"
						>
							{line.name}
						</a>
						<p class="mt-0.5 text-[13px] text-shop-muted">
							Réf. {line.reference} · {line.stock > 0 ? `En stock (${line.stock})` : 'Sur commande'}
						</p>

						{#if isBlocking(line)}
							<p class="mt-1.5 inline-flex items-center gap-1.5 text-xs font-bold text-shop-red">
								<ExclamationCircleOutline class="h-4 w-4" />
								Indisponible — à retirer pour commander
							</p>
						{:else if drift > 0}
							<p class="mt-1.5 text-xs text-shop-orange">Le prix a augmenté depuis l'ajout.</p>
						{:else if drift < 0}
							<p class="mt-1.5 text-xs text-green-700">Le prix a baissé depuis l'ajout.</p>
						{/if}
					</div>

					<!-- Quantité : envoi immédiat, sans bouton de confirmation -->
					<form method="POST" action="?/update" use:enhance class="shrink-0">
						<input type="hidden" name="lineId" value={line.id} />
						<div class="flex border-[1.5px] border-shop-border bg-shop-subtle">
							<button
								type="submit"
								name="quantity"
								value={line.quantity - 1}
								aria-label="Diminuer la quantité"
								class="px-3.5 text-[17px] text-shop-ink hover:bg-white"
							>
								−
							</button>
							<span
								class="min-w-8 px-1 py-2.5 text-center font-display font-bold text-shop-ink"
								aria-label="Quantité"
							>
								{line.quantity}
							</span>
							<button
								type="submit"
								name="quantity"
								value={line.quantity + 1}
								disabled={line.quantity >= line.stock}
								aria-label="Augmenter la quantité"
								class="px-3.5 text-[17px] text-shop-ink hover:bg-white disabled:opacity-40"
							>
								+
							</button>
						</div>
					</form>

					<div class="ms-auto shrink-0 text-right whitespace-nowrap">
						<p class="font-display text-lg font-extrabold text-shop-ink">
							{formatPrice(Number(line.priceTtc) * line.quantity)}
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
		</div>

		<!-- ================= Récapitulatif ================= -->
		<aside class="border-[1.5px] border-shop-ink bg-white p-5 lg:sticky lg:top-[12.5rem]">
			<h2
				class="mb-4 font-display text-base font-extrabold tracking-[0.02em] text-shop-ink uppercase"
			>
				Récapitulatif
			</h2>

			<dl class="text-[14.5px] text-shop-ink-soft">
				<div class="flex justify-between gap-3 py-1.5">
					<dt>
						Sous-total ({cart.totals.itemCount} article{cart.totals.itemCount > 1 ? 's' : ''})
					</dt>
					<dd class="font-bold text-shop-ink">{formatPrice(cart.totals.subtotalHt)} HT</dd>
				</div>
				<div class="flex justify-between gap-3 py-1.5">
					<dt>TVA</dt>
					<dd class="font-bold text-shop-ink">{formatPrice(cart.totals.tax)}</dd>
				</div>
				<div class="flex justify-between gap-3 py-1.5">
					<dt>Livraison</dt>
					<dd class="text-shop-muted">Calculée à l'étape suivante</dd>
				</div>
				<div class="flex justify-between gap-3 py-1.5">
					<dt>Préparation</dt>
					<dd class="font-bold text-shop-ink">24 h ouvrées</dd>
				</div>
			</dl>

			<div class="mt-3 flex justify-between gap-3 border-t-[1.5px] border-shop-border pt-3.5">
				<span class="font-display text-[17px] font-extrabold text-shop-ink">Total TTC</span>
				<span class="font-display text-[22px] font-extrabold text-shop-ink">
					{formatPrice(cart.totals.totalTtc)}
				</span>
			</div>

			{#if cart.hasBlockingLine}
				<p class="mt-4 border border-shop-red px-3 py-2 text-xs font-medium text-shop-red">
					Retirez les articles indisponibles pour poursuivre.
				</p>
			{/if}

			<button
				type="button"
				disabled
				class="mt-4 w-full bg-shop-blue px-4 py-3.5 font-display text-[15px] font-bold text-white disabled:cursor-not-allowed disabled:bg-shop-border disabled:text-shop-muted"
			>
				Passer à la livraison
			</button>
			<p class="mt-2 text-center text-xs text-shop-muted">
				Le tunnel de commande sera disponible prochainement.
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
