<script lang="ts">
	import { Button, Card, Input, Label, Select } from 'flowbite-svelte';
	import { enhance } from '$lib/components/admin/feedback.svelte';
	import { goto } from '$app/navigation';
	import type { SubmitFunction } from '@sveltejs/kit';
	import {
		PageHeader,
		DataTable,
		StatusBadge,
		ROLE_BADGES,
		listFilterHref,
		StateBadge
	} from '$lib/components/admin';
	import { ROLE_LABELS, staffRoles } from '$lib/roles';
	import type { PageProps } from './$types';

	/**
	 * Équipe : les comptes qui accèdent au back-office, employés et
	 * administrateurs (CDC 34). L'administrateur ajoute un membre, change son
	 * rôle, le désactive, ou définit son mot de passe provisoire qu'il lui
	 * transmet ; chacun le change ensuite dans « Mon compte ». Chercher un
	 * e-mail retrouve tous les comptes, pour donner l'accès à un compte existant.
	 */

	let { data }: PageProps = $props();

	type StaffUser = (typeof data.users)[number];

	let search = $derived(data.search);
	/** Membre dont le formulaire de mot de passe est ouvert. */
	let settingPassword = $state<string | null>(null);

	const roleOptions = staffRoles.map((r) => ({ value: r, name: ROLE_LABELS[r] }));

	function runSearch(value: string) {
		goto(listFilterHref('/admin/team', [['q', value]]));
	}

	const closeOnSuccess: SubmitFunction =
		() =>
		async ({ result, update }) => {
			await update();
			if (result.type === 'success') settingPassword = null;
		};
</script>

<svelte:head><title>Équipe · Administration</title></svelte:head>

<PageHeader
	title="Équipe"
	subtitle={data.search
		? 'Tous les comptes dont l’e-mail correspond'
		: 'Employés et administrateurs : les comptes qui accèdent au back-office'}
	crumbs={[{ label: 'Accueil', href: '/admin' }, { label: 'Équipe' }]}
/>

{#snippet userCell(u: StaffUser)}
	<div>
		<span class="font-medium text-gray-900">{u.name}</span>
		{#if u.isMe}<span class="text-xs text-gray-500"> (vous)</span>{/if}
		<span class="block text-sm text-gray-500">{u.email}</span>
	</div>
{/snippet}

{#snippet roleCell(u: StaffUser)}
	<div class="flex items-center gap-2">
		<StatusBadge value={u.role} map={ROLE_BADGES} />
		{#if u.banned}
			<StateBadge color="red" label="Désactivé" />
		{/if}
	</div>
{/snippet}

{#snippet actionsCell(u: StaffUser)}
	{@const isStaff = u.role !== 'customer'}
	<div class="flex flex-wrap items-center justify-end gap-2">
		{#if settingPassword === u.id}
			<form
				method="POST"
				action="?/setPassword"
				use:enhance={closeOnSuccess}
				data-success="Mot de passe défini : transmettez-le à {u.name}."
				class="flex items-center gap-1"
			>
				<input type="hidden" name="userId" value={u.id} />
				<Input
					name="password"
					type="password"
					autocomplete="new-password"
					minlength={8}
					required
					size="sm"
					placeholder="Mot de passe provisoire"
					aria-label="Mot de passe provisoire de {u.name}"
					class="w-48"
				/>
				<Button type="submit" size="xs">Définir</Button>
				<Button size="xs" color="alternative" onclick={() => (settingPassword = null)}>
					Annuler
				</Button>
			</form>
		{:else}
			{#if isStaff && !u.isMe}
				<Button size="xs" color="alternative" onclick={() => (settingPassword = u.id)}>
					Mot de passe
				</Button>
			{/if}
			{#if !u.isMe}
				<form
					method="POST"
					action="?/setRole"
					use:enhance
					data-success={isStaff ? 'Rôle mis à jour.' : 'Accès au back-office donné.'}
					class="flex items-center gap-1"
				>
					<input type="hidden" name="userId" value={u.id} />
					<Select
						name="role"
						aria-label="Rôle de {u.name}"
						placeholder=""
						value={isStaff ? u.role : 'employee'}
						items={roleOptions}
						size="sm"
						class="w-40"
					/>
					<Button type="submit" size="xs" color="alternative">
						{isStaff ? 'Appliquer' : 'Donner l’accès'}
					</Button>
				</form>
				{#if isStaff}
					<form method="POST" action="?/toggleBan" use:enhance data-success="Accès mis à jour.">
						<input type="hidden" name="userId" value={u.id} />
						<input type="hidden" name="banned" value={String(u.banned)} />
						<Button type="submit" size="xs" color={u.banned ? 'green' : 'red'}>
							{u.banned ? 'Réactiver' : 'Désactiver'}
						</Button>
					</form>
				{/if}
			{:else}
				<a href="/admin/account" class="text-sm text-primary-700 hover:underline">Mon compte</a>
			{/if}
		{/if}
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
	searchPlaceholder="E-mail…"
	emptyMessage="Aucun compte."
/>

<Card class="mt-6 max-w-none p-6">
	<h2 class="mb-1 text-lg font-semibold text-gray-900">Ajouter un membre</h2>
	<p class="mb-4 text-sm text-gray-500">
		Accès au back-office, avec un mot de passe provisoire à lui transmettre. Un employé n'a pas
		accès au paramétrage ni à l'équipe.
	</p>
	<form
		method="POST"
		action="?/addMember"
		use:enhance
		data-success="Membre ajouté."
		class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end"
	>
		<div>
			<Label for="member-name" class="mb-1">Nom</Label>
			<Input id="member-name" name="name" required />
		</div>
		<div>
			<Label for="member-email" class="mb-1">E-mail de connexion</Label>
			<Input id="member-email" name="email" type="email" required />
		</div>
		<div>
			<Label for="member-role" class="mb-1">Rôle</Label>
			<Select id="member-role" name="role" placeholder="" value="employee" items={roleOptions} />
		</div>
		<div>
			<Label for="member-password" class="mb-1">Mot de passe provisoire (8 car. min.)</Label>
			<Input
				id="member-password"
				name="password"
				type="password"
				autocomplete="new-password"
				minlength={8}
				required
			/>
		</div>
		<div class="lg:col-span-4">
			<Button type="submit">Ajouter</Button>
		</div>
	</form>
</Card>
