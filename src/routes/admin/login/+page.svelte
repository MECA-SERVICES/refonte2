<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { Card, Label, Input, Button, Alert, Heading } from 'flowbite-svelte';
	import { LockSolid } from 'flowbite-svelte-icons';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();

	const redirectTo = $derived(page.url.searchParams.get('redirectTo') ?? '');
</script>

<svelte:head><title>Connexion · Administration</title></svelte:head>

<div class="flex min-h-screen items-center justify-center bg-gray-100 px-4 dark:bg-gray-900">
	<Card class="w-full max-w-md p-6">
		<div class="mb-6 flex flex-col items-center">
			<div class="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-cyan-600">
				<LockSolid class="h-6 w-6 text-white" />
			</div>
			<Heading tag="h1" class="text-xl font-bold text-gray-900 dark:text-white">
				Administration
			</Heading>
			<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Connectez-vous pour continuer</p>
		</div>

		{#if form?.message}
			<Alert color="red" class="mb-4">{form.message}</Alert>
		{/if}

		<form method="POST" use:enhance class="space-y-4">
			<input type="hidden" name="redirectTo" value={redirectTo} />
			<div>
				<Label for="email" class="mb-2">Email</Label>
				<Input
					id="email"
					name="email"
					type="email"
					required
					value={form?.email ?? ''}
					placeholder="admin@msshop.com"
				/>
			</div>
			<div>
				<Label for="password" class="mb-2">Mot de passe</Label>
				<Input id="password" name="password" type="password" required placeholder="••••••••" />
			</div>
			<Button type="submit" class="w-full">Se connecter</Button>
		</form>
	</Card>
</div>
