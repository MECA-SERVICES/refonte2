<script lang="ts">
	/** Un maillon du fil d'Ariane ; sans href, c'est la page courante. */
	export type Crumb = { label: string; href?: string };

	let { items }: { items: Crumb[] } = $props();
</script>

<nav aria-label="Fil d'Ariane" class="mb-5 text-[13px]">
	<ol class="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-shop-muted">
		<li>
			<a href="/" class="hover:text-shop-blue hover:underline">Accueil</a>
		</li>
		<!--
			La clé est la position, non le libellé : le catalogue repris de
			PrestaShop compte des catégories homonymes — deux « Entretoises », par
			exemple — et un libellé dupliqué dans un même fil interrompait le rendu
			de la page.
		-->
		{#each items as item, i (i)}
			<li aria-hidden="true">/</li>
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
