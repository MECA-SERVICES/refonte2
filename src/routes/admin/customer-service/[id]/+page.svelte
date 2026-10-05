<script lang="ts">
	import { enhance } from '$app/forms';
	import { formatPrice } from '$lib/money';
	import { Badge, Button, Card, Label, Select, Textarea } from 'flowbite-svelte';
	import { PaperClipOutline } from 'flowbite-svelte-icons';
	import { PageHeader, StateBadge } from '$lib/components/admin';
	import {
		HISTORY_STATUS_LABELS,
		SUPPORT_PRIORITY_LABELS,
		SUPPORT_STATUS_COLORS,
		SUPPORT_STATUS_LABELS
	} from '$lib/support';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const t = $derived(data.thread);
	const dateFmt = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
	const dayFmt = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' });

	const statusLabel = (code: string | null) => (code ? (HISTORY_STATUS_LABELS[code] ?? code) : '—');

	const requester = $derived(
		t.customer
			? `${t.customer.firstName} ${t.customer.lastName}`
			: t.guestName || t.guestEmail || 'Demandeur inconnu'
	);

	let content = $state('');
</script>

<svelte:head><title>{t.reference} · Service client</title></svelte:head>

<PageHeader
	title={t.subject}
	subtitle="{t.reference} · ouverte le {dayFmt.format(new Date(t.createdAt))}"
	crumbs={[
		{ label: 'Accueil', href: '/admin' },
		{ label: 'Service client', href: '/admin/customer-service' },
		{ label: t.reference }
	]}
>
	{#snippet actions()}
		<StateBadge label={SUPPORT_STATUS_LABELS[t.status]} color={SUPPORT_STATUS_COLORS[t.status]} />
	{/snippet}
</PageHeader>

<div class="grid gap-6 lg:grid-cols-3">
	<!-- ================= Fil ================= -->
	<div class="space-y-6 lg:col-span-2">
		{#if t.previous}
			<p class="text-sm text-gray-500">
				Suite de la conversation
				<a
					href="/admin/customer-service/{t.previous.id}"
					class="font-medium text-primary-700 hover:underline dark:text-primary-400"
				>
					{t.previous.reference}
				</a>
			</p>
		{/if}

		<Card class="max-w-none p-6">
			<ol class="space-y-4">
				{#each t.messages as m (m.id)}
					<li>
						{#if m.kind === 'status_change'}
							<p class="text-center text-xs text-gray-500">
								<span class="font-medium text-gray-700 dark:text-gray-300">{m.author}</span>
								· {statusLabel(m.statusFrom)} → {statusLabel(m.statusTo)} ·
								{dateFmt.format(new Date(m.createdAt))}
							</p>
						{:else}
							{@const staff = m.kind === 'staff'}
							{@const note = m.kind === 'internal_note'}
							<div class="flex {staff ? 'justify-end' : 'justify-start'}">
								<div
									class="max-w-[85%] rounded-lg border px-4 py-3 text-sm {note
										? 'w-full max-w-none border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950'
										: staff
											? 'border-primary-200 bg-primary-50 dark:border-primary-800 dark:bg-primary-950'
											: 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800'}"
								>
									<p class="mb-1.5 flex flex-wrap items-center gap-x-2 text-xs text-gray-500">
										<span class="font-semibold text-gray-800 dark:text-gray-200">{m.author}</span>
										{#if note}<Badge color="yellow">Note interne</Badge>{/if}
										<time>{dateFmt.format(new Date(m.createdAt))}</time>
									</p>
									<div
										class="message-body leading-relaxed break-words text-gray-800 dark:text-gray-200"
									>
										<!-- eslint-disable-next-line svelte/no-at-html-tags -- assaini côté serveur -->
										{@html m.html}
									</div>
									{#if m.files.length}
										<ul class="mt-2 space-y-0.5">
											{#each m.files as file (file)}
												<li
													class="flex items-center gap-1.5 text-xs text-gray-500"
													title="Pièce jointe non disponible au téléchargement"
												>
													<PaperClipOutline class="h-3.5 w-3.5" />
													{file}
												</li>
											{/each}
										</ul>
									{/if}
								</div>
							</div>
						{/if}
					</li>
				{:else}
					<li class="text-sm text-gray-500">Aucun message.</li>
				{/each}
			</ol>
		</Card>

		{#if t.followUps.length}
			<p class="text-sm text-gray-500">
				Suite :
				{#each t.followUps as f, i (f.id)}
					{#if i > 0},
					{/if}
					<a
						href="/admin/customer-service/{f.id}"
						class="font-medium text-primary-700 hover:underline dark:text-primary-400"
					>
						{f.reference}
					</a>
				{/each}
			</p>
		{/if}

		<!-- ================= Réponse ================= -->
		<Card class="max-w-none p-6">
			<h2 class="mb-3 text-base font-semibold text-gray-900 dark:text-white">Répondre</h2>
			{#if t.isLegacy}
				<p class="mb-3 text-sm text-gray-500">
					Cette conversation est clôturée : votre message ouvrira une nouvelle conversation liée.
				</p>
			{/if}
			{#if form?.message}
				<p
					class="mb-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
				>
					{form.message}
				</p>
			{/if}
			<form
				method="POST"
				action="?/reply"
				use:enhance={() =>
					async ({ result, update }) => {
						await update();
						if (result.type === 'success') content = '';
					}}
				class="space-y-3"
			>
				<Textarea
					name="content"
					rows={6}
					class="w-full"
					bind:value={content}
					placeholder="Votre message…"
					required
				/>
				<div class="flex flex-wrap gap-2">
					<Button type="submit" name="internal" value="0" color="primary">Envoyer au client</Button>
					<Button type="submit" name="internal" value="1" color="alternative">
						Ajouter une note interne
					</Button>
				</div>
				<p class="text-xs text-gray-500">La note interne n'est jamais visible du client.</p>
			</form>
		</Card>
	</div>

	<!-- ================= Colonne latérale ================= -->
	<div class="space-y-6">
		<Card class="max-w-none p-6">
			<h2 class="mb-4 text-base font-semibold text-gray-900 dark:text-white">Traitement</h2>
			{#if t.isLegacy}
				<dl class="space-y-2 text-sm">
					<div class="flex justify-between gap-4">
						<dt class="text-gray-500">Catégorie</dt>
						<dd class="text-gray-900 dark:text-white">{t.categoryLabel ?? '—'}</dd>
					</div>
					<div class="flex justify-between gap-4">
						<dt class="text-gray-500">Traitée par</dt>
						<dd class="text-gray-900 dark:text-white">{t.lastAgentName ?? '—'}</dd>
					</div>
				</dl>
			{:else}
				<form method="POST" action="?/meta" use:enhance class="space-y-3">
					<div>
						<Label for="categoryId" class="mb-1.5">Catégorie</Label>
						<Select
							id="categoryId"
							name="categoryId"
							value={t.categoryId ? String(t.categoryId) : ''}
							items={[
								{ value: '', name: 'Aucune' },
								...data.categories.map((c) => ({ value: String(c.id), name: c.label }))
							]}
						/>
					</div>
					<div>
						<Label for="priority" class="mb-1.5">Priorité</Label>
						<Select
							id="priority"
							name="priority"
							value={t.priority}
							items={Object.entries(SUPPORT_PRIORITY_LABELS).map(([value, name]) => ({
								value,
								name
							}))}
						/>
					</div>
					<div>
						<Label for="assignedUserId" class="mb-1.5">Assignée à</Label>
						<Select
							id="assignedUserId"
							name="assignedUserId"
							value={t.assignedUserId ?? ''}
							items={[
								{ value: '', name: 'Personne' },
								...data.staff.map((u) => ({ value: u.id, name: u.name }))
							]}
						/>
					</div>
					<Button type="submit" color="primary" class="w-full">Enregistrer</Button>
					{#if form && 'saved' in form}
						<p class="text-center text-xs text-green-700 dark:text-green-400">Enregistré.</p>
					{/if}
				</form>

				<div class="mt-4 border-t border-gray-200 pt-4 dark:border-gray-700">
					{#if t.status === 'closed'}
						<form method="POST" action="?/reopen" use:enhance>
							<Button type="submit" color="alternative" class="w-full"
								>Rouvrir la conversation</Button
							>
						</form>
					{:else}
						<form method="POST" action="?/close" use:enhance>
							<Button type="submit" color="alternative" class="w-full"
								>Clôturer la conversation</Button
							>
						</form>
					{/if}
				</div>
			{/if}
		</Card>

		<Card class="max-w-none p-6">
			<h2 class="mb-3 text-base font-semibold text-gray-900 dark:text-white">Demandeur</h2>
			{#if t.customer}
				<a
					href="/admin/customers/{t.customer.id}"
					class="font-medium text-primary-700 hover:underline dark:text-primary-400"
				>
					{requester}
				</a>
				{#if t.customer.companyName}
					<p class="text-sm text-gray-600 dark:text-gray-300">{t.customer.companyName}</p>
				{/if}
				<p class="mt-1 text-sm text-gray-600 dark:text-gray-300">{t.customer.email}</p>
				{#if t.customer.phone}<p class="text-sm text-gray-600 dark:text-gray-300">
						{t.customer.phone}
					</p>{/if}
				<a
					href="/admin/customer-service?queue=all&customer={t.customer.id}"
					class="mt-3 inline-block text-sm text-primary-700 hover:underline dark:text-primary-400"
				>
					Toutes ses conversations
				</a>
			{:else}
				<p class="font-medium text-gray-900 dark:text-white">{requester}</p>
				{#if t.guestEmail}<p class="text-sm text-gray-600 dark:text-gray-300">
						{t.guestEmail}
					</p>{/if}
				<p class="mt-1 text-xs text-gray-500">Sans compte client.</p>
			{/if}
		</Card>

		{#if t.order}
			<Card class="max-w-none p-6">
				<h2 class="mb-3 text-base font-semibold text-gray-900 dark:text-white">Commande</h2>
				<a
					href="/admin/orders/{t.order.id}"
					class="font-medium text-primary-700 hover:underline dark:text-primary-400"
				>
					{t.order.reference}
				</a>
				<p class="mt-1 text-sm text-gray-600 dark:text-gray-300">
					{dayFmt.format(new Date(t.order.createdAt))} · {formatPrice(Number(t.order.totalTtc))}
				</p>
				{#if t.order.stateLabel}
					<div class="mt-2">
						<StateBadge label={t.order.stateLabel} color={t.order.stateColor ?? '#6b7280'} />
					</div>
				{/if}
			</Card>
		{/if}
	</div>
</div>

<style>
	.message-body :global(p) {
		margin: 0 0 0.5rem;
	}
	.message-body :global(p:last-child) {
		margin-bottom: 0;
	}
	.message-body :global(a) {
		text-decoration: underline;
	}
</style>
