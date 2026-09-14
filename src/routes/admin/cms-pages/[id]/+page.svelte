<script lang="ts">
	import { Alert, Button } from 'flowbite-svelte';
	import { TrashBinOutline, EyeOutline } from 'flowbite-svelte-icons';
	import { PageHeader, CmsPageForm, ConfirmDialog } from '$lib/components/admin';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const page = $derived(data.page);

	let confirmOpen = $state(false);
	let deleteForm = $state<HTMLFormElement | null>(null);
</script>

<svelte:head><title>{page.title} · Pages</title></svelte:head>

<PageHeader
	title={page.title}
	crumbs={[
		{ label: 'Accueil', href: '/admin' },
		{ label: 'Pages', href: '/admin/cms-pages' },
		{ label: page.title }
	]}
>
	{#snippet actions()}
		{#if page.isPublished}
			<Button color="alternative" href="/p/{page.slug}" target="_blank">
				<EyeOutline class="me-2 h-4 w-4" /> Voir la page
			</Button>
		{/if}
		<Button color="red" onclick={() => (confirmOpen = true)}>
			<TrashBinOutline class="me-2 h-4 w-4" /> Supprimer
		</Button>
	{/snippet}
</PageHeader>

{#if form?.saved}
	<Alert color="green" class="mb-4">Page enregistrée.</Alert>
{/if}

<CmsPageForm {page} message={form?.message} />

<form method="POST" action="?/delete" bind:this={deleteForm} class="hidden"></form>

<ConfirmDialog
	bind:open={confirmOpen}
	title="Supprimer la page"
	message="Cette action est irréversible. L'adresse publique ne répondra plus."
	confirmLabel="Supprimer"
	onconfirm={() => deleteForm?.requestSubmit()}
/>
