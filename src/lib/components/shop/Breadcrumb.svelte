<script lang="ts">
	import { ChevronRightOutline } from 'flowbite-svelte-icons';

	/** Un maillon du fil d'Ariane ; sans href, c'est la page courante. */
	export type Crumb = { label: string; href?: string };

	let { items }: { items: Crumb[] } = $props();
</script>

<nav aria-label="Fil d'Ariane" class="mb-5 text-sm">
	<ol class="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-shop-muted">
		<li>
			<a href="/" class="hover:text-shop-blue hover:underline">Accueil</a>
		</li>
		{#each items as item (item.label)}
			<li aria-hidden="true"><ChevronRightOutline class="h-3.5 w-3.5" /></li>
			<li>
				{#if item.href}
					<a href={item.href} class="hover:text-shop-blue hover:underline">{item.label}</a>
				{:else}
					<span class="font-semibold text-shop-ink" aria-current="page">{item.label}</span>
				{/if}
			</li>
		{/each}
	</ol>
</nav>
