<script lang="ts">
	import { Button, Badge } from 'flowbite-svelte';
	import { PlusOutline } from 'flowbite-svelte-icons';
	import { PageHeader, DataTable, StateBadge } from '$lib/components/admin';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	type StateRow = (typeof data.rows)[number];
</script>

<svelte:head><title>États de commande · Administration</title></svelte:head>

<PageHeader
	title="États de commande"
	subtitle="{data.rows.length} états"
	crumbs={[{ label: 'Accueil', href: '/admin' }, { label: 'États de commande' }]}
>
	{#snippet actions()}
		<Button href="/admin/order-states/new">
			<PlusOutline class="me-2 h-4 w-4" /> Nouvel état
		</Button>
	{/snippet}
</PageHeader>

{#snippet stateCell(row: StateRow)}
	<StateBadge label={row.label} color={row.color} />
{/snippet}

{#snippet flagsCell(row: StateRow)}
	<div class="flex flex-wrap gap-1">
		{#if row.isPaid}<Badge color="green">Payé</Badge>{/if}
		{#if row.isShipped}<Badge color="purple">Expédié</Badge>{/if}
		{#if row.isFinal}<Badge color="gray">Final</Badge>{/if}
		{#if row.sendEmailOnChange}<Badge color="blue">Email</Badge>{/if}
	</div>
{/snippet}

<DataTable
	rows={data.rows}
	columns={[
		{ key: 'state', label: 'État', cell: stateCell },
		{ key: 'code', label: 'Code' },
		{ key: 'position', label: 'Ordre' },
		{ key: 'flags', label: 'Propriétés', cell: flagsCell }
	]}
	emptyMessage="Aucun état."
	rowHref={(row) => `/admin/order-states/${row.id}`}
/>
