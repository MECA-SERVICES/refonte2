<script lang="ts">
	import { resolve } from '$app/paths';
	import { Badge, Button, Card } from 'flowbite-svelte';
	import { PlusOutline, NewspaperOutline, EyeOutline } from 'flowbite-svelte-icons';
	import { PageHeader } from '$lib/components/admin';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const dateFmt = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short' });

	const STATUS: Record<string, { label: string; color: 'green' | 'yellow' | 'gray' }> = {
		published: { label: 'Publié', color: 'green' },
		draft: { label: 'Brouillon', color: 'yellow' },
		archived: { label: 'Archivé', color: 'gray' }
	};

	const TYPES: Record<string, string> = {
		article: 'Article',
		video: 'Vidéo',
		external_link: 'Lien externe'
	};
</script>

<svelte:head><title>Blog · Administration</title></svelte:head>

<PageHeader
	title="Blog"
	subtitle="{data.rows.length} article{data.rows.length > 1 ? 's' : ''}"
	crumbs={[{ label: 'Accueil', href: '/admin' }, { label: 'Blog' }]}
>
	{#snippet actions()}
		<Button color="alternative" href="/admin/blog/categories">Catégories</Button>
		<Button href="/admin/blog/new">
			<PlusOutline class="me-2 h-4 w-4" /> Nouvel article
		</Button>
	{/snippet}
</PageHeader>

{#if data.rows.length === 0}
	<Card class="max-w-none p-10 text-center">
		<NewspaperOutline class="mx-auto h-10 w-10 text-gray-300 dark:text-gray-600" />
		<p class="mt-3 text-gray-600 dark:text-gray-300">
			Aucun article pour le moment. Publiez vos conseils d'entretien, vos tutoriels ou vos
			actualités.
		</p>
		<div class="mt-5 flex justify-center">
			<Button href="/admin/blog/new">Écrire un article</Button>
		</div>
	</Card>
{:else}
	<div class="space-y-3">
		{#each data.rows as row (row.id)}
			{@const status = STATUS[row.status] ?? { label: row.status, color: 'gray' as const }}
			<Card class="max-w-none p-5">
				<div class="flex flex-wrap items-start justify-between gap-4">
					<div class="min-w-0 flex-1">
						<div class="flex flex-wrap items-center gap-2">
							<a
								href={resolve('/admin/blog/[id]', { id: String(row.id) })}
								class="font-semibold text-gray-900 hover:underline dark:text-white"
							>
								{row.title}
							</a>
							<Badge color={status.color}>{status.label}</Badge>
							{#if row.contentType !== 'article'}
								<Badge color="blue">{TYPES[row.contentType] ?? row.contentType}</Badge>
							{/if}
						</div>

						<p class="mt-1 text-xs text-gray-500">
							{#if row.categoryName}{row.categoryName} ·
							{/if}
							{#if row.authorName}{row.authorName} ·
							{/if}
							{#if row.publishedAt}
								Publié le {dateFmt.format(new Date(row.publishedAt))}
							{:else}
								Modifié le {dateFmt.format(new Date(row.updatedAt))}
							{/if}
						</p>
					</div>

					<div class="flex shrink-0 items-center gap-3 text-xs text-gray-500">
						<span class="flex items-center gap-1" title="Consultations">
							<EyeOutline class="h-4 w-4" />
							{row.viewCount}
						</span>
					</div>
				</div>
			</Card>
		{/each}
	</div>
{/if}
