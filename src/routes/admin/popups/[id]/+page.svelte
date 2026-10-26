<script lang="ts">
	import { enhance } from '$lib/components/admin/feedback.svelte';
	import { Button } from 'flowbite-svelte';
	import { TrashBinOutline } from 'flowbite-svelte-icons';
	import { ConfirmDialog, PageHeader, PopupForm } from '$lib/components/admin';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let confirmOpen = $state(false);
	let deleteForm = $state<HTMLFormElement | null>(null);
</script>

<svelte:head><title>{data.popup.name} · Annonces</title></svelte:head>

<PageHeader
	title={data.popup.name}
	crumbs={[
		{ label: 'Accueil', href: '/admin' },
		{ label: 'Annonces', href: '/admin/popups' },
		{ label: data.popup.name }
	]}
>
	{#snippet actions()}
		<Button color="red" onclick={() => (confirmOpen = true)}>
			<TrashBinOutline class="me-2 h-4 w-4" /> Supprimer
		</Button>
	{/snippet}
</PageHeader>

<PopupForm popup={data.popup} message={form?.message} action="?/save" />

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
	title="Supprimer l'annonce"
	message="Cette annonce sera définitivement supprimée."
	confirmLabel="Supprimer"
	onconfirm={() => deleteForm?.requestSubmit()}
/>
