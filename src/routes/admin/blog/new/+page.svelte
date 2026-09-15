<script lang="ts">
	import { PageHeader, BlogArticleForm } from '$lib/components/admin';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<svelte:head><title>Nouvel article · Blog</title></svelte:head>

<PageHeader
	title="Nouvel article"
	crumbs={[
		{ label: 'Accueil', href: '/admin' },
		{ label: 'Blog', href: '/admin/blog' },
		{ label: 'Nouvel article' }
	]}
/>

<BlogArticleForm
	categories={data.categories}
	message={form?.message}
	submitLabel="Créer l'article"
/>
