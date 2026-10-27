<script lang="ts">
	import { enhance } from '$lib/components/admin/feedback.svelte';
	import {
		Button,
		Card,
		Input,
		Table,
		TableBody,
		TableBodyCell,
		TableBodyRow,
		TableHead,
		TableHeadCell
	} from 'flowbite-svelte';
	import { ArrowDownOutline, ArrowUpOutline, TrashBinOutline } from 'flowbite-svelte-icons';
	import PageHeader from '$lib/components/admin/PageHeader.svelte';
	import StateBadge from '$lib/components/admin/StateBadge.svelte';
	import type { SubmitFunction } from '@sveltejs/kit';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	/** Le champ garde le nom enregistré, sans revenir à la valeur du chargement. */
	const keepValues: SubmitFunction =
		() =>
		({ update }) =>
			update({ reset: false });

	function usage(t: (typeof data.types)[number]) {
		const parts = [];
		if (t.machines > 0) parts.push(`${t.machines} machine${t.machines > 1 ? 's' : ''} client`);
		if (t.repairs > 0) parts.push(`${t.repairs} ordre${t.repairs > 1 ? 's' : ''} de réparation`);
		return parts.length > 0 ? parts.join(' · ') : 'Inutilisé';
	}
</script>

<svelte:head><title>Types de matériel · Administration</title></svelte:head>

<PageHeader
	title="Types de matériel"
	subtitle="Proposés au parc machines des clients et aux ordres de réparation"
/>

<Card class="mb-6 max-w-none p-4">
	<form method="POST" action="?/create" use:enhance data-success="Type ajouté." class="flex gap-2">
		<Input
			name="name"
			aria-label="Nouveau type de matériel"
			placeholder="Nouveau type, ex. Scarificateur"
			required
			class="flex-1"
		/>
		<Button type="submit" size="sm">Ajouter</Button>
	</form>
</Card>

<Card class="max-w-none p-4">
	<Table>
		<TableHead>
			<TableHeadCell class="w-20">Ordre</TableHeadCell>
			<TableHeadCell>Nom</TableHeadCell>
			<TableHeadCell>Utilisation</TableHeadCell>
			<TableHeadCell>État</TableHeadCell>
			<TableHeadCell><span class="sr-only">Actions</span></TableHeadCell>
		</TableHead>
		<TableBody>
			{#each data.types as t, i (t.id)}
				<TableBodyRow>
					<TableBodyCell>
						<form
							method="POST"
							action="?/move"
							use:enhance
							data-feedback="errors"
							class="flex gap-1"
						>
							<input type="hidden" name="id" value={t.id} />
							<Button
								type="submit"
								name="direction"
								value="up"
								size="xs"
								color="alternative"
								disabled={i === 0}
								aria-label="Monter {t.name}"
							>
								<ArrowUpOutline class="h-3 w-3" />
							</Button>
							<Button
								type="submit"
								name="direction"
								value="down"
								size="xs"
								color="alternative"
								disabled={i === data.types.length - 1}
								aria-label="Descendre {t.name}"
							>
								<ArrowDownOutline class="h-3 w-3" />
							</Button>
						</form>
					</TableBodyCell>
					<TableBodyCell>
						<form
							method="POST"
							action="?/rename"
							use:enhance={keepValues}
							data-success="Type renommé."
							class="flex gap-2"
						>
							<input type="hidden" name="id" value={t.id} />
							<Input
								name="name"
								value={t.name}
								size="sm"
								required
								aria-label="Nom du type {t.name}"
								class="min-w-48"
							/>
							<Button type="submit" size="xs" color="alternative">Renommer</Button>
						</form>
					</TableBodyCell>
					<TableBodyCell class="text-sm text-gray-500">{usage(t)}</TableBodyCell>
					<TableBodyCell>
						<form
							method="POST"
							action="?/toggle"
							use:enhance
							data-success={t.isActive ? 'Type désactivé.' : 'Type réactivé.'}
						>
							<input type="hidden" name="id" value={t.id} />
							<input type="hidden" name="active" value={String(!t.isActive)} />
							<button type="submit" title={t.isActive ? 'Désactiver' : 'Réactiver'}>
								<StateBadge
									color={t.isActive ? 'green' : 'gray'}
									label={t.isActive ? 'Proposé' : 'Désactivé'}
								/>
							</button>
						</form>
					</TableBodyCell>
					<TableBodyCell class="text-right">
						<form method="POST" action="?/delete" use:enhance data-success="Type supprimé.">
							<input type="hidden" name="id" value={t.id} />
							<Button
								type="submit"
								size="xs"
								color="alternative"
								disabled={t.machines + t.repairs > 0}
								title={t.machines + t.repairs > 0
									? 'Utilisé : désactivez-le plutôt'
									: 'Supprimer ce type'}
								aria-label="Supprimer {t.name}"
							>
								<TrashBinOutline class="h-3 w-3" />
							</Button>
						</form>
					</TableBodyCell>
				</TableBodyRow>
			{/each}
		</TableBody>
	</Table>
	<p class="mt-4 text-xs text-gray-500">
		Renommer un type met à jour les machines et les ordres qui le portent. Un type désactivé n'est
		plus proposé, mais reste affiché là où il figure déjà. Seul un type inutilisé peut être
		supprimé.
	</p>
</Card>
