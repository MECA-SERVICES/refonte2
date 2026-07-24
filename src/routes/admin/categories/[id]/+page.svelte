<script lang="ts">
	import { Button } from 'flowbite-svelte';
	import { TrashBinOutline } from 'flowbite-svelte-icons';
	import { PageHeader, CategoryForm, ConfirmDialog } from '$lib/components/admin';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const c = $derived(data.category);
	let confirmOpen = $state(false);
	let deleteForm = $state<HTMLFormElement | null>(null);
</script>

<svelte:head><title>{c.name} · Catégories</title></svelte:head>

<PageHeader
	title={c.name}
	crumbs={[
		{ label: 'Accueil', href: '/admin' },
		{ label: 'Catégories', href: '/admin/categories' },
		{ label: c.name }
	]}
>
	{#snippet actions()}
		<Button color="red" onclick={() => (confirmOpen = true)}>
			<TrashBinOutline class="me-2 h-4 w-4" /> Supprimer
		</Button>
	{/snippet}
</PageHeader>

<CategoryForm
	category={c}
	parentOptions={data.parentOptions}
	action="?/update"
	message={form?.message}
	submitLabel="Enregistrer"
/>

<form method="POST" action="?/delete" bind:this={deleteForm} class="hidden"></form>

<ConfirmDialog
	bind:open={confirmOpen}
	title="Supprimer la catégorie"
	message="Les sous-catégories deviendront des racines et les produits perdront cette catégorie."
	confirmLabel="Supprimer"
	onconfirm={() => deleteForm?.requestSubmit()}
/>
