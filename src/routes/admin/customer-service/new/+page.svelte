<script lang="ts">
	import { Button, Card, Input, Label, Select, Textarea } from 'flowbite-svelte';
	import { PageHeader } from '$lib/components/admin';
	import { SUPPORT_PRIORITY_LABELS } from '$lib/support';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	/** Saisie précédente après une erreur, sinon le préremplissage. */
	const v = $derived(
		form?.values ?? {
			email: data.email,
			orderReference: data.orderReference,
			subject: data.orderReference ? `Commande ${data.orderReference}` : '',
			categoryId: '',
			priority: 'normal',
			content: ''
		}
	);
</script>

<svelte:head><title>Nouvelle conversation · Service client</title></svelte:head>

<PageHeader
	title="Nouvelle conversation"
	crumbs={[
		{ label: 'Accueil', href: '/admin' },
		{ label: 'Service client', href: '/admin/customer-service' },
		{ label: 'Nouvelle conversation' }
	]}
/>

<Card class="max-w-3xl p-6">
	{#if form?.message}
		<p
			class="mb-4 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
		>
			{form.message}
		</p>
	{/if}

	<form method="POST" class="space-y-4">
		<div class="grid gap-4 sm:grid-cols-2">
			<div>
				<Label for="email" class="mb-1.5">E-mail du client</Label>
				<Input id="email" name="email" type="email" value={v.email} required />
			</div>
			<div>
				<Label for="orderReference" class="mb-1.5">Commande (facultatif)</Label>
				<Input
					id="orderReference"
					name="orderReference"
					value={v.orderReference}
					placeholder="Référence"
				/>
			</div>
		</div>

		<div>
			<Label for="subject" class="mb-1.5">Objet</Label>
			<Input id="subject" name="subject" value={v.subject} required />
		</div>

		<div class="grid gap-4 sm:grid-cols-2">
			<div>
				<Label for="categoryId" class="mb-1.5">Catégorie</Label>
				<Select
					id="categoryId"
					name="categoryId"
					value={v.categoryId}
					items={[
						{ value: '', name: 'Aucune' },
						...data.categories.map((c) => ({ value: String(c.id), name: c.label }))
					]}
				/>
			</div>
			<div>
				<Label for="priority" class="mb-1.5">Priorité</Label>
				<Select
					id="priority"
					name="priority"
					value={v.priority}
					items={Object.entries(SUPPORT_PRIORITY_LABELS).map(([value, name]) => ({ value, name }))}
				/>
			</div>
		</div>

		<div>
			<Label for="content" class="mb-1.5">Message</Label>
			<Textarea id="content" name="content" rows={8} class="w-full" value={v.content} required />
		</div>

		<div class="flex gap-2">
			<Button type="submit" color="primary">Envoyer au client</Button>
			<Button href="/admin/customer-service" color="alternative">Annuler</Button>
		</div>
	</form>
</Card>
