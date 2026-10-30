<script lang="ts">
	import { enhance } from '$lib/components/admin/feedback.svelte';
	import { Button, Card, Input, Label, Select, Textarea } from 'flowbite-svelte';
	import { FilePdfOutline } from 'flowbite-svelte-icons';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { formatPrice } from '$lib/money';
	import {
		COUNTER_STATUS,
		counterKinds,
		PAYMENT_TERMS_LABELS,
		paymentTerms
	} from '$lib/counter-invoices';
	import {
		BANK_ACCOUNTS,
		bankAccountLabel,
		SETTLEMENT_METHOD_LABELS,
		settlementAccount,
		settlementLabel,
		settlementMethods
	} from '$lib/settlements';
	import {
		ConfirmDialog,
		DocumentLineStock,
		DocumentLines,
		DocumentTotals,
		PageHeader,
		StateBadge
	} from '$lib/components/admin';
	import type { PageProps } from './$types';

	/**
	 * Une facture comptoir ou un avoir. Brouillon : on ajoute produits,
	 * prestations de main-d'œuvre et lignes libres, on ajuste quantités, prix
	 * TTC et remises, puis on valide. Validée : elle est figée ; on enregistre
	 * les règlements, on sort les pièces du stock, on la corrige par un avoir.
	 * Les informations reprennent l'en-tête de Dolibarr : réf. client,
	 * conditions et mode de règlement, échéance, compte, adresse, suivi.
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
	const dateFmt = new Intl.DateTimeFormat('fr-FR');
	// Dolibarr ne garde que le jour : pas d'heure pour une facture reprise.
	const stampFmt = $derived(
		inv.legacyDoliId
			? dateFmt
			: new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
	);
	const addr = $derived(data.address);
	const creditTotal = $derived(data.credits.reduce((sum, c) => sum + Number(c.amountTtc), 0));
	const methodOptions = [
		{ value: '', name: 'Non précisé' },
		...settlementMethods.map((m) => ({ value: m, name: SETTLEMENT_METHOD_LABELS[m] }))
	];
	const keepValues: SubmitFunction =
		() =>
		({ update }) =>
			update({ reset: false });
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
		<Card class="max-w-none p-5">
			<h2 class="mb-4 text-lg font-semibold text-gray-900">Informations</h2>
			{#if isDraft}
				<form
					method="POST"
					action="?/header"
					use:enhance={keepValues}
					data-success="Enregistré."
					class="grid gap-3 sm:grid-cols-2"
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
						<Label for="customer-reference" class="mb-1 text-xs">Réf. client</Label>
						<Input
							id="customer-reference"
							name="customerReference"
							value={inv.customerReference ?? ''}
							size="sm"
							placeholder="N° de commande, chantier, machine…"
						/>
					</div>
					{#if !isCredit}
						<div>
							<Label for="payment-terms" class="mb-1 text-xs">Conditions de règlement</Label>
							<Select
								id="payment-terms"
								name="paymentTerms"
								size="sm"
								placeholder=""
								value={inv.paymentTerms}
								items={paymentTerms.map((t) => ({ value: t, name: PAYMENT_TERMS_LABELS[t] }))}
							/>
							<p class="mt-1 text-xs text-gray-500">L'échéance se calcule à la validation.</p>
						</div>
						<div>
							<Label for="payment-method" class="mb-1 text-xs">Mode de règlement prévu</Label>
							<Select
								id="payment-method"
								name="paymentMethod"
								size="sm"
								placeholder=""
								value={inv.paymentMethod ?? ''}
								items={methodOptions}
							/>
						</div>
					{/if}
					<div>
						<Label for="bank-account" class="mb-1 text-xs">Compte bancaire</Label>
						<Select
							id="bank-account"
							name="bankAccount"
							size="sm"
							placeholder=""
							value={inv.bankAccount}
							items={Object.entries(BANK_ACCOUNTS).map(([value, name]) => ({ value, name }))}
						/>
					</div>
					<div class="sm:col-span-2">
						<Label for="note" class="mb-1 text-xs">Note imprimée</Label>
						<Textarea id="note" name="note" rows={2} value={inv.note ?? ''} />
					</div>
					<div class="sm:col-span-2">
						<Label for="private-note" class="mb-1 text-xs">Note interne, jamais imprimée</Label>
						<Textarea id="private-note" name="privateNote" rows={2} value={inv.privateNote ?? ''} />
					</div>
					<div class="sm:col-span-2">
						<Button type="submit" size="xs" color="alternative">Enregistrer</Button>
					</div>
				</form>
			{:else}
				<dl
					class="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,1fr)]"
				>
					<dt class="text-gray-500">Type</dt>
					<dd>{counterKinds[inv.kind]}</dd>
					<dt class="text-gray-500">Réf. client</dt>
					<dd>{inv.customerReference ?? '—'}</dd>
					<dt class="text-gray-500">Date de facturation</dt>
					<dd>{inv.issuedOn ? dateFmt.format(new Date(inv.issuedOn)) : '—'}</dd>
					{#if !isCredit}
						<dt class="text-gray-500">Conditions de règlement</dt>
						<dd>{PAYMENT_TERMS_LABELS[inv.paymentTerms]}</dd>
						<dt class="text-gray-500">Date limite de règlement</dt>
						<dd>{inv.dueOn ? dateFmt.format(new Date(inv.dueOn)) : '—'}</dd>
						<dt class="text-gray-500">Mode de règlement</dt>
						<dd>{inv.paymentMethod ? SETTLEMENT_METHOD_LABELS[inv.paymentMethod] : '—'}</dd>
					{/if}
					<dt class="text-gray-500">Compte bancaire</dt>
					<dd>{bankAccountLabel(inv.bankAccount)}</dd>
					<dt class="text-gray-500">Remises</dt>
					<dd>
						{creditTotal
							? `Ce client a ${formatPrice(creditTotal)} de crédit disponible.`
							: 'Ce client n’a pas de crédit disponible.'}
					</dd>
				</dl>
				{#if inv.note || inv.privateNote}
					<div class="mt-4 grid gap-3 border-t border-gray-200 pt-4 text-sm sm:grid-cols-2">
						{#if inv.note}
							<div>
								<p class="text-xs text-gray-500">Note imprimée</p>
								<p class="whitespace-pre-line text-gray-800">{inv.note}</p>
							</div>
						{/if}
						{#if inv.privateNote}
							<div>
								<p class="text-xs text-gray-500">Note interne</p>
								<p class="whitespace-pre-line text-gray-800">{inv.privateNote}</p>
							</div>
						{/if}
					</div>
				{/if}
			{/if}
		</Card>

		{#if isDraft && !isCredit && data.credits.length}
			<Card class="max-w-none p-5">
				<h2 class="mb-2 text-sm font-semibold text-gray-900">
					Crédits disponibles du client · {formatPrice(creditTotal)}
				</h2>
				<ul class="divide-y divide-gray-100 text-sm">
					{#each data.credits as credit (credit.id)}
						<li class="flex items-center justify-between gap-3 py-2">
							<span class="min-w-0 text-gray-800">{credit.description}</span>
							<span class="flex items-center gap-2">
								<span class="tabular-nums">{formatPrice(credit.amountTtc)}</span>
								<form
									method="POST"
									action="?/useCredit"
									use:enhance
									data-success="Crédit déduit de la facture."
								>
									<input type="hidden" name="creditId" value={credit.id} />
									<Button type="submit" size="xs" color="alternative">Déduire</Button>
								</form>
							</span>
						</li>
					{/each}
				</ul>
			</Card>
		{/if}

		<DocumentLines
			lines={data.lines}
			editable={isDraft}
			basePath="/admin/invoices/{inv.id}"
			q={data.q}
			products={data.products}
		>
			{#snippet lineExtra(line)}
				{#if line.productId && data.lineStock[line.productId]}
					<DocumentLineStock productId={line.productId} stock={data.lineStock[line.productId]} />
				{/if}
			{/snippet}
		</DocumentLines>
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
			{#if data.quote}
				<p class="mt-2 text-sm">
					Issue du devis <a
						href="/admin/quotes/{data.quote.id}"
						class="text-primary-700 hover:underline">{data.quote.number}</a
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
			<div class="mt-3 border-t border-gray-200 pt-3 text-sm text-gray-700">
				<p class="mb-1 text-xs text-gray-500">
					Adresse de facturation{inv.billingAddress ? '' : ' (fiche client)'}
				</p>
				<p class="whitespace-pre-line">
					{[
						addr.company,
						addr.name,
						addr.line1,
						addr.line2,
						[addr.postalCode, addr.city].filter(Boolean).join(' ')
					]
						.filter(Boolean)
						.join('\n')}
				</p>
			</div>
		</Card>

		<DocumentTotals
			totalHt={inv.totalHt}
			totalTtc={inv.totalTtc}
			taxBreakdown={inv.taxBreakdown ?? []}
		>
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
			{#if inv.status === 'abandoned'}<p class="pt-2 text-sm text-gray-700">
					Abandonnée : {inv.abandonReason}
				</p>{/if}
		</DocumentTotals>

		{#if !isCredit && !isDraft}
			<Card class="max-w-none p-5">
				<h2 class="mb-3 text-sm font-semibold text-gray-900">Règlements</h2>
				{#each data.settlements as s (s.id)}
					<div class="flex justify-between border-b border-gray-100 py-1.5 text-sm">
						<span>
							{SETTLEMENT_METHOD_LABELS[s.method]}{s.chequeNumber ? ` n° ${s.chequeNumber}` : ''}
							<span class="block text-xs text-gray-500"
								>{dateFmt.format(new Date(s.receivedOn))} · {settlementLabel(s.reference)} · {bankAccountLabel(
									settlementAccount(s)
								)}</span
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

		<Card class="max-w-none p-5">
			<h2 class="mb-2 text-sm font-semibold text-gray-900">Suivi</h2>
			<ul class="space-y-1 text-sm text-gray-700">
				<li>
					Créée le {stampFmt.format(new Date(inv.createdAt))}{data.createdByName
						? ` par ${data.createdByName}`
						: ''}
				</li>
				{#if inv.validatedAt}
					<li>
						Validée le {stampFmt.format(new Date(inv.validatedAt))}{data.validatedByName
							? ` par ${data.validatedByName}`
							: ''}
					</li>
				{/if}
				{#if inv.legacyDoliId}<li class="text-gray-500">Reprise de Dolibarr</li>{/if}
			</ul>
		</Card>

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
