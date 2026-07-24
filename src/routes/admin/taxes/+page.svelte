<script lang="ts">
	import { Button, Badge } from 'flowbite-svelte';
	import { PlusOutline } from 'flowbite-svelte-icons';
	import { PageHeader, DataTable, ActiveBadge } from '$lib/components/admin';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	type TaxRow = (typeof data.rows)[number];
</script>

<svelte:head><title>Taux de TVA · Administration</title></svelte:head>

<PageHeader
	title="Taux de TVA"
	subtitle="{data.rows.length} taux configuré{data.rows.length > 1 ? 's' : ''}"
	crumbs={[{ label: 'Accueil', href: '/admin' }, { label: 'Taux de TVA' }]}
>
	{#snippet actions()}
		<Button href="/admin/taxes/new">
			<PlusOutline class="me-2 h-4 w-4" /> Nouveau taux
		</Button>
	{/snippet}
</PageHeader>

{#snippet nameCell(row: TaxRow)}
	<span class="font-medium text-gray-900 dark:text-white">{row.name}</span>
	{#if row.isDefault}
		<Badge color="blue" rounded class="ms-2">Par défaut</Badge>
	{/if}
{/snippet}

{#snippet rateCell(row: TaxRow)}
	{Number(row.rate)} %
{/snippet}

{#snippet activeCell(row: TaxRow)}
	<ActiveBadge active={row.isActive} />
{/snippet}

<DataTable
	rows={data.rows}
	columns={[
		{ key: 'name', label: 'Libellé', cell: nameCell },
		{ key: 'rate', label: 'Taux', cell: rateCell },
		{ key: 'active', label: 'Statut', cell: activeCell }
	]}
	emptyMessage="Aucun taux de TVA. Créez-en un pour l'appliquer aux produits."
	rowHref={(row) => `/admin/taxes/${row.id}`}
/>
