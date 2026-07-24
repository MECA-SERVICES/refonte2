<script lang="ts">
	import { Button } from 'flowbite-svelte';
	import { TrashBinOutline } from 'flowbite-svelte-icons';
	import { PageHeader, OrderStateForm, ConfirmDialog } from '$lib/components/admin';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const s = $derived(data.state);
	let confirmOpen = $state(false);
	let deleteForm = $state<HTMLFormElement | null>(null);
</script>

<svelte:head><title>{s.label} · États de commande</title></svelte:head>

<PageHeader
	title={s.label}
	crumbs={[
		{ label: 'Accueil', href: '/admin' },
		{ label: 'États de commande', href: '/admin/order-states' },
		{ label: s.label }
	]}
>
	{#snippet actions()}
		<Button color="red" onclick={() => (confirmOpen = true)}>
			<TrashBinOutline class="me-2 h-4 w-4" /> Supprimer
		</Button>
	{/snippet}
</PageHeader>

<OrderStateForm state={s} action="?/update" message={form?.message} submitLabel="Enregistrer" />

<form method="POST" action="?/delete" bind:this={deleteForm} class="hidden"></form>

<ConfirmDialog
	bind:open={confirmOpen}
	title="Supprimer l'état"
	message="Impossible si des commandes utilisent cet état. Supprimez-le uniquement s'il n'est plus référencé."
	confirmLabel="Supprimer"
	onconfirm={() => deleteForm?.requestSubmit()}
/>
