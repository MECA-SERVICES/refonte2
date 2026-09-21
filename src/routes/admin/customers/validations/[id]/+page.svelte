<script lang="ts">
	import { enhance } from '$app/forms';
	import { Alert, Badge, Button, Card, Label, Textarea } from 'flowbite-svelte';
	import PageHeader from '$lib/components/admin/PageHeader.svelte';
	import {
		CUSTOMER_STATUS_COLORS,
		CUSTOMER_STATUS_LABELS,
		CUSTOMER_TYPE_LABELS,
		normalizeCustomerStatus,
		normalizeCustomerType,
		type ValidationDecision
	} from '$lib/accounts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const dateTime = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' });

	const client = $derived(data.customer);
	const req = $derived(data.request);
	const type = $derived(normalizeCustomerType(req.requestType));
	const status = $derived(normalizeCustomerStatus(req.status));
	const open = $derived(status === 'pending');

	/** Informations figées à la soumission, telles que déclarées. */
	const submitted = $derived((req.submittedData ?? {}) as Record<string, string | null>);

	/**
	 * Décision en cours de saisie.
	 *
	 * `reject` et `request_info` exigent un message ; le formulaire ne s'ouvre
	 * donc qu'une fois la décision choisie, pour que le champ soit visible
	 * avant l'envoi.
	 */
	let decision = $state<ValidationDecision | null>(null);

	const needsMessage = $derived(decision === 'reject' || decision === 'request_info');

	const messageLabel = $derived(
		decision === 'reject'
			? 'Motif du refus (transmis au client)'
			: 'Éléments manquants (transmis au client)'
	);

	/** R3 : un dossier professionnel sans SIRET n'est pas instruisible. */
	const missingSiret = $derived(type === 'pro' && !submitted.siret && !client.siret);

	/*
	 * Récapitulatif du dossier, vides écartés.
	 *
	 * Les valeurs figées à la soumission priment : la fiche client a pu être
	 * modifiée depuis, et c'est le dossier déposé qui est examiné.
	 */
	const facts = $derived(
		[
			['Type de compte', CUSTOMER_TYPE_LABELS[type]],
			['Raison sociale', submitted.companyName ?? client.companyName],
			['SIRET', submitted.siret ?? client.siret],
			['N° TVA intracommunautaire', submitted.vatNumber ?? client.vatNumber],
			['Type de collectivité', submitted.collectivityType ?? client.collectivityType],
			['Nom de la collectivité', submitted.collectivityName ?? client.collectivityName],
			['Pays de facturation', client.billingCountry],
			['Téléphone', client.phone]
		].filter(([, value]) => value)
	);
</script>

<svelte:head><title>Dossier de validation · Administration</title></svelte:head>

<PageHeader
	title="{client.firstName} {client.lastName}"
	subtitle="Dossier {CUSTOMER_TYPE_LABELS[type]} déposé le {dateTime.format(
		new Date(req.createdAt)
	)}"
	crumbs={[
		{ label: 'Accueil', href: '/admin' },
		{ label: 'Clients', href: '/admin/customers' },
		{ label: 'Validations', href: '/admin/customers/validations' },
		{ label: 'Dossier' }
	]}
>
	{#snippet actions()}
		<a href="/admin/customers/{client.id}">
			<Button color="alternative" size="sm">Voir la fiche client</Button>
		</a>
	{/snippet}
</PageHeader>

{#if form?.message}
	<Alert color="red" class="mb-4">{form.message}</Alert>
{/if}

{#if form?.decided}
	<Alert color="green" class="mb-4">
		{form.decided === 'validate'
			? 'Compte validé — les conditions professionnelles sont ouvertes.'
			: form.decided === 'reject'
				? 'Dossier refusé. Le motif est enregistré sur la fiche client.'
				: 'Complément demandé. Le dossier reste en attente.'}
	</Alert>
{/if}

<div class="grid gap-4 lg:grid-cols-3">
	<div class="space-y-4 lg:col-span-2">
		<Card class="max-w-none p-6">
			<div class="mb-4 flex flex-wrap items-center justify-between gap-2">
				<h2 class="text-base font-semibold text-gray-900 dark:text-white">Dossier déclaré</h2>
				<Badge color={CUSTOMER_STATUS_COLORS[status]}>{CUSTOMER_STATUS_LABELS[status]}</Badge>
			</div>

			<dl class="grid gap-3 sm:grid-cols-2">
				<div>
					<dt class="text-xs text-gray-500">Email</dt>
					<dd class="text-sm text-gray-900 dark:text-white">{client.email}</dd>
				</div>
				{#each facts as [label, value] (label)}
					<div>
						<dt class="text-xs text-gray-500">{label}</dt>
						<dd class="text-sm text-gray-900 dark:text-white">{value}</dd>
					</div>
				{/each}
			</dl>

			{#if missingSiret}
				<Alert color="yellow" class="mt-4">
					Aucun SIRET n'est renseigné. La règle R3 le rend obligatoire pour un compte professionnel
					: demandez un complément plutôt que de valider en l'état.
				</Alert>
			{/if}

			<!--
				Le contrôle officiel du SIRET auprès du référentiel des entreprises et
				celui du numéro de TVA (R3, R6) ne sont pas encore branchés : la
				vérification reste manuelle à ce stade.
			-->
			<p class="mt-4 text-xs text-gray-500">
				Contrôles automatiques SIRET et TVA non branchés — vérification manuelle.
			</p>
		</Card>

		{#if req.infoRequestedAt}
			<Card class="max-w-none p-6">
				<h2 class="mb-2 text-base font-semibold text-gray-900 dark:text-white">
					Complément demandé
				</h2>
				<p class="text-xs text-gray-500">
					Le {dateTime.format(new Date(req.infoRequestedAt))}
				</p>
				<p class="mt-2 text-sm whitespace-pre-line text-gray-900 dark:text-white">
					{req.infoRequested}
				</p>
			</Card>
		{/if}

		{#if !open}
			<Card class="max-w-none p-6">
				<h2 class="mb-3 text-base font-semibold text-gray-900 dark:text-white">Décision</h2>
				<dl class="grid gap-3 sm:grid-cols-2">
					<div>
						<dt class="text-xs text-gray-500">Traité le</dt>
						<dd class="text-sm text-gray-900 dark:text-white">
							{req.reviewedAt ? dateTime.format(new Date(req.reviewedAt)) : '—'}
						</dd>
					</div>
					<div>
						<dt class="text-xs text-gray-500">Par</dt>
						<dd class="text-sm text-gray-900 dark:text-white">{data.reviewerName ?? '—'}</dd>
					</div>
				</dl>
				{#if req.rejectionReason}
					<div class="mt-3">
						<dt class="text-xs text-gray-500">Motif communiqué au client</dt>
						<dd class="text-sm whitespace-pre-line text-gray-900 dark:text-white">
							{req.rejectionReason}
						</dd>
					</div>
				{/if}
				{#if req.reviewNotes}
					<div class="mt-3">
						<!-- R13 : note interne, jamais exposée au client. -->
						<dt class="text-xs text-gray-500">Note interne</dt>
						<dd class="text-sm whitespace-pre-line text-gray-900 dark:text-white">
							{req.reviewNotes}
						</dd>
					</div>
				{/if}
			</Card>
		{/if}

		{#if data.history.length > 1}
			<Card class="max-w-none p-6">
				<h2 class="mb-3 text-base font-semibold text-gray-900 dark:text-white">
					Historique des dossiers
				</h2>
				<ul class="space-y-2">
					{#each data.history as item (item.id)}
						{@const itemStatus = normalizeCustomerStatus(item.status)}
						<li class="flex items-center justify-between gap-3 text-sm">
							<span class="text-gray-500">
								{dateTime.format(new Date(item.createdAt))}
							</span>
							<Badge color={CUSTOMER_STATUS_COLORS[itemStatus]}>
								{CUSTOMER_STATUS_LABELS[itemStatus]}
							</Badge>
							{#if item.id === req.id}
								<span class="text-xs text-gray-500">dossier courant</span>
							{:else}
								<a
									href="/admin/customers/validations/{item.id}"
									class="text-xs text-primary-600 hover:underline"
								>
									Ouvrir
								</a>
							{/if}
						</li>
					{/each}
				</ul>
			</Card>
		{/if}
	</div>

	<div>
		<Card class="max-w-none p-6">
			<h2 class="mb-4 text-base font-semibold text-gray-900 dark:text-white">Traiter le dossier</h2>

			{#if !open}
				<p class="text-sm text-gray-600 dark:text-gray-300">
					Ce dossier est clos. Le client peut déposer une nouvelle demande après correction.
				</p>
			{:else}
				<form
					method="POST"
					action="?/decide"
					use:enhance={() =>
						async ({ result, update }) => {
							if (result.type === 'success') decision = null;
							await update();
						}}
					class="space-y-4"
				>
					<div class="flex flex-col gap-2">
						<Button
							type="button"
							color={decision === 'validate' ? 'green' : 'alternative'}
							onclick={() => (decision = 'validate')}
						>
							Valider le compte
						</Button>
						<Button
							type="button"
							color={decision === 'request_info' ? 'purple' : 'alternative'}
							onclick={() => (decision = 'request_info')}
						>
							Demander un complément
						</Button>
						<Button
							type="button"
							color={decision === 'reject' ? 'red' : 'alternative'}
							onclick={() => (decision = 'reject')}
						>
							Refuser
						</Button>
					</div>

					{#if decision}
						<input type="hidden" name="decision" value={decision} />

						{#if needsMessage}
							<div>
								<Label for="message" class="mb-2">{messageLabel}</Label>
								<Textarea id="message" name="message" rows={4} required />
							</div>
						{/if}

						<div>
							<!-- R13 : réservée à l'équipe, jamais transmise. -->
							<Label for="reviewNotes" class="mb-2">Note interne (facultative)</Label>
							<Textarea id="reviewNotes" name="reviewNotes" rows={2} />
						</div>

						{#if decision === 'validate' && missingSiret}
							<Alert color="yellow">
								Le SIRET est manquant : valider ce dossier contrevient à R3.
							</Alert>
						{/if}

						<Button type="submit" color="primary" class="w-full">Enregistrer la décision</Button>
					{/if}
				</form>

				<!--
					Les emails du §7 (accusé, validation, refus, complément) partiront
					quand le service de notifications (CDC 36) existera.
				-->
				<p class="mt-4 text-xs text-gray-500">
					Aucun email n'est envoyé pour l'instant : le service de notifications n'est pas encore en
					place. Prévenez le client par un autre canal.
				</p>
			{/if}
		</Card>
	</div>
</div>
