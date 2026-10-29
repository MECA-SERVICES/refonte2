<script lang="ts">
	import { enhance } from '$lib/components/admin/feedback.svelte';
	import { goto } from '$app/navigation';
	import { Button, Card, Input, Label, Select, Textarea } from 'flowbite-svelte';
	import { FilePdfOutline, TrashBinOutline } from 'flowbite-svelte-icons';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { formatPrice, round2 } from '$lib/money';
	import { COUNTER_STATUS } from '$lib/counter-invoices';
	import { SETTLEMENT_METHOD_LABELS, settlementMethods } from '$lib/settlements';
	import {
		ConfirmDialog,
		DocumentLineStock,
		PageHeader,
		StateBadge,
		listFilterHref
	} from '$lib/components/admin';
	import type { PageProps } from './$types';

	/**
	 * Une facture comptoir ou un avoir. Brouillon : on ajoute produits,
	 * prestations de main-d'œuvre et lignes libres, on ajuste quantités, prix
	 * TTC et remises, puis on valide. Validée : elle est figée ; on enregistre
	 * les règlements, on sort les pièces du stock, on la corrige par un avoir.
	 */

	let { data }: PageProps = $props();

	const inv = $derived(data.invoice);
	const isDraft = $derived(inv.status === 'draft');
	const isCredit = $derived(inv.kind === 'credit_note');
	const status = $derived(COUNTER_STATUS[inv.status]);
	const title = $derived(
		`${isCredit ? 'Avoir' : 'Facture'} ${inv.number ?? `brouillon n° ${inv.id}`}`
	);
	const client = $derived(data.customer);
	const today = new Date().toISOString().slice(0, 10);
	const TAX_RATES = [20, 10, 5.5, 0].map((r) => ({ value: String(r), name: `${r} %` }));

	/** Prix unitaire TTC d'une ligne, celui qu'on saisit au comptoir. */
	const unitTtc = (l: { unitPriceHt: string; taxRate: string }) =>
		round2(Number(l.unitPriceHt) * (1 + Number(l.taxRate) / 100));

	let searchTimer: ReturnType<typeof setTimeout> | undefined;
	function search(value: string) {
		clearTimeout(searchTimer);
		searchTimer = setTimeout(() => {
			goto(listFilterHref(`/admin/invoices/${inv.id}`, [['q', value.trim()]]), {
				keepFocus: true,
				noScroll: true,
				replaceState: true
			});
		}, 300);
	}

	const keepValues: SubmitFunction =
		() =>
		({ update }) =>
			update({ reset: false });
	const clearSearch: SubmitFunction =
		() =>
		async ({ result, update }) => {
			await update();
			if (result.type === 'success') {
				await goto(`/admin/invoices/${inv.id}`, {
					keepFocus: true,
					noScroll: true,
					replaceState: true
				});
			}
		};

	let method = $state<string>('cheque');
	let confirm = $state<null | 'validate' | 'delete' | 'credit'>(null);
	let forms = $state<Record<string, HTMLFormElement | null>>({
		validate: null,
		delete: null,
		credit: null
	});
</script>

<svelte:head><title>{title} · Administration</title></svelte:head>

<PageHeader
	{title}
	subtitle={isDraft
		? 'Brouillon : tout se modifie. La validation attribue le numéro et fige la facture.'
		: `Du ${new Intl.DateTimeFormat('fr-FR').format(new Date(inv.issuedOn ?? inv.createdAt))}${inv.legacyDoliId ? ' · reprise de Dolibarr' : ''}`}
	crumbs={[
		{ label: 'Accueil', href: '/admin' },
		{ label: 'Factures comptoir', href: '/admin/invoices' },
		{ label: inv.number ?? `Brouillon n° ${inv.id}` }
	]}
>
	{#snippet actions()}
		<StateBadge color={status.color} label={status.label} />
		<Button color="alternative" href="/admin/invoices/{inv.id}/pdf" target="_blank">
			<FilePdfOutline class="me-2 h-4 w-4" /> PDF
		</Button>
		{#if isDraft}
			<Button color="alternative" onclick={() => (confirm = 'delete')}>Supprimer</Button>
			<Button color="green" disabled={!data.lines.length} onclick={() => (confirm = 'validate')}>
				Valider {isCredit ? "l'avoir" : 'la facture'}
			</Button>
		{:else if !isCredit && inv.status !== 'abandoned'}
			<Button color="alternative" onclick={() => (confirm = 'credit')}>Créer un avoir</Button>
		{/if}
	{/snippet}
</PageHeader>

<form
	bind:this={forms.validate}
	method="POST"
	action="?/validate"
	use:enhance
	data-success="Validée : le numéro est attribué."
	class="hidden"
></form>
<form
	bind:this={forms.delete}
	method="POST"
	action="?/deleteDraft"
	use:enhance
	data-success="Brouillon supprimé."
	class="hidden"
></form>
<form
	bind:this={forms.credit}
	method="POST"
	action="?/creditNote"
	use:enhance
	data-success="Avoir créé en brouillon."
	class="hidden"
></form>
<ConfirmDialog
	open={confirm !== null}
	title={confirm === 'validate'
		? 'Valider'
		: confirm === 'delete'
			? 'Supprimer le brouillon'
			: 'Créer un avoir'}
	message={confirm === 'validate'
		? `La ${isCredit ? 'pièce' : 'facture'} reçoit son numéro définitif et ne pourra plus être modifiée (total ${formatPrice(inv.totalTtc)}).`
		: confirm === 'delete'
			? 'Le brouillon et ses lignes seront supprimés.'
			: 'Un avoir en brouillon reprend toutes les lignes en négatif : retirez ou ajustez celles qui ne sont pas à rembourser, puis validez-le.'}
	confirmLabel={confirm === 'validate'
		? 'Valider'
		: confirm === 'delete'
			? 'Supprimer'
			: "Créer l'avoir"}
	onconfirm={() => {
		const form = confirm ? forms[confirm] : null;
		confirm = null;
		form?.requestSubmit();
	}}
/>

<div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
	<div class="min-w-0 space-y-6">
		<!-- ================= Lignes ================= -->
		<Card class="max-w-none p-5">
			<h2 class="mb-4 text-lg font-semibold text-gray-900">Lignes</h2>
			{#if data.lines.length === 0}
				<p class="py-6 text-center text-sm text-gray-500">
					Aucune ligne : ajoutez un produit, une prestation ou une ligne libre ci-dessous.
				</p>
			{:else}
				<div class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead class="border-b border-gray-200 text-xs text-gray-600 uppercase">
							<tr>
								<th scope="col" class="py-2 pe-3 text-start">Désignation</th>
								<th scope="col" class="px-2 py-2 text-end">Qté</th>
								<th scope="col" class="px-2 py-2 text-end">P.U. TTC</th>
								<th scope="col" class="px-2 py-2 text-end">Remise</th>
								<th scope="col" class="px-2 py-2 text-end">TVA</th>
								<th scope="col" class="px-2 py-2 text-end">Total TTC</th>
								{#if isDraft}<th scope="col" class="py-2 ps-2"
										><span class="sr-only">Actions</span></th
									>{/if}
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-100">
							{#each data.lines as line (line.id)}
								{#if isDraft}
									<tr class="align-top">
										<td class="py-2 pe-3" colspan="7">
											<form
												method="POST"
												action="?/updateLine"
												use:enhance={keepValues}
												data-success="Ligne enregistrée."
												class="grid items-start gap-2 sm:grid-cols-[minmax(0,1fr)_5rem_6.5rem_4.5rem_5.5rem_6rem_auto]"
											>
												<input type="hidden" name="lineId" value={line.id} />
												<div class="min-w-0">
													<Input
														name="label"
														value={line.label}
														size="sm"
														aria-label="Désignation"
													/>
													<p class="mt-0.5 text-xs text-gray-500">
														{line.reference ?? 'Ligne libre'}{line.productType === 'service'
															? ' · prestation'
															: ''}
													</p>
												</div>
												<Input
													name="quantity"
													value={String(Number(line.quantity))}
													size="sm"
													class="text-end"
													aria-label="Quantité"
												/>
												<Input
													name="priceTtc"
													value={unitTtc(line).toFixed(2)}
													size="sm"
													class="text-end"
													aria-label="Prix unitaire TTC"
												/>
												<Input
													name="discountPercent"
													value={String(Number(line.discountPercent))}
													size="sm"
													class="text-end"
													aria-label="Remise en %"
												/>
												<Select
													name="taxRate"
													items={TAX_RATES}
													value={String(Number(line.taxRate))}
													size="sm"
													placeholder=""
													aria-label="Taux de TVA"
												/>
												<p class="pt-2 text-end font-semibold tabular-nums">
													{formatPrice(line.totalTtc)}
												</p>
												<div class="flex gap-1">
													<Button type="submit" size="xs" color="alternative">OK</Button>
													<button
														type="submit"
														formaction="?/deleteLine"
														aria-label="Supprimer la ligne {line.label}"
														class="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-red-700"
													>
														<TrashBinOutline class="h-4 w-4" />
													</button>
												</div>
											</form>
										</td>
									</tr>
								{:else}
									<tr class="align-top">
										<td class="py-2 pe-3">
											<p class="font-medium text-gray-900">
												{#if line.productId}<a
														href="/admin/products/{line.productId}"
														class="hover:underline">{line.label}</a
													>{:else}{line.label}{/if}
											</p>
											<p class="text-xs text-gray-500">
												{line.reference ?? 'Ligne libre'}{line.productType === 'service'
													? ' · prestation'
													: ''}
											</p>
											{#if line.productId && data.lineStock[line.productId]}
												<DocumentLineStock
													productId={line.productId}
													stock={data.lineStock[line.productId]}
												/>
											{/if}
										</td>
										<td class="px-2 py-2 text-end tabular-nums">{Number(line.quantity)}</td>
										<td class="px-2 py-2 text-end tabular-nums">{formatPrice(unitTtc(line))}</td>
										<td class="px-2 py-2 text-end tabular-nums"
											>{Number(line.discountPercent) ? `${Number(line.discountPercent)} %` : ''}</td
										>
										<td class="px-2 py-2 text-end tabular-nums">{Number(line.taxRate)} %</td>
										<td class="px-2 py-2 text-end font-semibold tabular-nums"
											>{formatPrice(line.totalTtc)}</td
										>
									</tr>
								{/if}
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</Card>

		{#if isDraft}
			<!-- ================= Ajouter ================= -->
			<Card class="max-w-none p-5">
				<label for="line-search" class="mb-2 block text-sm font-semibold text-gray-900">
					Ajouter un produit ou une prestation (MO-T1, révision…)
				</label>
				<input
					id="line-search"
					type="search"
					value={data.q}
					oninput={(e) => search(e.currentTarget.value)}
					autocomplete="off"
					placeholder="Référence, nom ou EAN : « MO-T1 », « courroie mtd »"
					class="block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:border-primary-500 focus:ring-primary-500"
				/>
				{#if data.q}
					<ul class="mt-3 divide-y divide-gray-100 rounded-lg border border-gray-200">
						{#each data.products as p (p.id)}
							<li class="flex items-center gap-3 p-2 text-sm">
								<div class="min-w-0 flex-1">
									<p class="truncate font-medium text-gray-900">{p.name}</p>
									<p class="text-xs text-gray-500">
										{p.reference} · {formatPrice(
											round2(Number(p.priceHt) * (1 + Number(p.taxRate) / 100))
										)} TTC
										{p.type === 'service' ? '· prestation' : `· stock ${p.stock}`}
									</p>
								</div>
								{#if p.type === 'service'}<StateBadge color="blue" label="Prestation" />{/if}
								<form
									method="POST"
									action="?/addProduct"
									use:enhance={clearSearch}
									data-success="Ligne ajoutée."
								>
									<input type="hidden" name="productId" value={p.id} />
									<Button type="submit" size="xs">Ajouter</Button>
								</form>
							</li>
						{:else}
							<li class="p-3 text-sm text-gray-500">
								Rien ne correspond : ajoutez une ligne libre.
							</li>
						{/each}
					</ul>
				{/if}

				<form
					method="POST"
					action="?/addFree"
					use:enhance
					data-success="Ligne ajoutée."
					class="mt-5 grid gap-2 border-t border-gray-200 pt-4 sm:grid-cols-[minmax(0,1fr)_5rem_7rem_6rem_auto] sm:items-end"
				>
					<div>
						<Label for="free-label" class="mb-1 text-xs">Ligne libre : désignation</Label>
						<Input
							id="free-label"
							name="label"
							size="sm"
							placeholder="ex. Roue arrière réf. 122E87-3"
							required
						/>
					</div>
					<div>
						<Label for="free-qty" class="mb-1 text-xs">Qté</Label>
						<Input id="free-qty" name="quantity" value="1" size="sm" />
					</div>
					<div>
						<Label for="free-price" class="mb-1 text-xs">P.U. TTC</Label>
						<Input id="free-price" name="priceTtc" size="sm" required />
					</div>
					<div>
						<Label for="free-tax" class="mb-1 text-xs">TVA</Label>
						<Select
							id="free-tax"
							name="taxRate"
							items={TAX_RATES}
							value="20"
							size="sm"
							placeholder=""
						/>
					</div>
					<Button type="submit" size="sm" color="alternative">Ajouter</Button>
				</form>
			</Card>
		{/if}
	</div>

	<!-- ================= Côté : client, totaux, règlements ================= -->
	<div class="space-y-6">
		<Card class="max-w-none p-5">
			<h2 class="mb-2 text-sm font-semibold text-gray-900">Client</h2>
			<a href="/admin/customers/{client.id}" class="font-medium text-primary-700 hover:underline">
				{client.companyName ? `${client.companyName} · ` : ''}{client.firstName}
				{client.lastName}
			</a>
			<p class="text-xs text-gray-500">
				{[client.email, client.phone].filter(Boolean).join(' · ')}
			</p>
			{#if data.repair}
				<p class="mt-2 text-sm">
					Ordre de réparation <a
						href="/admin/repairs/{data.repair.id}"
						class="text-primary-700 hover:underline">{data.repair.reference}</a
					>
				</p>
			{/if}
			{#if data.creditedInvoice}
				<p class="mt-2 text-sm">
					Avoir sur <a
						href="/admin/invoices/{data.creditedInvoice.id}"
						class="text-primary-700 hover:underline">{data.creditedInvoice.number}</a
					>
				</p>
			{/if}
			{#if isDraft}
				<form
					method="POST"
					action="?/header"
					use:enhance={keepValues}
					data-success="Enregistré."
					class="mt-4 space-y-3 border-t border-gray-200 pt-4"
				>
					<input type="hidden" name="customerId" value={client.id} />
					<div>
						<Label for="issued-on" class="mb-1 text-xs">Date de facture</Label>
						<Input
							id="issued-on"
							name="issuedOn"
							type="date"
							value={inv.issuedOn ?? ''}
							size="sm"
						/>
						<p class="mt-1 text-xs text-gray-500">Vide : la date de validation.</p>
					</div>
					<div>
						<Label for="note" class="mb-1 text-xs">Note imprimée</Label>
						<Textarea id="note" name="note" rows={2} value={inv.note ?? ''} />
					</div>
					<div>
						<Label for="private-note" class="mb-1 text-xs">Note interne</Label>
						<Textarea id="private-note" name="privateNote" rows={2} value={inv.privateNote ?? ''} />
					</div>
					<Button type="submit" size="xs" color="alternative">Enregistrer</Button>
				</form>
			{:else if inv.note}
				<p class="mt-3 text-sm text-gray-700">{inv.note}</p>
			{/if}
		</Card>

		<Card class="max-w-none p-5">
			<dl class="space-y-1.5 text-sm">
				<div class="flex justify-between">
					<dt class="text-gray-600">Total HT</dt>
					<dd class="tabular-nums">{formatPrice(inv.totalHt)}</dd>
				</div>
				{#each inv.taxBreakdown ?? [] as t (t.rate)}
					<div class="flex justify-between text-xs">
						<dt class="text-gray-500">TVA {t.rate} % sur {formatPrice(t.baseHt)}</dt>
						<dd class="tabular-nums">{formatPrice(t.taxAmount)}</dd>
					</div>
				{/each}
				<div class="flex justify-between border-t border-gray-200 pt-2 text-base font-semibold">
					<dt>Total TTC</dt>
					<dd class="tabular-nums">{formatPrice(inv.totalTtc)}</dd>
				</div>
				{#if !isCredit && !isDraft}
					<div class="flex justify-between">
						<dt class="text-gray-600">Réglé</dt>
						<dd class="tabular-nums">{formatPrice(data.paid)}</dd>
					</div>
					{#if data.credited}<div class="flex justify-between">
							<dt class="text-gray-600">Avoirs</dt>
							<dd class="tabular-nums">{formatPrice(data.credited)}</dd>
						</div>{/if}
					<div class="flex justify-between text-base font-semibold">
						<dt>Reste à payer</dt>
						<dd class="tabular-nums {data.remaining > 0 ? 'text-red-700' : 'text-green-700'}">
							{formatPrice(Math.max(0, data.remaining))}
						</dd>
					</div>
				{/if}
			</dl>
			{#if inv.status === 'abandoned'}<p class="mt-3 text-sm text-gray-700">
					Abandonnée : {inv.abandonReason}
				</p>{/if}
		</Card>

		{#if !isCredit && !isDraft}
			<Card class="max-w-none p-5">
				<h2 class="mb-3 text-sm font-semibold text-gray-900">Règlements</h2>
				{#each data.settlements as s (s.id)}
					<div class="flex justify-between border-b border-gray-100 py-1.5 text-sm">
						<span>
							{SETTLEMENT_METHOD_LABELS[s.method]}{s.chequeNumber ? ` n° ${s.chequeNumber}` : ''}
							<span class="block text-xs text-gray-500"
								>{new Intl.DateTimeFormat('fr-FR').format(new Date(s.receivedOn))} · {s.reference}</span
							>
						</span>
						<span class="font-semibold tabular-nums">{formatPrice(s.amount)}</span>
					</div>
				{:else}
					<p class="text-sm text-gray-500">Aucun règlement.</p>
				{/each}

				{#if inv.status === 'validated' && data.remaining > 0}
					<form
						method="POST"
						action="?/payment"
						use:enhance
						data-success="Règlement enregistré."
						class="mt-4 space-y-3 border-t border-gray-200 pt-4"
					>
						<div>
							<Label for="pay-method" class="mb-1 text-xs">Mode de règlement</Label>
							<Select
								id="pay-method"
								name="method"
								size="sm"
								placeholder=""
								bind:value={method}
								items={settlementMethods.map((m) => ({
									value: m,
									name: SETTLEMENT_METHOD_LABELS[m]
								}))}
							/>
						</div>
						<div class="grid grid-cols-2 gap-2">
							<div>
								<Label for="pay-amount" class="mb-1 text-xs">Montant (€)</Label>
								<Input
									id="pay-amount"
									name="amount"
									type="number"
									step="0.01"
									min="0.01"
									max={data.remaining.toFixed(2)}
									value={data.remaining.toFixed(2)}
									size="sm"
									required
								/>
							</div>
							<div>
								<Label for="pay-date" class="mb-1 text-xs">Reçu le</Label>
								<Input
									id="pay-date"
									name="receivedOn"
									type="date"
									value={today}
									size="sm"
									required
								/>
							</div>
						</div>
						{#if method === 'cheque'}
							<div>
								<Label for="cheque-number" class="mb-1 text-xs">Numéro du chèque</Label>
								<Input id="cheque-number" name="chequeNumber" size="sm" required />
							</div>
							<div class="grid grid-cols-2 gap-2">
								<div>
									<Label for="cheque-issuer" class="mb-1 text-xs">Émetteur</Label>
									<Input id="cheque-issuer" name="chequeIssuer" size="sm" />
								</div>
								<div>
									<Label for="cheque-bank" class="mb-1 text-xs">Banque</Label>
									<Input id="cheque-bank" name="chequeBank" size="sm" />
								</div>
							</div>
						{/if}
						<Button type="submit" size="sm" class="w-full">Enregistrer le règlement</Button>
					</form>

					<form
						method="POST"
						action="?/abandon"
						use:enhance
						data-success="Facture classée abandonnée."
						class="mt-4 flex gap-2 border-t border-gray-200 pt-4"
					>
						<Input
							name="reason"
							size="sm"
							placeholder="Raison de l'abandon du reste dû"
							aria-label="Raison de l'abandon"
							required
						/>
						<Button type="submit" size="xs" color="alternative">Abandonner</Button>
					</form>
				{/if}
			</Card>
		{/if}

		{#if data.creditNotes.length}
			<Card class="max-w-none p-5">
				<h2 class="mb-2 text-sm font-semibold text-gray-900">Avoirs</h2>
				{#each data.creditNotes as c (c.id)}
					<a
						href="/admin/invoices/{c.id}"
						class="flex justify-between py-1 text-sm hover:underline"
					>
						<span>{c.number ?? `Brouillon n° ${c.id}`}</span>
						<span class="tabular-nums">{formatPrice(c.totalTtc)}</span>
					</a>
				{/each}
			</Card>
		{/if}
	</div>
</div>
