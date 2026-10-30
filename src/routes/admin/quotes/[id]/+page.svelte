<script lang="ts">
	import { enhance } from '$lib/components/admin/feedback.svelte';
	import { Button, Card, Input, Label, Textarea } from 'flowbite-svelte';
	import { FilePdfOutline } from 'flowbite-svelte-icons';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { formatPrice } from '$lib/money';
	import { QUOTE_STATUS } from '$lib/quotes';
	import {
		ConfirmDialog,
		DocumentLines,
		DocumentTotals,
		PageHeader,
		StateBadge
	} from '$lib/components/admin';
	import type { PageProps } from './$types';

	/**
	 * Un devis. Brouillon : lignes, remises, durée de validité et notes se
	 * modifient, puis on l'envoie (numéro et date limite). Envoyé : il est figé ;
	 * on télécharge le PDF pour le client, on enregistre sa décision, et un devis
	 * accepté devient une facture comptoir. Pour corriger un devis envoyé, on le
	 * duplique (R5).
	 */

	let { data }: PageProps = $props();

	const q = $derived(data.quote);
	const isDraft = $derived(q.status === 'draft');
	const status = $derived(QUOTE_STATUS[data.displayStatus]);
	const title = $derived(`Devis ${q.number ?? `brouillon n° ${q.id}`}`);
	const client = $derived(data.customer);
	const canDecide = $derived(['sent', 'expired', 'accepted'].includes(data.displayStatus));
	const dateFmt = new Intl.DateTimeFormat('fr-FR');

	const keepValues: SubmitFunction =
		() =>
		({ update }) =>
			update({ reset: false });

	let confirm = $state<null | 'send' | 'delete' | 'invoice'>(null);
	let forms = $state<Record<string, HTMLFormElement | null>>({
		send: null,
		delete: null,
		invoice: null
	});
	const DIALOGS = {
		send: {
			title: 'Envoyer le devis',
			label: 'Envoyer',
			message: () =>
				`Le devis reçoit son numéro et sa date limite (${q.validityDays} jours), puis ne se modifie plus (total ${formatPrice(q.totalTtc)}). Téléchargez ensuite le PDF pour le transmettre au client.`
		},
		delete: {
			title: 'Supprimer le brouillon',
			label: 'Supprimer',
			message: () => 'Le brouillon et ses lignes seront supprimés.'
		},
		invoice: {
			title: 'Créer la facture',
			label: 'Créer la facture',
			message: () =>
				'Une facture comptoir en brouillon reprend toutes les lignes du devis. Vérifiez-la, puis validez-la depuis sa fiche.'
		}
	};
</script>

<svelte:head><title>{title} · Administration</title></svelte:head>

<PageHeader
	{title}
	subtitle={isDraft
		? 'Brouillon : tout se modifie, rien n’est visible du client. L’envoi attribue le numéro et fige le devis.'
		: `Du ${dateFmt.format(new Date(q.issuedOn ?? q.createdAt))}${q.validUntil ? ` · valable jusqu'au ${dateFmt.format(new Date(q.validUntil))}` : ''}${q.legacyDoliId ? ' · reprise de Dolibarr' : ''}`}
	crumbs={[
		{ label: 'Accueil', href: '/admin' },
		{ label: 'Devis', href: '/admin/quotes' },
		{ label: q.number ?? `Brouillon n° ${q.id}` }
	]}
>
	{#snippet actions()}
		<StateBadge color={status.color} label={status.label} />
		<Button color="alternative" href="/admin/quotes/{q.id}/pdf" target="_blank">
			<FilePdfOutline class="me-2 h-4 w-4" /> PDF
		</Button>
		{#if isDraft}
			<Button color="alternative" onclick={() => (confirm = 'delete')}>Supprimer</Button>
			<Button color="green" disabled={!data.lines.length} onclick={() => (confirm = 'send')}>
				Envoyer le devis
			</Button>
		{:else}
			<form method="POST" action="?/duplicate" use:enhance data-feedback="errors">
				<Button type="submit" color="alternative">Dupliquer</Button>
			</form>
			{#if q.status === 'accepted'}
				<Button color="green" onclick={() => (confirm = 'invoice')}>Créer la facture</Button>
			{/if}
		{/if}
	{/snippet}
</PageHeader>

{#each ['send', 'delete', 'invoice'] as const as name (name)}
	<form
		bind:this={forms[name]}
		method="POST"
		action={name === 'delete' ? '?/deleteDraft' : `?/${name}`}
		use:enhance
		data-success={name === 'send' ? 'Devis envoyé : le numéro est attribué.' : undefined}
		data-feedback={name === 'send' ? undefined : 'errors'}
		class="hidden"
	></form>
{/each}
<ConfirmDialog
	open={confirm !== null}
	title={confirm ? DIALOGS[confirm].title : ''}
	message={confirm ? DIALOGS[confirm].message() : ''}
	confirmLabel={confirm ? DIALOGS[confirm].label : ''}
	onconfirm={() => {
		const form = confirm ? forms[confirm] : null;
		confirm = null;
		form?.requestSubmit();
	}}
/>

<div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
	<div class="min-w-0 space-y-6">
		<DocumentLines
			lines={data.lines}
			editable={isDraft}
			basePath="/admin/quotes/{q.id}"
			q={data.q}
			products={data.products}
		/>
	</div>

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
			{#if data.invoice}
				<p class="mt-2 text-sm">
					Facturé : <a
						href="/admin/invoices/{data.invoice.id}"
						class="text-primary-700 hover:underline"
						>{data.invoice.number ?? `brouillon n° ${data.invoice.id}`}</a
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
					<div class="grid grid-cols-2 gap-2">
						<div>
							<Label for="issued-on" class="mb-1 text-xs">Date du devis</Label>
							<Input
								id="issued-on"
								name="issuedOn"
								type="date"
								value={q.issuedOn ?? ''}
								size="sm"
							/>
						</div>
						<div>
							<Label for="validity" class="mb-1 text-xs">Validité (jours)</Label>
							<Input
								id="validity"
								name="validityDays"
								type="number"
								min="1"
								value={String(q.validityDays)}
								size="sm"
							/>
						</div>
					</div>
					<p class="text-xs text-gray-500">Date vide : celle de l'envoi.</p>
					<div>
						<Label for="customer-reference" class="mb-1 text-xs">Réf. client</Label>
						<Input
							id="customer-reference"
							name="customerReference"
							value={q.customerReference ?? ''}
							size="sm"
							placeholder="Chantier, machine, n° de commande…"
						/>
					</div>
					<div>
						<Label for="delivery-on" class="mb-1 text-xs">Livraison prévue le</Label>
						<Input
							id="delivery-on"
							name="deliveryOn"
							type="date"
							value={q.deliveryOn ?? ''}
							size="sm"
						/>
					</div>
					<div>
						<Label for="note" class="mb-1 text-xs">Note imprimée (délai, conditions…)</Label>
						<Textarea id="note" name="note" rows={2} value={q.note ?? ''} />
					</div>
					<div>
						<Label for="private-note" class="mb-1 text-xs">Note interne, jamais imprimée</Label>
						<Textarea id="private-note" name="privateNote" rows={2} value={q.privateNote ?? ''} />
					</div>
					<Button type="submit" size="xs" color="alternative">Enregistrer</Button>
				</form>
			{:else}
				{#if q.customerReference}<p class="mt-3 text-sm text-gray-700">
						Réf. client : {q.customerReference}
					</p>{/if}
				{#if q.deliveryOn}<p class="mt-1 text-sm text-gray-700">
						Livraison prévue le {dateFmt.format(new Date(q.deliveryOn))}
					</p>{/if}
				{#if q.note}<p class="mt-3 text-sm text-gray-700">{q.note}</p>{/if}
				{#if q.privateNote}<p class="mt-2 text-xs text-gray-500">Interne : {q.privateNote}</p>{/if}
			{/if}
		</Card>

		<DocumentTotals totalHt={q.totalHt} totalTtc={q.totalTtc} taxBreakdown={q.taxBreakdown ?? []} />

		{#if canDecide || q.decisionNote}
			<Card class="max-w-none p-5">
				<h2 class="mb-2 text-sm font-semibold text-gray-900">Décision du client</h2>
				{#if q.decidedAt}
					<p class="text-sm text-gray-700">
						{QUOTE_STATUS[q.status === 'invoiced' ? 'accepted' : q.status].label} le {dateFmt.format(
							new Date(q.decidedAt)
						)}{q.decisionNote ? ` : ${q.decisionNote}` : ''}
					</p>
				{:else if data.displayStatus === 'expired'}
					<p class="text-sm text-gray-700">
						Date limite passée : le devis ne s'accepte plus. Dupliquez-le pour en émettre un
						nouveau.
					</p>
				{/if}
				{#if canDecide}
					<form
						method="POST"
						action="?/accept"
						use:enhance
						data-success="Décision enregistrée."
						class="mt-3 space-y-2"
					>
						<Textarea
							name="note"
							rows={2}
							placeholder="Précision ou motif du refus (facultatif)"
							aria-label="Précision ou motif du refus"
						/>
						<div class="flex gap-2">
							{#if data.displayStatus === 'sent'}
								<Button type="submit" size="xs" color="green">Accepté</Button>
							{/if}
							<Button type="submit" size="xs" color="alternative" formaction="?/reject"
								>Refusé</Button
							>
						</div>
					</form>
				{/if}
			</Card>
		{/if}
	</div>
</div>
