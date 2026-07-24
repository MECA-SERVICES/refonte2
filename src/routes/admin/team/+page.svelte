<script lang="ts">
	import { Button, Select, Badge } from 'flowbite-svelte';
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { PageHeader, DataTable, StatusBadge, ROLE_BADGES } from '$lib/components/admin';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	type StaffUser = (typeof data.users)[number];

	let search = $derived(data.search);

	const roleOptions = [
		{ value: 'customer', name: 'Client' },
		{ value: 'admin', name: 'Administrateur' }
	];

	function runSearch(value: string) {
		const params = new URLSearchParams();
		if (value) params.set('q', value);
		goto(`/admin/team?${params.toString()}`);
	}
</script>

<svelte:head><title>Équipe · Administration</title></svelte:head>

<PageHeader
	title="Équipe"
	subtitle="Gérez les rôles des comptes et l'accès au back-office"
	crumbs={[{ label: 'Accueil', href: '/admin' }, { label: 'Équipe' }]}
/>

{#snippet userCell(u: StaffUser)}
	<div>
		<span class="font-medium text-gray-900 dark:text-white">{u.name}</span>
		<span class="block text-sm text-gray-500 dark:text-gray-400">{u.email}</span>
	</div>
{/snippet}

{#snippet roleCell(u: StaffUser)}
	<div class="flex items-center gap-2">
		<StatusBadge value={u.role} map={ROLE_BADGES} />
		{#if u.banned}
			<Badge color="red" rounded>Banni</Badge>
		{/if}
	</div>
{/snippet}

{#snippet actionsCell(u: StaffUser)}
	<div class="flex items-center justify-end gap-2">
		<form method="POST" action="?/setRole" use:enhance class="flex items-center gap-1">
			<input type="hidden" name="userId" value={u.id} />
			<Select name="role" value={u.role} items={roleOptions} size="sm" class="w-40" />
			<Button type="submit" size="xs" color="alternative">Appliquer</Button>
		</form>
		<form method="POST" action="?/toggleBan" use:enhance>
			<input type="hidden" name="userId" value={u.id} />
			<input type="hidden" name="banned" value={String(u.banned)} />
			<Button type="submit" size="xs" color={u.banned ? 'green' : 'red'}>
				{u.banned ? 'Débannir' : 'Bannir'}
			</Button>
		</form>
	</div>
{/snippet}

<DataTable
	rows={data.users}
	columns={[
		{ key: 'user', label: 'Utilisateur', cell: userCell },
		{ key: 'role', label: 'Rôle', cell: roleCell },
		{ key: 'actions', label: '', cell: actionsCell }
	]}
	bind:search
	onsearch={runSearch}
	searchPlaceholder="Email…"
	emptyMessage="Aucun utilisateur."
/>
