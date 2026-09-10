<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { Badge, Button, Card, Select, Input, Label, Textarea } from 'flowbite-svelte';
	import { PageHeader, StateBadge, Thumbnail } from '$lib/components/admin';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const o = $derived(data.order);
	const eur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
	const dateFmt = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
	const dayFmt = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' });

	const stateOptions = $derived(data.states.map((s) => ({ value: String(s.id), name: s.label })));

	/** Adresse figée à l'achat : le carnet du client a pu changer depuis. */
	type Addr = {
		firstName?: string;
		lastName?: string;
		company?: string | null;
		line1?: string;
		line2?: string | null;
		city?: string;
		postalCode?: string;
		country?: string;
		phone?: string | null;
	} | null;
	const asAddr = (a: unknown) => (a ?? null) as Addr;

	const shipping = $derived(asAddr(o.shippingAddress));
	const billing = $derived(asAddr(o.billingAddress));

	/**
	 * Marge d'une ligne, si le prix d'achat est connu.
	 *
	 * Le prix d'achat vient du catalogue courant : il n'est pas figé sur la ligne,
	 * la valeur est donc indicative et présentée comme telle.
	 */
	function lineMargin(l: (typeof o.lines)[number]) {
		if (l.purchasePrice === null || l.purchasePrice === undefined) return null;
		const cost = Number(l.purchasePrice) * l.quantity;
		if (!Number.isFinite(cost) || cost <= 0) return null;

		const revenue = Number(l.totalHt);
		if (revenue <= 0) return null;

		const amount = revenue - cost;
		return { amount, percent: (amount / revenue) * 100 };
	}

	/** Une commande expédiée ne se remballe pas : l'écran s'adapte à cet état. */
	const isShipped = $derived(Boolean(o.trackingNumber));
</script>

<svelte:head><title>{o.reference} · Commandes</title></svelte:head>

<PageHeader
	title="Commande {o.reference}"
	crumbs={[
		{ label: 'Accueil', href: '/admin' },
		{ label: 'Commandes', href: '/admin/orders' },
		{ label: o.reference }
	]}
>
	{#snippet actions()}
		{#if o.state}<StateBadge label={o.state.label} color={o.state.color} />{/if}
	{/snippet}
</PageHeader>

<!-- ================= Synthèse ================= -->
<!--
	Quatre repères que l'opérateur cherche en premier lorsqu'il ouvre une
	commande : quand, combien, pour qui, et où elle en est logistiquement.
-->
<div class="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
	<Card class="max-w-none p-4">
		<p class="text-xs font-medium tracking-wide text-gray-500 uppercase dark:text-gray-400">
			Passée le
		</p>
		<p class="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
			{dayFmt.format(new Date(o.createdAt))}
		</p>
	</Card>

	<Card class="max-w-none p-4">
		<p class="text-xs font-medium tracking-wide text-gray-500 uppercase dark:text-gray-400">
			Total TTC
		</p>
		<p class="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
			{eur.format(Number(o.totalTtc))}
		</p>
	</Card>

	<Card class="max-w-none p-4">
		<p class="text-xs font-medium tracking-wide text-gray-500 uppercase dark:text-gray-400">
			Client
		</p>
		{#if o.customer}
			<a
				href={resolve('/admin/customers/[id]', { id: String(o.customer.id) })}
				class="mt-1 block truncate text-lg font-semibold text-primary-700 hover:underline dark:text-primary-400"
			>
				{o.customer.firstName}
				{o.customer.lastName}
			</a>
		{:else}
			<p class="mt-1 text-lg font-semibold text-gray-400">Compte supprimé</p>
		{/if}
	</Card>

	<Card class="max-w-none p-4">
		<p class="text-xs font-medium tracking-wide text-gray-500 uppercase dark:text-gray-400">
			Expédition
		</p>
		<p
			class="mt-1 truncate text-lg font-semibold {isShipped
				? 'text-green-600 dark:text-green-400'
				: 'text-gray-900 dark:text-white'}"
		>
			{isShipped ? o.trackingNumber : (o.carrierName ?? 'À préparer')}
		</p>
	</Card>
</div>

<div class="grid gap-6 lg:grid-cols-3">
	<!-- ================= Colonne principale ================= -->
	<div class="space-y-6 lg:col-span-2">
		<!-- Articles -->
		<Card class="max-w-none p-6">
			<h2 class="mb-4 text-base font-semibold text-gray-900 dark:text-white">
				Articles <span class="font-normal text-gray-400">({o.lines.length})</span>
			</h2>

			<ul class="divide-y divide-gray-100 dark:divide-gray-800">
				{#each o.lines as l (l.id)}
					{@const margin = lineMargin(l)}
					<li class="flex items-start gap-4 py-4 first:pt-0 last:pb-0">
						<Thumbnail src={l.productImageUrl ?? l.catalogImageUrl} alt={l.productName} />

						<div class="min-w-0 flex-1">
							{#if l.productId}
								<a
									href={resolve('/admin/products/[id]', { id: String(l.productId) })}
									class="font-medium text-primary-700 hover:underline dark:text-primary-400"
								>
									{l.productName}
								</a>
							{:else}
								<span class="font-medium text-gray-900 dark:text-white">{l.productName}</span>
								<!-- Produit supprimé depuis l'achat : la ligne garde sa copie figée. -->
								<Badge color="gray" class="ms-2">Hors catalogue</Badge>
							{/if}

							<p class="mt-0.5 text-xs text-gray-500">
								{#if l.productReference}Réf. {l.productReference}{:else}Sans référence{/if}
								{#if l.currentStock !== null && l.currentStock !== undefined}
									· Stock actuel :
									<span
										class={l.currentStock <= 0 ? 'font-medium text-red-600 dark:text-red-400' : ''}
									>
										{l.currentStock}
									</span>
								{/if}
							</p>

							<p class="mt-1.5 text-sm text-gray-600 dark:text-gray-300">
								{l.quantity} × {eur.format(Number(l.unitPriceHt))} HT
								<span class="text-gray-400">({eur.format(Number(l.unitPriceTtc))} TTC)</span>
							</p>

							{#if margin}
								<p class="mt-1 text-xs text-gray-500">
									Marge indicative :
									<span
										class={margin.amount >= 0
											? 'font-medium text-green-600 dark:text-green-400'
											: 'font-medium text-red-600 dark:text-red-400'}
									>
										{eur.format(margin.amount)} ({margin.percent.toFixed(1)} %)
									</span>
								</p>
							{/if}
						</div>

						<div class="shrink-0 text-right">
							<p class="font-semibold text-gray-900 tabular-nums dark:text-white">
								{eur.format(Number(l.totalTtc))}
							</p>
							<p class="mt-0.5 text-xs text-gray-500 tabular-nums">
								{eur.format(Number(l.totalHt))} HT
							</p>
						</div>
					</li>
				{/each}
			</ul>

			<!-- Totaux : rattachés aux articles, pas isolés dans une carte à part. -->
			<dl class="mt-4 space-y-1.5 border-t border-gray-200 pt-4 text-sm dark:border-gray-700">
				<div class="flex justify-between">
					<dt class="text-gray-500">Sous-total HT</dt>
					<dd class="text-gray-900 tabular-nums dark:text-white">
						{eur.format(Number(o.totalHt) - Number(o.shippingFee))}
					</dd>
				</div>
				<div class="flex justify-between">
					<dt class="text-gray-500">Livraison HT</dt>
					<dd class="text-gray-900 tabular-nums dark:text-white">
						{eur.format(Number(o.shippingFee))}
					</dd>
				</div>
				{#if Number(o.additionalShippingFee) > 0}
					<div class="flex justify-between">
						<dt class="text-gray-500">
							Supplément transport
							{#if o.additionalFeeReason}<span class="text-xs">— {o.additionalFeeReason}</span>{/if}
						</dt>
						<dd class="text-gray-900 tabular-nums dark:text-white">
							{eur.format(Number(o.additionalShippingFee))}
						</dd>
					</div>
				{/if}
				{#if Number(o.discountAmount) > 0}
					<div class="flex justify-between text-green-600 dark:text-green-400">
						<dt>Remise</dt>
						<dd class="tabular-nums">−{eur.format(Number(o.discountAmount))}</dd>
					</div>
				{/if}
				<div class="flex justify-between">
					<dt class="text-gray-500">TVA</dt>
					<dd class="text-gray-900 tabular-nums dark:text-white">
						{eur.format(Number(o.totalTva))}
					</dd>
				</div>
				<div
					class="flex justify-between border-t border-gray-200 pt-2 text-base font-semibold dark:border-gray-700"
				>
					<dt class="text-gray-900 dark:text-white">Total TTC</dt>
					<dd class="text-gray-900 tabular-nums dark:text-white">
						{eur.format(Number(o.totalTtc))}
					</dd>
				</div>
			</dl>
		</Card>

		<!-- Expédition -->
		<Card class="max-w-none p-6">
			<h2 class="mb-4 text-base font-semibold text-gray-900 dark:text-white">Expédition</h2>

			{#if form?.message}
				<p
					class="mb-4 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
				>
					{form.message}
				</p>
			{/if}

			{#if isShipped}
				<dl class="space-y-2 text-sm">
					<div class="flex justify-between gap-4">
						<dt class="text-gray-500">Transporteur</dt>
						<dd class="font-medium text-gray-900 dark:text-white">{o.carrierName ?? '—'}</dd>
					</div>
					<div class="flex justify-between gap-4">
						<dt class="text-gray-500">Numéro de suivi</dt>
						<dd class="font-mono font-medium text-gray-900 dark:text-white">{o.trackingNumber}</dd>
					</div>
					{#if o.packageWeightKg}
						<div class="flex justify-between gap-4">
							<dt class="text-gray-500">Poids du colis</dt>
							<dd class="text-gray-900 dark:text-white">{Number(o.packageWeightKg)} kg</dd>
						</div>
					{/if}
				</dl>

				<div class="mt-4 flex flex-wrap gap-2">
					{#if o.trackingUrl}
						<Button
							href={o.trackingUrl}
							target="_blank"
							rel="noopener"
							color="alternative"
							size="sm"
						>
							Suivre le colis
						</Button>
					{/if}
					<form method="POST" action="?/label" use:enhance>
						<Button type="submit" color="alternative" size="sm">Étiquette PDF</Button>
					</form>
				</div>

				{#if form && 'labelBase64' in form && form.labelBase64}
					<a
						href={`data:application/pdf;base64,${form.labelBase64}`}
						download={`etiquette-${o.reference}.pdf`}
						class="mt-3 inline-block text-sm font-medium text-primary-700 hover:underline dark:text-primary-400"
					>
						Télécharger etiquette-{o.reference}.pdf
					</a>
				{/if}
			{:else if !data.sendcloudReady}
				<p class="text-sm text-gray-500">
					Sendcloud n'est pas configuré : renseignez les clés d'API pour créer des colis.
				</p>
			{:else}
				{#if o.usedFallbackShipping}
					<p
						class="mb-4 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
					>
						Commande passée avec la grille de repli : choisissez le transporteur réel ci-dessous.
					</p>
				{/if}

				{#if o.relayPointName}
					<p class="mb-4 text-sm text-gray-600 dark:text-gray-400">
						Point relais choisi : <span class="font-medium text-gray-900 dark:text-white">
							{o.relayPointName}
						</span>
						{#if o.relayPointAddress}<br />{o.relayPointAddress}{/if}
					</p>
				{/if}

				{#if !data.realLabelsAllowed}
					<p
						class="mb-4 rounded border border-blue-300 bg-blue-50 px-3 py-2 text-sm text-blue-900 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200"
					>
						<span class="font-semibold">Mode test.</span>
						Les colis sont créés avec l'offre
						<code class="rounded bg-white/60 px-1 dark:bg-black/30">{data.testOptionCode}</code> : aucun
						transporteur n'est sollicité et rien n'est facturé. Aucun envoi réel n'est possible tant que
						ce mode est actif.
					</p>
				{/if}

				<form method="POST" action="?/ship" use:enhance class="space-y-4">
					<div class="grid gap-3 sm:grid-cols-4">
						<div>
							<Label for="weightKg" class="mb-1.5">Poids (kg)</Label>
							<Input
								id="weightKg"
								name="weightKg"
								type="number"
								step="0.001"
								min="0.001"
								value={o.packageWeightKg ?? ''}
								required
							/>
						</div>
						<div>
							<Label for="lengthCm" class="mb-1.5">Long. (cm)</Label>
							<Input id="lengthCm" name="lengthCm" type="number" step="0.01" min="0" />
						</div>
						<div>
							<Label for="widthCm" class="mb-1.5">Larg. (cm)</Label>
							<Input id="widthCm" name="widthCm" type="number" step="0.01" min="0" />
						</div>
						<div>
							<Label for="heightCm" class="mb-1.5">Haut. (cm)</Label>
							<Input id="heightCm" name="heightCm" type="number" step="0.01" min="0" />
						</div>
					</div>

					{#if data.realLabelsAllowed}
						<div>
							<Label for="optionCode" class="mb-1.5">Offre d'expédition</Label>
							<Input
								id="optionCode"
								name="optionCode"
								placeholder={o.shippingOptionCode ?? data.testOptionCode}
							/>
							<p class="mt-1 text-xs text-gray-500">
								Vide = offre choisie par le client{#if o.shippingOptionCode}
									({o.shippingOptionCode}){/if}.
							</p>
						</div>
					{:else}
						<p class="text-xs text-gray-500">
							Offre choisie par le client : <span class="font-medium">
								{o.shippingOptionCode ?? 'aucune'}
							</span> — ignorée en mode test.
						</p>
					{/if}

					<Button type="submit" color="primary">
						{data.realLabelsAllowed ? 'Créer le colis' : 'Créer un colis de test'}
					</Button>
				</form>
			{/if}
		</Card>

		<!-- Historique -->
		<Card class="max-w-none p-6">
			<h2 class="mb-4 text-base font-semibold text-gray-900 dark:text-white">Historique</h2>

			{#if o.history.length > 0}
				<!-- Chronologie verticale : l'ordre des changements se lit d'un coup
				     d'œil, ce qu'une suite de lignes séparées ne montrait pas. -->
				<ol class="relative space-y-4 border-l border-gray-200 pl-5 dark:border-gray-700">
					{#each o.history as h (h.id)}
						<li class="relative">
							<span
								class="absolute top-1.5 -left-[1.4rem] h-2.5 w-2.5 rounded-full ring-4 ring-white dark:ring-gray-800"
								style="background-color: {h.stateColor ?? '#6b7280'}"
							></span>
							<div class="flex flex-wrap items-center justify-between gap-2">
								<div class="flex items-center gap-2">
									{#if h.stateLabel}
										<StateBadge label={h.stateLabel} color={h.stateColor ?? '#6b7280'} />
									{/if}
									{#if h.note}<span class="text-sm text-gray-500">{h.note}</span>{/if}
								</div>
								<time class="text-xs text-gray-400">
									{dateFmt.format(new Date(h.createdAt))}
								</time>
							</div>
						</li>
					{/each}
				</ol>
			{:else}
				<p class="text-sm text-gray-500">Aucun changement d'état enregistré.</p>
			{/if}
		</Card>
	</div>

	<!-- ================= Colonne latérale ================= -->
	<div class="space-y-6">
		<!-- Changement d'état : action principale, donc placée en tête. -->
		<Card class="max-w-none p-6">
			<h2 class="mb-4 text-base font-semibold text-gray-900 dark:text-white">Changer l'état</h2>

			<form method="POST" action="?/changeState" use:enhance class="space-y-3">
				<Select name="stateId" items={stateOptions} value={String(o.stateId)} />
				<Textarea name="note" rows={2} placeholder="Note interne (facultative)" />
				<Button type="submit" color="primary" class="w-full">Appliquer</Button>
			</form>
		</Card>

		<!-- Adresses -->
		{#snippet addressCard(title: string, a: Addr)}
			<Card class="max-w-none p-6">
				<h2 class="mb-3 text-base font-semibold text-gray-900 dark:text-white">{title}</h2>
				{#if a}
					<address class="text-sm leading-relaxed text-gray-700 not-italic dark:text-gray-300">
						{a.firstName}
						{a.lastName}{#if a.company}<br />{a.company}{/if}<br />
						{a.line1}{#if a.line2}<br />{a.line2}{/if}<br />
						{a.postalCode}
						{a.city}{#if a.country && a.country !== 'FR'}<br />{a.country}{/if}
						{#if a.phone}<br />{a.phone}{/if}
					</address>
				{:else}
					<p class="text-sm text-gray-500">Non renseignée.</p>
				{/if}
			</Card>
		{/snippet}

		{@render addressCard('Adresse de livraison', shipping)}
		{@render addressCard('Adresse de facturation', billing)}

		<!-- Paiement -->
		<Card class="max-w-none p-6">
			<h2 class="mb-3 text-base font-semibold text-gray-900 dark:text-white">Paiement</h2>
			<dl class="space-y-2 text-sm">
				<div class="flex justify-between gap-4">
					<dt class="text-gray-500">Moyen</dt>
					<dd class="font-medium text-gray-900 dark:text-white">
						{o.paymentProvider === 'bank_transfer' ? 'Virement' : (o.paymentProvider ?? '—')}
					</dd>
				</div>
				<div class="flex justify-between gap-4">
					<dt class="text-gray-500">Réglé le</dt>
					<dd class="text-gray-900 dark:text-white">
						{o.paidAt ? dateFmt.format(new Date(o.paidAt)) : 'En attente'}
					</dd>
				</div>
			</dl>
		</Card>
	</div>
</div>
