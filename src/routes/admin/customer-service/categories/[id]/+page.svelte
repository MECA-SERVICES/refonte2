<script lang="ts">
	import { enhance } from '$lib/components/admin/feedback.svelte';
	import { Button, Card, Checkbox, Input, Label, Select } from 'flowbite-svelte';
	import { TrashBinOutline } from 'flowbite-svelte-icons';
	import { ConfirmDialog, PageHeader } from '$lib/components/admin';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const c = $derived(data.category);
	let confirmOpen = $state(false);
	let deleteForm = $state<HTMLFormElement | null>(null);
</script>

<svelte:head><title>{c.label} · Catégories de messages</title></svelte:head>

<PageHeader
	title={c.label}
	crumbs={[
		{ label: 'Accueil', href: '/admin' },
		{ label: 'Service client', href: '/admin/customer-service' },
		{ label: 'Catégories', href: '/admin/customer-service/categories' },
		{ label: c.label }
	]}
>
	{#snippet actions()}
		<Button color="red" onclick={() => (confirmOpen = true)}>
			<TrashBinOutline class="me-2 h-4 w-4" /> Supprimer
		</Button>
	{/snippet}
</PageHeader>

<Card class="max-w-xl p-6">
	{#if form?.message}
		<p
			class="mb-4 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
		>
			{form.message}
		</p>
	{/if}
	<form
		method="POST"
		action="?/update"
		use:enhance={() =>
			({ update }) =>
				update({ reset: false })}
		class="space-y-4"
	>
		<div>
			<Label for="label" class="mb-1.5">Libellé</Label>
			<Input id="label" name="label" value={c.label} required />
		</div>
		<div>
			<Label for="code" class="mb-1.5">Code</Label>
			<Input id="code" name="code" value={c.code} />
		</div>
		<div>
			<Label for="position" class="mb-1.5">Ordre</Label>
			<Input id="position" name="position" type="number" value={c.position} />
		</div>
		<div>
			<Label for="defaultAssigneeUserId" class="mb-1.5">Responsable</Label>
			<Select
				id="defaultAssigneeUserId"
				name="defaultAssigneeUserId"
				value={c.defaultAssigneeUserId ?? ''}
				items={[
					{ value: '', name: 'Personne (à assigner à la main)' },
					...data.staff.map((u) => ({ value: u.id, name: u.name }))
				]}
				placeholder=""
			/>
			<p class="mt-1 text-xs text-gray-500">
				Les nouvelles demandes des clients dans cette catégorie lui sont assignées d'office.
			</p>
		</div>
		<Checkbox name="isActive" checked={c.isActive}>Active</Checkbox>
		<p class="text-xs text-gray-500">
			Une catégorie inactive n'est plus proposée, mais reste affichée sur les conversations qui la
			portent.
		</p>
		<Button type="submit" color="primary">Enregistrer</Button>
	</form>
</Card>

<form
	method="POST"
	action="?/delete"
	bind:this={deleteForm}
	use:enhance
	data-success="Suppression effectuée."
	class="hidden"
></form>

<ConfirmDialog
	bind:open={confirmOpen}
	title="Supprimer la catégorie"
	message="Impossible si des conversations l'utilisent : désactivez-la dans ce cas."
	confirmLabel="Supprimer"
	onconfirm={() => deleteForm?.requestSubmit()}
/>
