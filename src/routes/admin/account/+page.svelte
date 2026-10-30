<script lang="ts">
	import { Button, Card, Input, Label } from 'flowbite-svelte';
	import { enhance } from '$lib/components/admin/feedback.svelte';
	import { PageHeader } from '$lib/components/admin';
	import { ROLE_LABELS, type Role } from '$lib/roles';
	import type { PageProps } from './$types';

	/** Mon compte : identité, rôle, et changement du mot de passe. */

	let { data }: PageProps = $props();

	const me = $derived(data.adminUser);
</script>

<svelte:head><title>Mon compte · Administration</title></svelte:head>

<PageHeader
	title="Mon compte"
	crumbs={[{ label: 'Accueil', href: '/admin' }, { label: 'Mon compte' }]}
/>

<div class="grid gap-6 lg:grid-cols-2">
	<Card class="max-w-none p-6">
		<h2 class="mb-4 text-lg font-semibold text-gray-900">Identité</h2>
		<dl class="space-y-2 text-sm">
			<div>
				<dt class="text-gray-500">Nom</dt>
				<dd class="font-medium text-gray-900">{me?.name}</dd>
			</div>
			<div>
				<dt class="text-gray-500">E-mail de connexion</dt>
				<dd class="font-medium text-gray-900">{me?.email}</dd>
			</div>
			<div>
				<dt class="text-gray-500">Rôle</dt>
				<dd class="font-medium text-gray-900">{ROLE_LABELS[(me?.role ?? 'customer') as Role]}</dd>
			</div>
		</dl>
	</Card>

	<Card class="max-w-none p-6">
		<h2 class="mb-1 text-lg font-semibold text-gray-900">Mon mot de passe</h2>
		<p class="mb-4 text-sm text-gray-500">
			Remplacez le mot de passe provisoire reçu. Vos autres sessions seront déconnectées.
		</p>
		<form
			method="POST"
			action="?/changePassword"
			use:enhance
			data-success="Mot de passe changé."
			class="space-y-3"
		>
			<div>
				<Label for="current-password" class="mb-1">Mot de passe actuel</Label>
				<Input
					id="current-password"
					name="currentPassword"
					type="password"
					autocomplete="current-password"
					required
				/>
			</div>
			<div>
				<Label for="new-password" class="mb-1">Nouveau mot de passe (8 caractères au moins)</Label>
				<Input
					id="new-password"
					name="newPassword"
					type="password"
					autocomplete="new-password"
					minlength={8}
					required
				/>
			</div>
			<Button type="submit">Changer mon mot de passe</Button>
		</form>
	</Card>
</div>
