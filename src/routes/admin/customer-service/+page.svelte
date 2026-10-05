<script lang="ts">
	import {
		Badge,
		Button,
		Input,
		Select,
		Table,
		TableBody,
		TableBodyCell,
		TableBodyRow,
		TableHead,
		TableHeadCell
	} from 'flowbite-svelte';
	import { PlusOutline } from 'flowbite-svelte-icons';
	import { PageHeader, Pagination, StateBadge } from '$lib/components/admin';
	import {
		SUPPORT_PRIORITY_LABELS,
		SUPPORT_STATUS_COLORS,
		SUPPORT_STATUS_LABELS
	} from '$lib/support';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const queues = [
		{ key: 'todo', label: 'À traiter' },
		{ key: 'waiting', label: 'En attente du client' },
		{ key: 'closed', label: 'Clôturées' },
		{ key: 'all', label: 'Toutes' }
	] as const;

	const dateFmt = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' });

	/** Critères conservés d'un onglet à l'autre et dans la pagination. */
	const criteria = $derived(
		[
			['q', data.search],
			['category', data.categoryId],
			['priority', data.priority],
			['assigned', data.assigned],
			['customer', data.customerId],
			['order', data.orderId]
		].filter(([, v]) => v) as [string, string][]
	);

	function href(extra: [string, string | number][]) {
		const pairs = [...criteria, ...extra].map(
			([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`
		);
		return `/admin/customer-service${pairs.length ? `?${pairs.join('&')}` : ''}`;
	}

	const pageHref = (p: number) =>
		href([
			['queue', data.queue],
			['page', p]
		]);

	const hasFilter = $derived(criteria.length > 0);

	const priorityColor = { low: 'gray', normal: 'blue', high: 'yellow', urgent: 'red' } as const;
</script>

<svelte:head><title>Service client · Administration</title></svelte:head>

<PageHeader
	title="Service client"
	subtitle="{data.total} conversation{data.total > 1 ? 's' : ''}"
	crumbs={[{ label: 'Accueil', href: '/admin' }, { label: 'Service client' }]}
>
	{#snippet actions()}
		<Button href="/admin/customer-service/categories" color="alternative">Catégories</Button>
		<Button href="/admin/customer-service/new">
			<PlusOutline class="me-2 h-4 w-4" /> Nouvelle conversation
		</Button>
	{/snippet}
</PageHeader>

<!-- ================= Recherche et filtres ================= -->
<form method="GET" action="/admin/customer-service" class="mb-4 flex flex-wrap gap-2">
	<input type="hidden" name="queue" value={data.queue} />
	{#if data.customerId}<input type="hidden" name="customer" value={data.customerId} />{/if}
	{#if data.orderId}<input type="hidden" name="order" value={data.orderId} />{/if}
	<div class="min-w-64 flex-1">
		<Input
			name="q"
			value={data.search}
			placeholder="Référence, objet, client, e-mail, n° de commande…"
			aria-label="Rechercher une conversation"
		/>
	</div>
	<Select
		name="category"
		value={data.categoryId}
		class="w-48"
		aria-label="Catégorie"
		items={[
			{ value: '', name: 'Toutes catégories' },
			...data.categories.map((c) => ({ value: String(c.id), name: c.label }))
		]}
	/>
	<Select
		name="priority"
		value={data.priority}
		class="w-40"
		aria-label="Priorité"
		items={[
			{ value: '', name: 'Toutes priorités' },
			...Object.entries(SUPPORT_PRIORITY_LABELS).map(([value, name]) => ({ value, name }))
		]}
	/>
	<Select
		name="assigned"
		value={data.assigned}
		class="w-48"
		aria-label="Assignation"
		items={[
			{ value: '', name: 'Toute l’équipe' },
			{ value: 'me', name: 'Assignées à moi' },
			{ value: 'none', name: 'Non assignées' },
			...data.staff.map((u) => ({ value: u.id, name: u.name }))
		]}
	/>
	<Button type="submit" color="primary">Filtrer</Button>
	{#if hasFilter}
		<Button color="alternative" href="/admin/customer-service?queue={data.queue}">
			Réinitialiser
		</Button>
	{/if}
</form>

<!-- ================= Onglets ================= -->
<nav class="mb-4 flex gap-1 overflow-x-auto border-b border-gray-200 dark:border-gray-700">
	{#each queues as q (q.key)}
		{@const current = data.queue === q.key}
		<a
			href={href([['queue', q.key]])}
			aria-current={current ? 'page' : undefined}
			class="-mb-px flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap {current
				? 'border-primary-600 text-primary-700 dark:text-primary-400'
				: 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'}"
		>
			{q.label}
			<span
				class="rounded-full border border-gray-300 px-1.5 text-xs text-gray-500 dark:border-gray-600"
			>
				{data.queueCounts[q.key]}
			</span>
		</a>
	{/each}
</nav>

<!-- ================= Liste ================= -->
{#if data.rows.length === 0}
	<p
		class="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800"
	>
		{hasFilter
			? 'Aucune conversation ne correspond à ces critères.'
			: 'Aucune conversation dans cet onglet.'}
	</p>
{:else}
	<Table hoverable class="text-sm">
		<TableHead>
			<TableHeadCell>Référence</TableHeadCell>
			<TableHeadCell>Objet</TableHeadCell>
			<TableHeadCell>Demandeur</TableHeadCell>
			<TableHeadCell>Commande</TableHeadCell>
			<TableHeadCell>État</TableHeadCell>
			<TableHeadCell>Priorité</TableHeadCell>
			<TableHeadCell>Assignée à</TableHeadCell>
			<TableHeadCell>Dernier message</TableHeadCell>
		</TableHead>
		<TableBody>
			{#each data.rows as row (row.id)}
				{@const unread = row.unreadByStaff > 0}
				<TableBodyRow class="cursor-pointer">
					<TableBodyCell class="whitespace-nowrap">
						<a
							href="/admin/customer-service/{row.id}"
							class="font-medium text-primary-700 hover:underline dark:text-primary-400"
						>
							{row.reference}
						</a>
					</TableBodyCell>
					<TableBodyCell class="max-w-sm">
						<a href="/admin/customer-service/{row.id}" class="block">
							<span
								class="flex items-center gap-2 {unread
									? 'font-semibold text-gray-900 dark:text-white'
									: 'text-gray-700 dark:text-gray-300'}"
							>
								{#if unread}
									<span class="h-2 w-2 shrink-0 rounded-full bg-red-600" aria-label="Non lu"></span>
								{/if}
								<span class="truncate">{row.subject}</span>
							</span>
							{#if row.categoryLabel}
								<span class="text-xs text-gray-500">{row.categoryLabel}</span>
							{/if}
						</a>
					</TableBodyCell>
					<TableBodyCell>
						{#if row.customerId}
							{row.customerFirstName}
							{row.customerLastName}
							<span class="block text-xs text-gray-500">{row.customerEmail}</span>
						{:else}
							{row.guestName ?? ''}
							<span class="block text-xs text-gray-500">{row.guestEmail ?? '—'}</span>
						{/if}
					</TableBodyCell>
					<TableBodyCell class="whitespace-nowrap">{row.orderReference ?? '—'}</TableBodyCell>
					<TableBodyCell>
						<StateBadge
							label={SUPPORT_STATUS_LABELS[row.status]}
							color={SUPPORT_STATUS_COLORS[row.status]}
						/>
					</TableBodyCell>
					<TableBodyCell>
						<Badge color={priorityColor[row.priority]}
							>{SUPPORT_PRIORITY_LABELS[row.priority]}</Badge
						>
					</TableBodyCell>
					<TableBodyCell class="whitespace-nowrap">{row.assignedName ?? '—'}</TableBodyCell>
					<TableBodyCell class="whitespace-nowrap tabular-nums">
						{dateFmt.format(new Date(row.lastMessageAt))}
					</TableBodyCell>
				</TableBodyRow>
			{/each}
		</TableBody>
	</Table>

	<Pagination page={data.page} pageCount={data.pageCount} total={data.total} hrefFor={pageHref} />
{/if}
