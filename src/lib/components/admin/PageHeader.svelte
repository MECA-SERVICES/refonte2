<script lang="ts">
	import { Heading, Breadcrumb, BreadcrumbItem } from 'flowbite-svelte';
	import type { Snippet } from 'svelte';

	type Crumb = { label: string; href?: string };

	let {
		title,
		subtitle,
		crumbs = [],
		actions
	}: {
		title: string;
		subtitle?: string;
		crumbs?: Crumb[];
		actions?: Snippet;
	} = $props();
</script>

<div class="mb-6">
	{#if crumbs.length > 0}
		<Breadcrumb class="mb-3">
			{#each crumbs as crumb (crumb.label)}
				<BreadcrumbItem href={crumb.href}>{crumb.label}</BreadcrumbItem>
			{/each}
		</Breadcrumb>
	{/if}
	<div class="flex flex-wrap items-center justify-between gap-3">
		<div>
			<Heading tag="h1" class="text-2xl font-bold text-gray-900 dark:text-white">{title}</Heading>
			{#if subtitle}
				<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
			{/if}
		</div>
		{#if actions}
			<div class="flex items-center gap-2">{@render actions()}</div>
		{/if}
	</div>
</div>
