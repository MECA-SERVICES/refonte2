<script lang="ts">
	import { Button } from 'flowbite-svelte';
	import { ChevronLeftOutline, ChevronRightOutline } from 'flowbite-svelte-icons';

	let {
		page,
		pageCount,
		total,
		hrefFor
	}: {
		page: number;
		pageCount: number;
		total: number;
		hrefFor: (page: number) => string;
	} = $props();
</script>

{#if pageCount > 1}
	<div class="flex items-center justify-between pt-2">
		<span class="text-sm text-gray-500 dark:text-gray-400">
			Page {page} sur {pageCount} · {total} résultat{total > 1 ? 's' : ''}
		</span>
		<div class="flex gap-2">
			<Button
				size="sm"
				color="alternative"
				href={page > 1 ? hrefFor(page - 1) : undefined}
				disabled={page <= 1}
			>
				<ChevronLeftOutline class="me-1 h-4 w-4" /> Précédent
			</Button>
			<Button
				size="sm"
				color="alternative"
				href={page < pageCount ? hrefFor(page + 1) : undefined}
				disabled={page >= pageCount}
			>
				Suivant <ChevronRightOutline class="ms-1 h-4 w-4" />
			</Button>
		</div>
	</div>
{/if}
