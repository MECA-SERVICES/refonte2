<script lang="ts">
	import { Button } from 'flowbite-svelte';
	import { UserAddOutline } from 'flowbite-svelte-icons';
	import {
		PageHeader,
		FilterableTable,
		Pagination,
		StatusBadge,
		CUSTOMER_TYPE_BADGES,
		CUSTOMER_STATUS_BADGES,
		listPageHref
	} from '$lib/components/admin';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	type CustomerRow = (typeof data.rows)[number];

	/**
	 * Valeurs proposées au filtre.
	 *
	 * Les libellés anglais proviennent de la reprise PrestaShop : filtrer sur
	 * « particulier » ne renverrait aujourd'hui qu'une seule fiche, la base
	 * portant « individual » sur les 24 744 autres.
	 */
	const typeFilterOptions = [
		{ value: 'individual', name: 'Particulier' },
		{ value: 'professional', name: 'Professionnel' },
		{ value: 'collectivite', name: 'Collectivité' }
	];

	const statusFilterOptions = [
		{ value: 'pending', name: 'En attente' },
		{ value: 'active', name: 'Validé' },
		{ value: 'inactive', name: 'Inactif' },
		{ value: 'rejected', name: 'Rejeté' }
	];

	const tableParams = $derived({ filters: data.filters, sort: data.sort, dir: data.dir });

	const eur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });

	/** Conserve les filtres/tri courants dans les liens de pagination. */
	function pageHref(p: number) {
		return listPageHref(
			'/admin/customers',
			{ filters: data.filters, sort: data.sort, dir: data.dir },
			p
		);
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

{#snippet idCell(row: CustomerRow)}
	<span class="text-gray-500">{row.id}</span>
{/snippet}

{#snippet nameCell(row: CustomerRow)}
	<!-- L'avatar à initiales donne un point d'accroche visuel dans une liste de
	     25 000 lignes, là où une colonne de texte seule se parcourt mal. -->
	<span class="flex items-center gap-2.5">
		<span
			class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-100 text-[11px] font-bold text-primary-700 dark:bg-primary-900 dark:text-primary-200"
			aria-hidden="true"
		>
			{`${row.firstName?.[0] ?? ''}${row.lastName?.[0] ?? ''}`.toUpperCase() || '?'}
		</span>
		<span class="font-medium text-gray-900 dark:text-white">{row.firstName} {row.lastName}</span>
	</span>
{/snippet}

{#snippet emailCell(row: CustomerRow)}
	<span class="text-gray-600 dark:text-gray-300">{row.email}</span>
{/snippet}

{#snippet spentCell(row: CustomerRow)}
	<!-- PrestaShop affiche les ventes cumulées : c'est la colonne qui hiérarchise
	     les clients dans la liste. -->
	{#if Number(row.totalSpent) > 0}
		<span class="font-medium text-gray-900 dark:text-white">
			{eur.format(Number(row.totalSpent))}
		</span>
	{:else}
		<span class="text-gray-400">—</span>
	{/if}
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
		{ key: 'id', label: 'ID', cell: idCell },
		{ key: 'lastName', label: 'Nom', cell: nameCell, filterKey: 'lastName', sortKey: 'lastName' },
		{ key: 'email', label: 'Email', cell: emailCell, filterKey: 'email', sortKey: 'email' },
		{ key: 'phone', label: 'Téléphone', filterKey: 'phone' },
		{ key: 'company', label: 'Société', cell: companyCell, filterKey: 'companyName' },
		{
			key: 'type',
			label: 'Type',
			cell: typeCell,
			filterKey: 'type',
			filterOptions: typeFilterOptions,
			sortKey: 'type'
		},
		{ key: 'totalSpent', label: 'Ventes', cell: spentCell, sortKey: 'totalSpent' },
		{
			key: 'status',
			label: 'Statut',
			cell: statusCell,
			filterKey: 'status',
			filterOptions: statusFilterOptions,
			sortKey: 'status'
		}
	]}
	emptyMessage="Aucun client trouvé."
	rowHref={(row) => `/admin/customers/${row.id}`}
/>

<Pagination page={data.page} pageCount={data.pageCount} total={data.total} hrefFor={pageHref} />
