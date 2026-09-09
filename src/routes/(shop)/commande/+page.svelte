<script lang="ts">
	import { enhance } from '$app/forms';
	import Breadcrumb from '$lib/components/shop/Breadcrumb.svelte';
	import Panel from '$lib/components/shop/Panel.svelte';
	import Heading from '$lib/components/shop/Heading.svelte';
	import ShopButton from '$lib/components/shop/ShopButton.svelte';
	import SummaryRow from '$lib/components/shop/SummaryRow.svelte';
	import { formatPrice } from '$lib/shop';
	import { priceSuffix } from '$lib/tax';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const suffix = $derived(priceSuffix(data.tax.displayMode));

	/**
	 * Choix explicites du client. `null` signifie « pas encore décidé » : la
	 * valeur retenue retombe alors sur le défaut calculé depuis les données, qui
	 * reste juste même si celles-ci changent (adresse ajoutée, offre retirée).
	 */
	let picked = $state<{ shipping: number | null; billing: number | null; option: string | null }>({
		shipping: null,
		billing: null,
		option: null
	});
	let billingSameAsShipping = $state(true);

	const shippingAddressId = $derived(
		picked.shipping ?? (data.addresses.find((a) => a.isDefaultShipping) ?? data.addresses[0]).id
	);
	const billingAddressId = $derived(
		picked.billing ?? (data.addresses.find((a) => a.isDefaultBilling) ?? data.addresses[0]).id
	);

	/** Offre de livraison choisie — la première proposée est la moins chère (R8). */
	const optionCode = $derived(picked.option ?? data.quote.options[0]?.code ?? '');
	const option = $derived(data.quote.options.find((o) => o.code === optionCode));

	/** Point relais retenu, obligatoire pour les offres qui l'exigent (R11). */
	let relay = $state<{ id: string; name: string; address: string } | null>(null);

	const shippingFee = $derived(option?.priceHt ?? 0);
	const shippingTva = $derived(
		data.tax.regime === 'standard' ? Math.round(shippingFee * 20) / 100 : 0
	);

	const totalHt = $derived(data.cart.totals.subtotalHt + shippingFee);
	const totalTva = $derived(data.cart.totals.tax + shippingTva);

	const relayPoints = $derived(form && 'relayPoints' in form ? form.relayPoints : null);
</script>

<svelte:head>
	<title>Validation de commande — MS Shop</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<Breadcrumb items={[{ label: 'Panier', href: '/panier' }, { label: 'Commande' }]} />

<h1 class="font-display text-2xl font-extrabold tracking-[-0.02em] text-shop-ink sm:text-[32px]">
	Validation de commande
</h1>

{#if form?.message}
	<p
		class="mt-5 border-[1.5px] border-shop-red bg-white px-4 py-3 text-sm font-medium text-shop-red"
	>
		{form.message}
	</p>
{/if}

<form method="POST" action="?/confirm" use:enhance>
	<input type="hidden" name="shippingAddressId" value={shippingAddressId} />
	<input type="hidden" name="billingAddressId" value={billingSameAsShipping ? shippingAddressId : billingAddressId} />
	<input type="hidden" name="optionCode" value={optionCode} />
	{#if relay}
		<input type="hidden" name="relayPointId" value={relay.id} />
		<input type="hidden" name="relayPointName" value={relay.name} />
		<input type="hidden" name="relayPointAddress" value={relay.address} />
	{/if}

	<div class="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
		<div class="space-y-6">
			<!-- ================= Adresses ================= -->
			<Panel class="p-5">
				<Heading size="card">1 · Adresse de livraison</Heading>

				<div class="mt-4 space-y-2.5">
					{#each data.addresses as item (item.id)}
						<label
							class="flex cursor-pointer gap-3 border-[1.5px] p-3.5 transition-colors {shippingAddressId ===
							item.id
								? 'border-shop-ink bg-shop-border-soft'
								: 'border-shop-border bg-white hover:border-shop-ink'}"
						>
							<input
								type="radio"
								name="shippingChoice"
								value={item.id}
								checked={shippingAddressId === item.id}
								onchange={() => (picked = { ...picked, shipping: item.id })}
								class="mt-1 accent-shop-blue"
							/>
							<span class="text-[14.5px] leading-relaxed text-shop-ink">
								{#if item.label}<span class="font-bold">{item.label}</span><br />{/if}
								{item.firstName} {item.lastName}<br />
								{item.line1}, {item.postalCode} {item.city}
							</span>
						</label>
					{/each}
				</div>

				<label class="mt-4 flex items-center gap-2.5 text-sm text-shop-ink">
					<input type="checkbox" bind:checked={billingSameAsShipping} class="accent-shop-blue" />
					Facturer à cette même adresse
				</label>

				{#if !billingSameAsShipping}
					<div class="mt-3 space-y-2.5 border-t-[1.5px] border-shop-border-soft pt-4">
						<p class="font-display text-[13px] font-extrabold tracking-wide text-shop-muted uppercase">
							Adresse de facturation
						</p>
						{#each data.addresses as item (item.id)}
							<label class="flex cursor-pointer gap-3 text-[14px] text-shop-ink">
								<input
									type="radio"
									name="billingChoice"
									value={item.id}
									checked={billingAddressId === item.id}
									onchange={() => (picked = { ...picked, billing: item.id })}
									class="accent-shop-blue"
								/>
								{item.firstName} {item.lastName} — {item.line1}, {item.postalCode} {item.city}
							</label>
						{/each}
					</div>
				{/if}

				<a
					href="/compte/adresses"
					class="mt-4 inline-block text-[13.5px] font-semibold text-shop-blue hover:underline"
				>
					Gérer mes adresses →
				</a>
			</Panel>

			<!-- ================= Livraison ================= -->
			<Panel class="p-5">
				<Heading size="card">2 · Mode de livraison</Heading>

				{#if data.quote.restriction}
					<p class="mt-3 border-[1.5px] border-shop-blue bg-shop-subtle px-3.5 py-2.5 text-[13.5px] text-shop-ink">
						{data.quote.restriction}
					</p>
				{/if}

				{#if data.quote.usedFallback}
					<p class="mt-3 border-[1.5px] border-shop-orange bg-white px-3.5 py-2.5 text-[13.5px] text-shop-ink">
						Le transporteur sera confirmé par notre équipe à la préparation de votre colis.
					</p>
				{/if}

				<p class="mt-3 text-[13px] text-shop-muted">
					Poids estimé du colis : {data.quote.weightKg} kg
				</p>

				<div class="mt-4 space-y-2.5">
					{#each data.quote.options as item (item.code)}
						<label
							class="flex cursor-pointer items-center justify-between gap-3 border-[1.5px] p-3.5 transition-colors {optionCode ===
							item.code
								? 'border-shop-ink bg-shop-border-soft'
								: 'border-shop-border bg-white hover:border-shop-ink'}"
						>
							<span class="flex min-w-0 items-center gap-3">
								<input
									type="radio"
									name="optionChoice"
									value={item.code}
									checked={optionCode === item.code}
									onchange={() => {
										picked = { ...picked, option: item.code };
										relay = null;
									}}
									class="accent-shop-blue"
								/>
								<span class="min-w-0">
									<span class="block text-[14.5px] font-bold text-shop-ink">{item.name}</span>
									<span class="block text-[13px] text-shop-muted">
										{item.carrierName}{#if item.requiresServicePoint} · point relais à choisir{/if}
									</span>
								</span>
							</span>
							<span class="shrink-0 font-display font-bold text-shop-ink">
								{#if item.priceHt === null}
									<span class="text-[13px] text-shop-muted">Tarif à confirmer</span>
								{:else}
									{formatPrice(item.priceHt)} <span class="text-[12px]">HT</span>
								{/if}
							</span>
						</label>
					{/each}
				</div>

				<!-- ================= Point relais ================= -->
				{#if option?.requiresServicePoint}
					<div class="mt-4 border-t-[1.5px] border-shop-border-soft pt-4">
						<p class="font-display text-[13px] font-extrabold tracking-wide text-shop-muted uppercase">
							Point relais
						</p>

						{#if relay}
							<div class="mt-3 border-[1.5px] border-shop-ink bg-shop-border-soft p-3.5">
								<p class="text-[14.5px] font-bold text-shop-ink">{relay.name}</p>
								<p class="text-[13px] text-shop-muted">{relay.address}</p>
								<button
									type="button"
									onclick={() => (relay = null)}
									class="mt-2 text-[13px] font-semibold text-shop-blue hover:underline"
								>
									Choisir un autre point
								</button>
							</div>
						{:else}
							<div class="mt-3 flex flex-wrap items-end gap-2.5">
								<label class="text-sm">
									<span class="mb-1 block text-shop-muted">Code postal</span>
									<input
										form="relay-form"
										name="postalCode"
										value={data.addresses.find((a) => a.id === shippingAddressId)?.postalCode ?? ''}
										class="border-[1.5px] border-shop-border px-3 py-2 text-sm"
									/>
								</label>
								<button
									form="relay-form"
									type="submit"
									class="border-[1.5px] border-shop-ink bg-white px-4 py-2 text-sm font-bold text-shop-ink hover:bg-shop-ink hover:text-white"
								>
									Rechercher
								</button>
							</div>

							{#if relayPoints}
								<div class="mt-3 max-h-72 space-y-2 overflow-y-auto">
									{#each relayPoints as point (point.id)}
										<button
											type="button"
											onclick={() =>
												(relay = {
													id: String(point.id),
													name: point.name,
													address: `${point.street} ${point.houseNumber}, ${point.postalCode} ${point.city}`
												})}
											class="block w-full border-[1.5px] border-shop-border bg-white p-3 text-left hover:border-shop-ink"
										>
											<span class="block text-[14px] font-bold text-shop-ink">{point.name}</span>
											<span class="block text-[12.5px] text-shop-muted">
												{point.street} {point.houseNumber}, {point.postalCode}
												{point.city}{#if point.distance} · {Math.round(point.distance)} m{/if}
											</span>
										</button>
									{/each}
								</div>
							{/if}
						{/if}
					</div>
				{/if}
			</Panel>

			<!-- ================= Paiement ================= -->
			<Panel class="p-5">
				<Heading size="card">3 · Paiement</Heading>
				<div class="mt-3 border-[1.5px] border-shop-ink bg-shop-border-soft p-4">
					<p class="text-[14.5px] font-bold text-shop-ink">Virement bancaire</p>
					<p class="mt-1 text-[13.5px] leading-relaxed text-shop-ink-soft">
						Nos coordonnées bancaires vous seront communiquées après validation. Votre commande
						est préparée dès réception du règlement.
					</p>
				</div>
			</Panel>
		</div>

		<!-- ================= Récapitulatif ================= -->
		<Panel class="p-5 lg:sticky lg:top-6">
			<Heading size="card">Récapitulatif</Heading>

			<ul class="mt-4 space-y-2 border-b-[1.5px] border-shop-border-soft pb-4">
				{#each data.cart.lines as line (line.id)}
					<li class="flex justify-between gap-3 text-[13.5px]">
						<span class="min-w-0 text-shop-ink-soft">
							{line.quantity} × {line.name}
						</span>
						<span class="shrink-0 font-semibold text-shop-ink">
							{formatPrice(Number(line.priceHt) * line.quantity)}
						</span>
					</li>
				{/each}
			</ul>

			<div class="mt-4 space-y-1">
				<SummaryRow label="Sous-total">{formatPrice(data.cart.totals.subtotalHt)} HT</SummaryRow>
				<SummaryRow label="Livraison">
					{#if option?.priceHt === null}
						à confirmer
					{:else}
						{formatPrice(shippingFee)} HT
					{/if}
				</SummaryRow>
				<SummaryRow label="TVA">{formatPrice(totalTva)}</SummaryRow>
			</div>

			<div class="mt-3 flex items-baseline justify-between border-t-[1.5px] border-shop-ink pt-3">
				<span class="font-display text-[17px] font-extrabold text-shop-ink">Total TTC</span>
				<span class="font-display text-xl font-extrabold text-shop-ink">
					{formatPrice(totalHt + totalTva)}
				</span>
			</div>

			<p class="mt-2 text-[12.5px] text-shop-muted">Montants affichés en {suffix} sur le catalogue.</p>

			<div class="mt-5">
				<ShopButton
					type="submit"
					variant="buy"
					size="lg"
					block
					disabled={!optionCode || (option?.requiresServicePoint && !relay)}
				>
					Valider ma commande
				</ShopButton>
			</div>

			<a
				href="/panier"
				class="mt-3 block text-center text-[13.5px] font-semibold text-shop-blue hover:underline"
			>
				Retour au panier
			</a>
		</Panel>
	</div>
</form>

<!-- Recherche de points relais : formulaire distinct, pour ne pas valider la commande. -->
<form method="POST" action="?/relayPoints" id="relay-form" use:enhance>
	<input type="hidden" name="carrierCode" value={option?.carrierCode ?? ''} />
</form>
