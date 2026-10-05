<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button, Card, Checkbox, Input, Label } from 'flowbite-svelte';
	import { ActiveBadge, DataTable, PageHeader } from '$lib/components/admin';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	type Row = (typeof data.rows)[number];

	/** Position proposée : à la suite de la dernière catégorie. */
	const nextPosition = $derived(Math.max(0, ...data.rows.map((r) => r.position)) + 10);
</script>

<svelte:head><title>Catégories de messages · Service client</title></svelte:head>

<PageHeader
	title="Catégories de messages"
	subtitle="{data.rows.length} catégorie{data.rows.length > 1 ? 's' : ''}"
	crumbs={[
		{ label: 'Accueil', href: '/admin' },
		{ label: 'Service client', href: '/admin/customer-service' },
		{ label: 'Catégories' }
	]}
/>

<div class="grid gap-6 lg:grid-cols-3">
	<div class="lg:col-span-2">
		{#snippet activeCell(row: Row)}<ActiveBadge active={row.isActive} />{/snippet}
		{#snippet usageCell(row: Row)}
			<span class="tabular-nums">{row.threadCount}</span>
		{/snippet}

		<DataTable
			rows={data.rows}
			columns={[
				{ key: 'label', label: 'Libellé' },
				{ key: 'code', label: 'Code' },
				{ key: 'position', label: 'Ordre' },
				{ key: 'usage', label: 'Conversations', cell: usageCell },
				{ key: 'active', label: 'État', cell: activeCell }
			]}
			emptyMessage="Aucune catégorie."
			rowHref={(row) => `/admin/customer-service/categories/${row.id}`}
		/>
	</div>

	<Card class="max-w-none p-6">
		<h2 class="mb-4 text-base font-semibold text-gray-900 dark:text-white">Nouvelle catégorie</h2>
		{#if form?.message}
			<p
				class="mb-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
			>
				{form.message}
			</p>
		{/if}
		<form method="POST" action="?/create" use:enhance class="space-y-3">
			<div>
				<Label for="label" class="mb-1.5">Libellé</Label>
				<Input id="label" name="label" required />
			</div>
			<div>
				<Label for="code" class="mb-1.5">Code (facultatif)</Label>
				<Input id="code" name="code" placeholder="Déduit du libellé" />
			</div>
			<div>
				<Label for="position" class="mb-1.5">Ordre</Label>
				<Input id="position" name="position" type="number" value={nextPosition} />
			</div>
			<Checkbox name="isActive" checked>Active</Checkbox>
			<Button type="submit" color="primary" class="w-full">Ajouter</Button>
		</form>
	</Card>
</div>
