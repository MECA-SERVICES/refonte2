<script lang="ts">
	import { Badge, Button, Card } from 'flowbite-svelte';
	import { PlusOutline, BellActiveOutline } from 'flowbite-svelte-icons';
	import { PageHeader } from '$lib/components/admin';
	import { isLive, POPUP_SCOPE_LABELS, type PopupScope } from '$lib/popups';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const dateFmt = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' });

	type Row = (typeof data.rows)[number];

	/**
	 * État réel d'une annonce, qui ne se lit pas du seul interrupteur : une
	 * annonce active hors de sa période ne s'affiche pas davantage qu'une
	 * annonce éteinte.
	 */
	function liveState(row: Row): { label: string; color: 'green' | 'yellow' | 'gray' } {
		if (!row.isActive) return { label: 'Inactive', color: 'gray' };
		if (isLive(row)) return { label: 'En diffusion', color: 'green' };

		const start = row.startsAt ? new Date(row.startsAt) : null;
		if (start && start > new Date()) return { label: 'Programmée', color: 'yellow' };
		return { label: 'Terminée', color: 'gray' };
	}

	/** Période lisible, ou « en permanence » à défaut de bornes. */
	function window(row: Row): string {
		const start = row.startsAt ? dateFmt.format(new Date(row.startsAt)) : null;
		const end = row.endsAt ? dateFmt.format(new Date(row.endsAt)) : null;

		if (start && end) return `Du ${start} au ${end}`;
		if (start) return `À partir du ${start}`;
		if (end) return `Jusqu'au ${end}`;
		return 'En permanence';
	}
</script>

<svelte:head><title>Annonces · Administration</title></svelte:head>

<PageHeader
	title="Annonces"
	subtitle="{data.rows.length} annonce{data.rows.length > 1 ? 's' : ''}"
	crumbs={[{ label: 'Accueil', href: '/admin' }, { label: 'Annonces' }]}
>
	{#snippet actions()}
		<Button href="/admin/popups/new">
			<PlusOutline class="me-2 h-4 w-4" /> Nouvelle annonce
		</Button>
	{/snippet}
</PageHeader>

{#if data.rows.length === 0}
	<Card class="max-w-none p-10 text-center">
		<BellActiveOutline class="mx-auto h-10 w-10 text-gray-300 dark:text-gray-600" />
		<p class="mt-3 text-gray-600 dark:text-gray-300">
			Aucune annonce. Créez-en une pour informer vos visiteurs d'une fermeture, d'une promotion ou
			d'une nouveauté.
		</p>
		<div class="mt-5 flex justify-center">
			<Button href="/admin/popups/new">Créer une annonce</Button>
		</div>
	</Card>
{:else}
	<div class="space-y-3">
		{#each data.rows as row (row.id)}
			{@const state = liveState(row)}
			<Card class="max-w-none p-4">
				<div class="flex flex-wrap items-start justify-between gap-3">
					<div class="min-w-0">
						<div class="flex flex-wrap items-center gap-2">
							<p class="font-medium text-gray-900 dark:text-white">{row.name}</p>
							<Badge color={state.color}>{state.label}</Badge>
							{#if row.priority !== 0}
								<Badge color="blue">Priorité {row.priority}</Badge>
							{/if}
						</div>

						<p class="mt-1 text-xs text-gray-500">
							{window(row)} · {POPUP_SCOPE_LABELS[row.scope as PopupScope]}
							{#if row.delaySeconds > 0}
								· après {row.delaySeconds} s
							{/if}
						</p>

						{#if row.title}
							<p class="mt-1 text-sm text-gray-600 dark:text-gray-300">« {row.title} »</p>
						{/if}
					</div>

					<Button size="xs" color="alternative" href="/admin/popups/{row.id}">Modifier</Button>
				</div>
			</Card>
		{/each}
	</div>
{/if}
