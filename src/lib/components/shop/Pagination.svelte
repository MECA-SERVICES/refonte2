<script lang="ts">
	import { page as pageState } from '$app/state';
	import { ArrowLeftOutline, ArrowRightOutline } from 'flowbite-svelte-icons';

	let {
		page,
		hasNextPage
	}: {
		page: number;
		hasNextPage: boolean;
	} = $props();

	/** Lien vers une page en conservant recherche et tri, sans muter l'URL courante. */
	function hrefFor(target: number) {
		const entries = [...pageState.url.searchParams.entries()].filter(([key]) => key !== 'page');
		entries.push(['page', String(target)]);
		return `${pageState.url.pathname}?${new URLSearchParams(entries)}`;
	}

	const linkClass =
		'inline-flex items-center gap-2 rounded-lg border border-shop-border px-4 py-2 text-sm font-semibold text-shop-ink transition-colors hover:border-shop-blue hover:text-shop-blue';
</script>

{#if page > 1 || hasNextPage}
	<nav class="mt-10 flex items-center justify-between gap-4" aria-label="Pagination">
		{#if page > 1}
			<a href={hrefFor(page - 1)} class={linkClass} rel="prev">
				<ArrowLeftOutline class="h-4 w-4" /> Précédent
			</a>
		{:else}
			<span></span>
		{/if}

		<span class="text-sm text-shop-muted">Page {page}</span>

		{#if hasNextPage}
			<a href={hrefFor(page + 1)} class={linkClass} rel="next">
				Suivant <ArrowRightOutline class="h-4 w-4" />
			</a>
		{:else}
			<span></span>
		{/if}
	</nav>
{/if}
