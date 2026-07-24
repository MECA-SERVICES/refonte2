<script lang="ts">
	import { Button } from 'flowbite-svelte';
	import { TrashBinOutline } from 'flowbite-svelte-icons';
	import { PageHeader, TaxRuleForm, ConfirmDialog } from '$lib/components/admin';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const t = $derived(data.taxRule);
	let confirmOpen = $state(false);
	let deleteForm = $state<HTMLFormElement | null>(null);
</script>

<svelte:head><title>{t.name} · Taux de TVA</title></svelte:head>

<PageHeader
	title={t.name}
	crumbs={[
		{ label: 'Accueil', href: '/admin' },
		{ label: 'Taux de TVA', href: '/admin/taxes' },
		{ label: t.name }
	]}
>
	{#snippet actions()}
		<Button color="red" onclick={() => (confirmOpen = true)}>
			<TrashBinOutline class="me-2 h-4 w-4" /> Supprimer
		</Button>
	{/snippet}
</PageHeader>

<TaxRuleForm taxRule={t} action="?/update" message={form?.message} submitLabel="Enregistrer" />

<form method="POST" action="?/delete" bind:this={deleteForm} class="hidden"></form>

<ConfirmDialog
	bind:open={confirmOpen}
	title="Supprimer le taux de TVA"
	message="Les produits utilisant ce taux perdront leur TVA (repasseront sans taux)."
	confirmLabel="Supprimer"
	onconfirm={() => deleteForm?.requestSubmit()}
/>
