<script lang="ts">
	import { enhance } from '$app/forms';
	import { Alert, Button, Card } from 'flowbite-svelte';
	import { TrashBinOutline, EyeOutline, LinkOutline } from 'flowbite-svelte-icons';
	import { PageHeader, BlogArticleForm, ConfirmDialog } from '$lib/components/admin';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const article = $derived(data.article);

	let confirmOpen = $state(false);
	let deleteForm = $state<HTMLFormElement | null>(null);

	const dateFmt = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' });

	/**
	 * Jeton d'aperçu courant.
	 *
	 * Celui qui vient d'être émis prime : l'article rechargé ne le porte pas
	 * encore au moment où l'action répond.
	 */
	const previewToken = $derived(
		form && 'previewToken' in form ? form.previewToken : article.previewToken
	);
	const previewExpiry = $derived(
		form && 'previewExpiresAt' in form
			? new Date(form.previewExpiresAt as string)
			: article.previewTokenExpiresAt
	);

	const revoked = $derived(Boolean(form && 'previewRevoked' in form));
</script>

<svelte:head><title>{article.title} · Blog</title></svelte:head>

<PageHeader
	title={article.title}
	crumbs={[
		{ label: 'Accueil', href: '/admin' },
		{ label: 'Blog', href: '/admin/blog' },
		{ label: article.title }
	]}
>
	{#snippet actions()}
		{#if article.status === 'published'}
			<Button color="alternative" href="/blog/{article.slug}" target="_blank">
				<EyeOutline class="me-2 h-4 w-4" /> Voir l'article
			</Button>
		{/if}
		<Button color="red" onclick={() => (confirmOpen = true)}>
			<TrashBinOutline class="me-2 h-4 w-4" /> Supprimer
		</Button>
	{/snippet}
</PageHeader>

{#if form?.saved}
	<Alert color="green" class="mb-4">Article enregistré.</Alert>
{/if}

<!-- ================= Aperçu d'un brouillon ================= -->
{#if article.status !== 'published'}
	<Card class="mb-6 max-w-none p-5">
		<h2 class="mb-2 text-base font-semibold text-gray-900 dark:text-white">Partager un aperçu</h2>
		<p class="mb-4 text-sm text-gray-600 dark:text-gray-300">
			Un lien signé permet de relire ce brouillon sans le publier. Il expire au bout de 7 jours, et
			en émettre un nouveau annule le précédent.
		</p>

		{#if revoked}
			<Alert color="yellow" class="mb-4">Le lien d'aperçu a été révoqué.</Alert>
		{:else if previewToken && previewExpiry}
			<div
				class="mb-4 rounded border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800"
			>
				<p class="flex items-center gap-2 text-xs text-gray-500">
					<LinkOutline class="h-4 w-4" />
					Valable jusqu'au {dateFmt.format(new Date(previewExpiry))}
				</p>
				<code class="mt-1 block text-xs break-all text-gray-800 dark:text-gray-200">
					/blog/{article.slug}?apercu={previewToken}
				</code>
			</div>
		{/if}

		<div class="flex flex-wrap gap-2">
			<form method="POST" action="?/preview" use:enhance>
				<Button type="submit" color="alternative" size="sm">
					{previewToken && !revoked ? 'Émettre un nouveau lien' : 'Émettre un lien'}
				</Button>
			</form>
			{#if previewToken && !revoked}
				<form method="POST" action="?/revokePreview" use:enhance>
					<Button type="submit" color="alternative" size="sm">Révoquer</Button>
				</form>
			{/if}
		</div>
	</Card>
{/if}

<BlogArticleForm {article} action="?/save" categories={data.categories} message={form?.message} />

<form method="POST" action="?/delete" bind:this={deleteForm} class="hidden"></form>

<ConfirmDialog
	bind:open={confirmOpen}
	title="Supprimer l'article"
	message="Cette action est irréversible. L'adresse publique ne répondra plus."
	confirmLabel="Supprimer"
	onconfirm={() => deleteForm?.requestSubmit()}
/>
