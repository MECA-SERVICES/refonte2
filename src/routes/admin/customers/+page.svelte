<script lang="ts">
	import { Button } from 'flowbite-svelte';
	import { UserAddOutline } from 'flowbite-svelte-icons';
	import {
		PageHeader,
		FilterableTable,
		Pagination,
		StatusBadge,
		CUSTOMER_TYPE_BADGES,
		CUSTOMER_STATUS_BADGES
	} from '$lib/components/admin';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	type CustomerRow = (typeof data.rows)[number];

	const typeFilterOptions = [
		{ value: 'particulier', name: 'Particulier' },
		{ value: 'entreprise', name: 'Entreprise' },
		{ value: 'collectivite', name: 'Collectivité' }
	];

	const statusFilterOptions = [
		{ value: 'pending', name: 'En attente' },
		{ value: 'validated', name: 'Validé' },
		{ value: 'rejected', name: 'Rejeté' }
	];

	const tableParams = $derived({ filters: data.filters, sort: data.sort, dir: data.dir });

	/** Conserve les filtres/tri courants dans les liens de pagination. */
	function pageHref(p: number) {
		const search = new URLSearchParams();
		for (const [key, value] of Object.entries(data.filters)) {
			if (value) search.set(`f_${key}`, value);
		}
		if (data.sort) {
			search.set('sort', data.sort);
			search.set('dir', data.dir);
		}
		search.set('page', String(p));
		return `/admin/customers?${search.toString()}`;
	}
</script>

<svelte:head><title>Clients · Administration</title></svelte:head>

<PageHeader
	title="Clients"
	subtitle="{data.total} client{data.total > 1 ? 's' : ''}"
	crumbs={[{ label: 'Accueil', href: '/admin' }, { label: 'Clients' }]}
>
	{#snippet actions()}
		<Button href="/admin/customers/new">
			<UserAddOutline class="me-2 h-4 w-4" /> Nouveau client
		</Button>
	{/snippet}
</PageHeader>

{#snippet nameCell(row: CustomerRow)}
	<span class="font-medium text-gray-900 dark:text-white">{row.firstName} {row.lastName}</span>
{/snippet}

{#snippet typeCell(row: CustomerRow)}
	<StatusBadge value={row.type} map={CUSTOMER_TYPE_BADGES} />
{/snippet}

{#snippet statusCell(row: CustomerRow)}
	<StatusBadge value={row.status} map={CUSTOMER_STATUS_BADGES} />
{/snippet}

{#snippet companyCell(row: CustomerRow)}
	{row.companyName ?? '—'}
{/snippet}

<FilterableTable
	rows={data.rows}
	basePath="/admin/customers"
	params={tableParams}
	columns={[
		{ key: 'lastName', label: 'Nom', cell: nameCell, filterKey: 'lastName', sortKey: 'lastName' },
		{ key: 'email', label: 'Email', filterKey: 'email', sortKey: 'email' },
		{ key: 'phone', label: 'Téléphone', filterKey: 'phone' },
		{
			key: 'type',
			label: 'Type',
			cell: typeCell,
			filterKey: 'type',
			filterOptions: typeFilterOptions,
			sortKey: 'type'
		},
		{
			key: 'status',
			label: 'Statut',
			cell: statusCell,
			filterKey: 'status',
			filterOptions: statusFilterOptions,
			sortKey: 'status'
		},
		{ key: 'company', label: 'Société', cell: companyCell, filterKey: 'companyName' }
	]}
	emptyMessage="Aucun client trouvé."
	rowHref={(row) => `/admin/customers/${row.id}`}
/>

<Pagination page={data.page} pageCount={data.pageCount} total={data.total} hrefFor={pageHref} />
