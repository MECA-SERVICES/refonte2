<script lang="ts">
	import {
		Badge,
		Button,
		Card,
		Input,
		Table,
		TableBody,
		TableBodyCell,
		TableBodyRow,
		TableHead,
		TableHeadCell
	} from 'flowbite-svelte';
	import { PlusOutline, SearchOutline } from 'flowbite-svelte-icons';
	import PageHeader from '$lib/components/admin/PageHeader.svelte';
	import Pagination from '$lib/components/admin/Pagination.svelte';
	import {
		repairStatuses,
		REPAIR_STATUS_COLORS,
		REPAIR_STATUS_LABELS,
		REPAIR_TYPE_LABELS,
		REPAIRS_PER_PAGE
	} from '$lib/repairs';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const eur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
	const date = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short' });

	/** Onglets de la file : « Tous » puis un par état du cycle de vie. */
	const tabs = $derived([
		{ value: 'all', label: 'Tous', count: Object.values(data.counts).reduce((a, b) => a + b, 0) },
		...repairStatuses.map((s) => ({
			value: s,
			label: REPAIR_STATUS_LABELS[s],
			count: data.counts[s] ?? 0
		}))
	]);

	/** Assemble une adresse à partir des seuls paramètres renseignés. */
	function query(params: Record<string, string | undefined>) {
		const parts = Object.entries(params)
			.filter(([, v]) => v)
			.map(([k, v]) => `${k}=${encodeURIComponent(v as string)}`);
		return parts.length > 0 ? `?${parts.join('&')}` : '?';
	}

	/** Lien de page, filtres courants conservés. */
	const pageHref = (page: number) =>
		query({
			etat: data.status !== 'all' ? data.status : undefined,
			q: data.search || undefined,
			page: page > 1 ? String(page) : undefined
		});

	const tabHref = (value: string) =>
		query({
			etat: value !== 'all' ? value : undefined,
			q: data.search || undefined
		});
</script>

<PageHeader title="Ordres de réparation" subtitle="File des travaux de l'atelier">
	{#snippet actions()}
		<Button href="/admin/repairs/new" size="sm">
			<PlusOutline class="me-2 h-4 w-4" /> Nouvel ordre
		</Button>
	{/snippet}
</PageHeader>

<div class="mb-4 flex flex-wrap gap-2">
	{#each tabs as tab (tab.value)}
		<a
			href={tabHref(tab.value)}
			class="rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors {data.status ===
			tab.value
				? 'border-primary-600 bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
				: 'border-gray-200 text-gray-600 hover:border-gray-300 dark:border-gray-700 dark:text-gray-300'}"
		>
			{tab.label}
			<span class="ms-1 text-xs text-gray-400">{tab.count}</span>
		</a>
	{/each}
</div>

<Card class="max-w-none p-4">
	<form method="GET" class="mb-4 flex gap-2">
		{#if data.status !== 'all'}
			<input type="hidden" name="etat" value={data.status} />
		{/if}
		<Input
			name="q"
			value={data.search}
			placeholder="Référence, client, marque, modèle ou numéro de série"
			class="flex-1"
		/>
		<Button type="submit" size="sm" color="alternative">
			<SearchOutline class="h-4 w-4" />
		</Button>
	</form>

	{#if data.rows.length === 0}
		<p class="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
			{data.search ? 'Aucun ordre ne correspond à cette recherche.' : 'Aucun ordre de réparation.'}
		</p>
	{:else}
		<Table hoverable>
			<TableHead>
				<TableHeadCell>Référence</TableHeadCell>
				<TableHeadCell>Client</TableHeadCell>
				<TableHeadCell>Machine</TableHeadCell>
				<TableHeadCell>Prise en charge</TableHeadCell>
				<TableHeadCell>État</TableHeadCell>
				<TableHeadCell class="text-right">Total TTC</TableHeadCell>
				<TableHeadCell>Reçu le</TableHeadCell>
			</TableHead>
			<TableBody>
				{#each data.rows as row (row.id)}
					<TableBodyRow>
						<TableBodyCell>
							<a
								href="/admin/repairs/{row.id}"
								class="font-medium text-primary-700 hover:underline dark:text-primary-400"
							>
								{row.reference}
							</a>
						</TableBodyCell>
						<TableBodyCell>
							{[row.customerFirstName, row.customerLastName].filter(Boolean).join(' ') || '—'}
						</TableBodyCell>
						<TableBodyCell>
							{[row.machineBrand, row.machineModel].filter(Boolean).join(' ') || '—'}
						</TableBodyCell>
						<TableBodyCell>{REPAIR_TYPE_LABELS[row.orderType]}</TableBodyCell>
						<TableBodyCell>
							<Badge color={REPAIR_STATUS_COLORS[row.status]}>
								{REPAIR_STATUS_LABELS[row.status]}
							</Badge>
						</TableBodyCell>
						<TableBodyCell class="text-right">{eur.format(Number(row.totalTtc))}</TableBodyCell>
						<TableBodyCell>{date.format(new Date(row.createdAt))}</TableBodyCell>
					</TableBodyRow>
				{/each}
			</TableBody>
		</Table>

		<Pagination
			page={data.page}
			pageCount={Math.max(1, Math.ceil(data.total / REPAIRS_PER_PAGE))}
			total={data.total}
			hrefFor={pageHref}
		/>
	{/if}
</Card>
