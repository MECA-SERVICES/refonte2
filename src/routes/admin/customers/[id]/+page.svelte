<script lang="ts">
	import { formatPrice } from '$lib/money';
	import { resolve } from '$app/paths';
	import {
		Badge,
		Button,
		Card,
		Table,
		TableBody,
		TableBodyCell,
		TableBodyRow,
		TableHead,
		TableHeadCell
	} from 'flowbite-svelte';
	import { EditOutline, SearchOutline, TrashBinOutline } from 'flowbite-svelte-icons';
	import {
		AutosaveNote,
		PageHeader,
		ConfirmDialog,
		CUSTOMER_TYPE_BADGES,
		CUSTOMER_STATUS_BADGES,
		SupportThreadsCard
	} from '$lib/components/admin';
	import { paymentMethodLabel } from '$lib/payment-methods';
	import type { PageProps } from './$types';

	/**
	 * Fiche client du back-office, sur le modèle de PrestaShop : l'identité et
	 * l'historique d'achat à gauche, ce que l'équipe annote et suit à droite.
	 */

	let { data }: PageProps = $props();

	const c = $derived(data.customer);
	const ov = $derived(data.overview);

	const dateTimeFmt = new Intl.DateTimeFormat('fr-FR', {
		dateStyle: 'short',
		timeStyle: 'medium'
	});
	const shortFmt = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short' });

	const fullName = $derived(`${c.firstName} ${c.lastName}`.trim());

	const typeBadge = $derived(
		CUSTOMER_TYPE_BADGES[c.type ?? ''] ?? { label: c.type, color: 'gray' }
	);
	const statusBadge = $derived(
		CUSTOMER_STATUS_BADGES[c.status ?? ''] ?? { label: c.status, color: 'gray' }
	);

	/** Un dossier professionnel en attente appelle une décision (CDC 08, R2). */
	const awaitingReview = $derived(c.status === 'pending');

	/** Navigateur lisible à partir de l'user-agent, sans bibliothèque. */
	function browserOf(ua: string | null) {
		if (!ua) return '—';
		const os = /Windows/.test(ua)
			? 'Windows'
			: /iPhone|iPad/.test(ua)
				? 'iOS'
				: /Android/.test(ua)
					? 'Android'
					: /Mac OS/.test(ua)
						? 'macOS'
						: /Linux/.test(ua)
							? 'Linux'
							: '';
		const browser = /Edg\//.test(ua)
			? 'Edge'
			: /Firefox\//.test(ua)
				? 'Firefox'
				: /Chrome\//.test(ua)
					? 'Chrome'
					: /Safari\//.test(ua)
						? 'Safari'
						: 'Navigateur';
		return os ? `${browser} · ${os}` : browser;
	}

	let confirmOpen = $state(false);
	let deleteForm = $state<HTMLFormElement | null>(null);
</script>

<svelte:head><title>{fullName} · Clients</title></svelte:head>

<PageHeader
	title="Informations sur le client {fullName}"
	crumbs={[
		{ label: 'Accueil', href: '/admin' },
		{ label: 'Clients', href: '/admin/customers' },
		{ label: fullName }
	]}
>
	{#snippet actions()}
		<Button color="alternative" href={resolve('/admin/customers/[id]/edit', { id: String(c.id) })}>
			<EditOutline class="me-2 h-4 w-4" /> Éditer
		</Button>
		<Button color="red" onclick={() => (confirmOpen = true)}>
			<TrashBinOutline class="me-2 h-4 w-4" /> Supprimer
		</Button>
	{/snippet}
</PageHeader>

{#snippet count(n: number, tone: 'cyan' | 'green' | 'red' = 'cyan')}
	<span
		class="ms-1.5 inline-flex min-w-5 justify-center rounded px-1.5 text-xs font-semibold text-white {tone ===
		'green'
			? 'bg-green-600'
			: tone === 'red'
				? 'bg-red-600'
				: 'bg-cyan-600'}"
	>
		{n}
	</span>
{/snippet}

{#snippet cardTitle(label: string, n?: number)}
	<h2 class="flex items-center text-base font-semibold text-gray-900 dark:text-white">
		{label}
		{#if n !== undefined}{@render count(n)}{/if}
	</h2>
{/snippet}

<div class="grid gap-6 xl:grid-cols-2">
	<!-- ================= Colonne gauche ================= -->
	<div class="space-y-6">
		<!-- Identité -->
		<Card class="max-w-none p-0">
			<div
				class="flex items-center justify-between gap-3 border-b border-gray-200 px-6 py-4 dark:border-gray-700"
			>
				<p class="text-sm text-gray-900 dark:text-white">
					<span class="font-semibold">{fullName}</span>
					<span class="text-gray-500">[{String(c.id).padStart(6, '0')}]</span>
					—
					<a href="mailto:{c.email}" class="text-primary-700 hover:underline dark:text-primary-400"
						>{c.email}</a
					>
				</p>
				<a
					href={resolve('/admin/customers/[id]/edit', { id: String(c.id) })}
					class="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
					aria-label="Éditer le client"
				>
					<EditOutline class="h-5 w-5" />
				</a>
			</div>

			<dl class="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 px-6 py-5 text-sm">
				<dt class="text-right text-gray-500">Type de compte</dt>
				<dd><Badge color={typeBadge.color}>{typeBadge.label}</Badge></dd>

				{#if c.companyName}
					<dt class="text-right text-gray-500">Société</dt>
					<dd class="text-gray-900 dark:text-white">
						{c.companyName}{#if c.siret}<span class="text-gray-500"> · SIRET {c.siret}</span>{/if}
					</dd>
				{/if}

				{#if c.phone}
					<dt class="text-right text-gray-500">Téléphone</dt>
					<dd>
						<a href="tel:{c.phone}" class="text-gray-900 hover:underline dark:text-white">
							{c.phone}
						</a>
					</dd>
				{/if}

				<dt class="text-right text-gray-500">Date d'inscription</dt>
				<dd class="text-gray-900 tabular-nums dark:text-white">
					{dateTimeFmt.format(new Date(c.createdAt))}
				</dd>

				<dt class="text-right text-gray-500">Dernière visite</dt>
				<dd class="text-gray-900 tabular-nums dark:text-white">
					{ov.lastVisitAt ? dateTimeFmt.format(new Date(ov.lastVisitAt)) : 'Jamais connecté'}
				</dd>

				<dt class="text-right text-gray-500">Place parmi les meilleurs clients</dt>
				<dd class="text-gray-900 tabular-nums dark:text-white">{ov.rank ?? '—'}</dd>

				<dt class="text-right text-gray-500">Inscriptions</dt>
				<dd>
					<Badge color={c.newsletterSubscribed ? 'green' : 'red'}>
						{c.newsletterSubscribed ? '✓' : '✕'} Lettre d'informations
					</Badge>
				</dd>

				<dt class="text-right text-gray-500">Dernière mise à jour</dt>
				<dd class="text-gray-900 tabular-nums dark:text-white">
					{dateTimeFmt.format(new Date(c.updatedAt))}
				</dd>

				<dt class="text-right text-gray-500">État</dt>
				<dd><Badge color={statusBadge.color}>{statusBadge.label}</Badge></dd>

				{#if c.legacyPsId}
					<dt class="text-right text-gray-500">Réf. PrestaShop</dt>
					<dd class="text-gray-900 tabular-nums dark:text-white">{c.legacyPsId}</dd>
				{/if}
			</dl>

			{#if awaitingReview}
				<!-- Le dossier attend une décision : le signaler ici évite qu'il se perde
				     au milieu des informations de contact (R2, R9). -->
				<div
					class="mx-6 mb-5 flex flex-wrap items-center justify-between gap-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
				>
					<p>
						<span class="font-semibold">Dossier en attente de validation.</span>
						Tant qu'il n'est pas traité, ce client voit les prix TTC et n'accède pas aux conditions professionnelles.
					</p>
					{#if data.pendingRequest}
						<Button
							size="xs"
							color="primary"
							href="/admin/customers/validations/{data.pendingRequest.id}"
						>
							Examiner le dossier
						</Button>
					{/if}
				</div>
			{/if}

			{#if c.rejectionReason}
				<!-- R9 : le motif du refus, tel qu'il a été communiqué au client. -->
				<p
					class="mx-6 mb-5 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-700 dark:bg-red-950 dark:text-red-200"
				>
					<span class="font-semibold">Dossier refusé —</span>
					{c.rejectionReason}
				</p>
			{/if}
		</Card>

		<!-- Commandes -->
		<Card class="max-w-none p-6">
			{@render cardTitle('Commandes', ov.orders.length)}

			<div
				class="mt-4 flex flex-wrap gap-x-10 gap-y-2 rounded-lg border border-gray-200 px-4 py-3 text-sm dark:border-gray-700"
			>
				<p class="text-gray-700 dark:text-gray-300">
					Commandes valides : {@render count(ov.orderStats.validCount, 'green')}
					pour un montant total de
					<span class="font-semibold">{formatPrice(ov.orderStats.validTotal)}</span>
				</p>
				<p class="text-gray-700 dark:text-gray-300">
					Commandes non valides : {@render count(ov.orderStats.invalidCount, 'red')}
				</p>
			</div>

			{#if ov.orders.length === 0}
				<p class="py-6 text-center text-sm text-gray-500">{fullName} n'a passé aucune commande.</p>
			{:else}
				<!--
					Tableau resserré : cellules réduites et état en pastille, pour que
					les six colonnes tiennent dans la demi-largeur sans défilement
					horizontal.
				-->
				<div class="mt-4 max-h-96 overflow-y-auto">
					<table class="w-full table-fixed text-xs">
						<thead
							class="sticky top-0 bg-gray-50 text-[11px] text-gray-600 uppercase dark:bg-gray-800 dark:text-gray-400"
						>
							<tr>
								<th class="w-[17%] px-2 py-2 text-left font-semibold">Date</th>
								<th class="w-[22%] px-2 py-2 text-left font-semibold">Paiement</th>
								<th class="px-2 py-2 text-left font-semibold">État</th>
								<th class="w-[9%] px-2 py-2 text-right font-semibold">Prod.</th>
								<th class="w-[16%] px-2 py-2 text-right font-semibold">Total</th>
								<th class="w-8 px-1 py-2"><span class="sr-only">Actions</span></th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
							{#each ov.orders as o (o.id)}
								<tr class="hover:bg-gray-50 dark:hover:bg-gray-800/60">
									<td class="px-2 py-1.5 text-gray-700 tabular-nums dark:text-gray-300">
										{shortFmt.format(new Date(o.createdAt))}
									</td>
									<td class="truncate px-2 py-1.5 text-gray-700 dark:text-gray-300">
										{paymentMethodLabel(o.paymentProvider)}
									</td>
									<td class="px-2 py-1.5" title={o.stateLabel ?? ''}>
										<span class="flex min-w-0 items-center gap-1.5">
											<span
												class="h-2 w-2 shrink-0 rounded-full"
												style="background-color: {o.stateColor ?? '#6b7280'}"
											></span>
											<span class="truncate text-gray-900 dark:text-white"
												>{o.stateLabel ?? '—'}</span
											>
										</span>
									</td>
									<td class="px-2 py-1.5 text-right text-gray-700 tabular-nums dark:text-gray-300">
										{o.itemCount}
									</td>
									<td
										class="px-2 py-1.5 text-right font-medium whitespace-nowrap text-gray-900 tabular-nums dark:text-white"
									>
										{formatPrice(Number(o.totalTtc))}
									</td>
									<td class="px-1 py-1.5 text-right">
										<a
											href={resolve('/admin/orders/[id]', { id: String(o.id) })}
											class="inline-flex text-gray-500 hover:text-primary-700"
											aria-label="Voir la commande {o.reference}"
											title={o.reference}
										>
											<SearchOutline class="h-4 w-4" />
										</a>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</Card>

		<!-- Paniers -->
		<Card class="max-w-none p-6">
			{@render cardTitle('Paniers', ov.carts.length)}
			{#if ov.carts.length === 0}
				<p class="py-6 text-center text-sm text-gray-500">Aucun panier.</p>
			{:else}
				<div class="mt-4">
					<Table hoverable class="text-sm">
						<TableHead>
							<TableHeadCell>ID</TableHeadCell>
							<TableHeadCell>Dernière activité</TableHeadCell>
							<TableHeadCell class="text-right">Articles</TableHeadCell>
							<TableHeadCell class="text-right">Total HT</TableHeadCell>
							<TableHeadCell><span class="sr-only">Actions</span></TableHeadCell>
						</TableHead>
						<TableBody>
							{#each ov.carts as cart (cart.id)}
								<TableBodyRow>
									<TableBodyCell class="tabular-nums">{cart.id}</TableBodyCell>
									<TableBodyCell class="whitespace-nowrap tabular-nums">
										{dateTimeFmt.format(new Date(cart.lastActivityAt))}
									</TableBodyCell>
									<TableBodyCell class="text-right tabular-nums">{cart.itemCount}</TableBodyCell>
									<TableBodyCell class="text-right whitespace-nowrap tabular-nums">
										{cart.itemCount > 0 ? formatPrice(Number(cart.totalHt)) : '—'}
									</TableBodyCell>
									<TableBodyCell class="text-right">
										<a
											href="/admin/carts/{cart.id}"
											class="inline-flex text-gray-500 hover:text-primary-700"
											aria-label="Voir le panier {cart.id}"
										>
											<SearchOutline class="h-4 w-4" />
										</a>
									</TableBodyCell>
								</TableBodyRow>
							{/each}
						</TableBody>
					</Table>
				</div>
			{/if}
		</Card>

		<!-- Produits achetés -->
		<Card class="max-w-none p-6">
			{@render cardTitle('Produits achetés', ov.products.length)}
			{#if ov.products.length === 0}
				<p class="py-6 text-center text-sm text-gray-500">Aucun produit acheté.</p>
			{:else}
				<div class="mt-4 max-h-96 overflow-y-auto">
					<Table class="text-sm">
						<TableHead>
							<TableHeadCell>Date</TableHeadCell>
							<TableHeadCell>Nom</TableHeadCell>
							<TableHeadCell class="text-right">Quantité</TableHeadCell>
						</TableHead>
						<TableBody>
							{#each ov.products as p, i (`${p.productId}-${p.name}-${i}`)}
								<TableBodyRow>
									<TableBodyCell class="whitespace-nowrap tabular-nums">
										{shortFmt.format(new Date(p.lastBoughtAt))}
									</TableBodyCell>
									<TableBodyCell>
										{#if p.productId}
											<a
												href={resolve('/admin/products/[id]', { id: String(p.productId) })}
												class="text-primary-700 hover:underline dark:text-primary-400"
											>
												{p.name}
											</a>
										{:else}
											{p.name}
										{/if}
										{#if p.reference}<span class="block text-xs text-gray-500">{p.reference}</span
											>{/if}
									</TableBodyCell>
									<TableBodyCell class="text-right tabular-nums">{p.quantity}</TableBodyCell>
								</TableBodyRow>
							{/each}
						</TableBody>
					</Table>
				</div>
			{/if}
		</Card>

		<!-- Adresses -->
		<Card class="max-w-none p-6">
			{@render cardTitle('Adresses', c.addresses.length)}
			{#if c.addresses.length === 0}
				<p class="py-6 text-center text-sm text-gray-500">Aucune adresse enregistrée.</p>
			{:else}
				<div class="mt-4 grid gap-4 sm:grid-cols-2">
					{#each c.addresses as addr (addr.id)}
						<div class="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
							<div class="mb-2 flex flex-wrap items-center gap-2">
								<span class="text-sm font-medium text-gray-900 dark:text-white">
									{addr.label ?? 'Adresse'}
								</span>
								{#if addr.isDefaultShipping}<Badge color="blue">Livraison</Badge>{/if}
								{#if addr.isDefaultBilling}<Badge color="gray">Facturation</Badge>{/if}
							</div>
							<address class="text-sm leading-relaxed text-gray-600 not-italic dark:text-gray-300">
								{addr.firstName}
								{addr.lastName}{#if addr.company}<br />{addr.company}{/if}<br />
								{addr.line1}{#if addr.line2}<br />{addr.line2}{/if}<br />
								{addr.postalCode}
								{addr.city}{#if addr.country && addr.country !== 'FR'}<br />{addr.country}{/if}
							</address>
						</div>
					{/each}
				</div>
			{/if}
		</Card>

		<!-- Parc machines (CDC 32, R2) -->
		<Card class="max-w-none p-6">
			{@render cardTitle('Parc machines', data.machines.length)}
			{#if data.machines.length === 0}
				<p class="py-6 text-center text-sm text-gray-500">Aucune machine déclarée.</p>
			{:else}
				<ul class="mt-4 divide-y divide-gray-100 dark:divide-gray-800">
					{#each data.machines as machine (machine.id)}
						<li class="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
							<div class="min-w-0">
								<p class="flex flex-wrap items-center gap-2">
									<span class="font-medium text-gray-900 dark:text-white">{machine.name}</span>
									{#if machine.status === 'pending_confirmation'}
										<Badge color="yellow">À compléter</Badge>
									{/if}
								</p>
								<p class="mt-0.5 text-xs text-gray-500">
									{machine.equipmentType}{#if machine.brand}
										· {machine.brand}{/if}{#if machine.model}
										{machine.model}{/if}
								</p>
							</div>
							<span class="shrink-0 font-mono text-xs text-gray-500">
								{machine.serialNumber ?? 'n° de série manquant'}
							</span>
						</li>
					{/each}
				</ul>
			{/if}
		</Card>
	</div>

	<!-- ================= Colonne droite ================= -->
	<div class="space-y-6">
		<AutosaveNote
			title="Note privée"
			value={c.privateNote}
			action="?/saveNote"
			hint="Cette note est affichée pour tous les employés, mais pas au client."
		/>

		<SupportThreadsCard
			threads={data.messages.rows}
			total={data.messages.total}
			listHref="/admin/customer-service?queue=all&customer={c.id}"
			newHref="/admin/customer-service/new?customer={c.id}"
		/>

		<!-- Dernières connexions : sessions du compte, la plus récente d'abord. -->
		<Card class="max-w-none p-6">
			{@render cardTitle('Dernières connexions', ov.sessions.length)}
			{#if ov.sessions.length === 0}
				<p class="py-6 text-center text-sm text-gray-500">
					{fullName} ne s'est pas connecté sur le nouveau site.
				</p>
			{:else}
				<div class="mt-4">
					<Table class="text-sm">
						<TableHead>
							<TableHeadCell>Connexion</TableHeadCell>
							<TableHeadCell>Dernière activité</TableHeadCell>
							<TableHeadCell>Navigateur</TableHeadCell>
							<TableHeadCell>Adresse IP</TableHeadCell>
						</TableHead>
						<TableBody>
							{#each ov.sessions as s, i (i)}
								<TableBodyRow>
									<TableBodyCell class="whitespace-nowrap tabular-nums">
										{dateTimeFmt.format(new Date(s.createdAt))}
									</TableBodyCell>
									<TableBodyCell class="whitespace-nowrap tabular-nums">
										{dateTimeFmt.format(new Date(s.updatedAt))}
									</TableBodyCell>
									<TableBodyCell class="whitespace-nowrap" title={s.userAgent ?? ''}>
										{browserOf(s.userAgent)}
									</TableBodyCell>
									<TableBodyCell class="font-mono text-xs">{s.ipAddress ?? '—'}</TableBodyCell>
								</TableBodyRow>
							{/each}
						</TableBody>
					</Table>
				</div>
			{/if}
		</Card>

		<!-- Fiscalité : décide du taux appliqué et du mode d'affichage (CDC 23). -->
		<Card class="max-w-none p-6">
			{@render cardTitle('Fiscalité')}
			<dl class="mt-3 space-y-2.5 text-sm">
				<div class="flex justify-between gap-4">
					<dt class="text-gray-500">Pays de facturation</dt>
					<dd class="font-medium text-gray-900 dark:text-white">{c.billingCountry ?? 'FR'}</dd>
				</div>
				<div class="flex justify-between gap-4">
					<dt class="text-gray-500">N° TVA</dt>
					<dd class="font-medium text-gray-900 dark:text-white">{c.vatNumber ?? '—'}</dd>
				</div>
				<div class="flex justify-between gap-4">
					<dt class="text-gray-500">Régime</dt>
					<dd class="font-medium text-gray-900 dark:text-white">
						{c.taxExemptStatus === 'exempt_eu_b2b' ? 'Autoliquidation' : 'Standard'}
					</dd>
				</div>
				<div class="flex justify-between gap-4">
					<dt class="text-gray-500">Prix affichés</dt>
					<dd class="font-medium text-gray-900 dark:text-white">
						{c.type === 'pro' || c.type === 'professional' || c.type === 'collectivite'
							? 'HT'
							: 'TTC'}
					</dd>
				</div>
				<div class="flex justify-between gap-4">
					<dt class="text-gray-500">Facturation</dt>
					<dd class="font-medium text-gray-900 dark:text-white">
						{c.invoiceFormat === 'proforma' ? 'Proforma' : 'Standard'}
					</dd>
				</div>
			</dl>
		</Card>
	</div>
</div>

<form method="POST" action="?/delete" bind:this={deleteForm} class="hidden"></form>

<ConfirmDialog
	bind:open={confirmOpen}
	title="Supprimer le client"
	message="Cette action est irréversible. Le client et ses adresses seront supprimés."
	confirmLabel="Supprimer"
	onconfirm={() => deleteForm?.requestSubmit()}
/>
