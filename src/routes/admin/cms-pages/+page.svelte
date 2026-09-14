<script lang="ts">
	import { resolve } from '$app/paths';
	import { Badge, Button, Card } from 'flowbite-svelte';
	import { PlusOutline, FileLinesOutline } from 'flowbite-svelte-icons';
	import { PageHeader } from '$lib/components/admin';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const dateFmt = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short' });
</script>

<svelte:head><title>Pages · Administration</title></svelte:head>

<PageHeader
	title="Pages"
	subtitle="{data.rows.length} page{data.rows.length > 1 ? 's' : ''}"
	crumbs={[{ label: 'Accueil', href: '/admin' }, { label: 'Pages' }]}
>
	{#snippet actions()}
		<Button href="/admin/cms-pages/new">
			<PlusOutline class="me-2 h-4 w-4" /> Nouvelle page
		</Button>
	{/snippet}
</PageHeader>

{#if data.rows.length === 0}
	<Card class="max-w-none p-10 text-center">
		<FileLinesOutline class="mx-auto h-10 w-10 text-gray-300 dark:text-gray-600" />
		<p class="mt-3 text-gray-600 dark:text-gray-300">
			Aucune page pour le moment. Créez vos mentions légales, vos CGV ou une page « à propos ».
		</p>
		<div class="mt-5 flex justify-center">
			<Button href="/admin/cms-pages/new">Créer une page</Button>
		</div>
	</Card>
{:else}
	<div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
		{#each data.rows as row (row.id)}
			<Card class="max-w-none p-5">
				<div class="flex items-start justify-between gap-3">
					<a
						href={resolve('/admin/cms-pages/[id]', { id: String(row.id) })}
						class="min-w-0 font-semibold text-gray-900 hover:underline dark:text-white"
					>
						{row.title}
					</a>
					<Badge color={row.isPublished ? 'green' : 'gray'}>
						{row.isPublished ? 'Publiée' : 'Brouillon'}
					</Badge>
				</div>

				<p class="mt-1 truncate text-xs text-gray-500">/p/{row.slug}</p>
				<p class="mt-3 text-xs text-gray-400">
					Modifiée le {dateFmt.format(new Date(row.updatedAt))}
				</p>
			</Card>
		{/each}
	</div>
{/if}
