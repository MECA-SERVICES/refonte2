<script lang="ts">
	import { ChevronRightOutline, ChevronDownOutline } from 'flowbite-svelte-icons';
	import type { CategoryNode } from '../../../routes/admin/categories/+page.server';
	import Self from './CategoryTree.svelte';

	/**
	 * Arborescence des catégories.
	 *
	 * Le catalogue compte 594 catégories sur cinq niveaux : un tableau plat les
	 * montrait sans leur hiérarchie, alors que c'est elle qui donne le sens. Le
	 * composant s'appelle lui-même pour descendre les branches.
	 */

	let {
		nodes,
		selectedId,
		expanded,
		onselect,
		ontoggle,
		depth = 0
	}: {
		nodes: CategoryNode[];
		selectedId: number | null;
		/** Identifiants des branches ouvertes, partagés par toute l'arborescence. */
		expanded: Set<number>;
		onselect: (node: CategoryNode) => void;
		ontoggle: (id: number) => void;
		depth?: number;
	} = $props();
</script>

<ul class="space-y-0.5">
	{#each nodes as node (node.id)}
		{@const isOpen = expanded.has(node.id)}
		{@const hasChildren = node.children.length > 0}
		<li>
			<div
				class="group flex items-center gap-1 rounded pe-2 {selectedId === node.id
					? 'bg-primary-50 dark:bg-primary-900/40'
					: 'hover:bg-gray-100 dark:hover:bg-gray-800'}"
				style="padding-inline-start: {depth * 0.85 + 0.25}rem"
			>
				<!-- Le chevron n'occupe sa place que s'il sert : sinon les feuilles
				     seraient décalées sans raison. -->
				{#if hasChildren}
					<button
						type="button"
						onclick={() => ontoggle(node.id)}
						aria-label={isOpen ? 'Replier' : 'Déplier'}
						aria-expanded={isOpen}
						class="flex h-6 w-6 shrink-0 items-center justify-center rounded text-gray-400 hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
					>
						{#if isOpen}
							<ChevronDownOutline class="h-3.5 w-3.5" />
						{:else}
							<ChevronRightOutline class="h-3.5 w-3.5" />
						{/if}
					</button>
				{:else}
					<span class="h-6 w-6 shrink-0" aria-hidden="true"></span>
				{/if}

				<button
					type="button"
					onclick={() => onselect(node)}
					aria-current={selectedId === node.id ? 'true' : undefined}
					class="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-start text-sm"
				>
					<span
						class="truncate {selectedId === node.id
							? 'font-semibold text-primary-800 dark:text-primary-200'
							: 'text-gray-800 dark:text-gray-200'} {node.isActive
							? ''
							: 'line-through opacity-60'}"
					>
						{node.name}
					</span>

					{#if node.productCount > 0}
						<span class="shrink-0 text-xs text-gray-400 tabular-nums">{node.productCount}</span>
					{/if}
					{#if hasChildren}
						<span class="shrink-0 text-xs text-gray-300 dark:text-gray-600">
							({node.children.length})
						</span>
					{/if}
				</button>
			</div>

			{#if isOpen && hasChildren}
				<Self
					nodes={node.children}
					{selectedId}
					{expanded}
					{onselect}
					{ontoggle}
					depth={depth + 1}
				/>
			{/if}
		</li>
	{/each}
</ul>
