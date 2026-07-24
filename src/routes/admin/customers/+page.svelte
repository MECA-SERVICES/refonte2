<script lang="ts">
	import { Button } from 'flowbite-svelte';
	import { UserAddOutline } from 'flowbite-svelte-icons';
	import {
		PageHeader,
		DataTable,
		Pagination,
		StatusBadge,
		CUSTOMER_TYPE_BADGES,
		CUSTOMER_STATUS_BADGES
	} from '$lib/components/admin';
	import { goto } from '$app/navigation';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	type CustomerRow = (typeof data.rows)[number];

	// $derived réinscriptible : suit data.search mais reste éditable dans le champ.
	let search = $derived(data.search);

	function runSearch(value: string) {
		const params = new URLSearchParams();
		if (value) params.set('q', value);
		goto(`/admin/customers?${params.toString()}`);
	}

	function pageHref(p: number) {
		const params = new URLSearchParams();
		if (data.search) params.set('q', data.search);
		params.set('page', String(p));
		return `/admin/customers?${params.toString()}`;
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

<DataTable
	rows={data.rows}
	columns={[
		{ key: 'name', label: 'Nom', cell: nameCell },
		{ key: 'email', label: 'Email' },
		{ key: 'type', label: 'Type', cell: typeCell },
		{ key: 'status', label: 'Statut', cell: statusCell },
		{ key: 'company', label: 'Société', cell: companyCell }
	]}
	bind:search
	onsearch={runSearch}
	searchPlaceholder="Nom, email, société…"
	emptyMessage="Aucun client trouvé."
	rowHref={(row) => `/admin/customers/${row.id}`}
/>

<Pagination page={data.page} pageCount={data.pageCount} total={data.total} hrefFor={pageHref} />
