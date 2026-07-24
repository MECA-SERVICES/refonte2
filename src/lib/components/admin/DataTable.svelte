<script lang="ts" generics="Row extends { id: string | number }">
	import {
		Table,
		TableHead,
		TableHeadCell,
		TableBody,
		TableBodyRow,
		TableBodyCell,
		Input,
		Button
	} from 'flowbite-svelte';
	import { SearchOutline } from 'flowbite-svelte-icons';
	import { goto } from '$app/navigation';
	import type { Snippet } from 'svelte';

	type Column<R> = {
		key: string;
		label: string;
		cell?: Snippet<[R]>;
	};

	let {
		rows,
		columns,
		search = $bindable(''),
		searchPlaceholder = 'Rechercher…',
		onsearch,
		emptyMessage = 'Aucun résultat.',
		rowHref
	}: {
		rows: Row[];
		columns: Column<Row>[];
		search?: string;
		searchPlaceholder?: string;
		onsearch?: (value: string) => void;
		emptyMessage?: string;
		rowHref?: (row: Row) => string;
	} = $props();

	function submitSearch(e: SubmitEvent) {
		e.preventDefault();
		onsearch?.(search);
	}
</script>

<div class="space-y-4">
	{#if onsearch}
		<form onsubmit={submitSearch} class="flex gap-2">
			<Input bind:value={search} placeholder={searchPlaceholder} class="max-w-sm">
				{#snippet left()}
					<SearchOutline class="h-5 w-5 text-gray-400" />
				{/snippet}
			</Input>
			<Button type="submit" color="alternative">Rechercher</Button>
		</form>
	{/if}

	<Table hoverable shadow>
		<TableHead>
			{#each columns as col (col.key)}
				<TableHeadCell>{col.label}</TableHeadCell>
			{/each}
		</TableHead>
		<TableBody>
			{#if rows.length === 0}
				<TableBodyRow>
					<TableBodyCell colspan={columns.length} class="py-8 text-center text-gray-500">
						{emptyMessage}
					</TableBodyCell>
				</TableBodyRow>
			{:else}
				{#each rows as row (row.id)}
					<TableBodyRow
						class={rowHref ? 'cursor-pointer' : ''}
						onclick={rowHref ? () => goto(rowHref(row)) : undefined}
					>
						{#each columns as col (col.key)}
							<TableBodyCell>
								{#if col.cell}{@render col.cell(row)}{:else}{(row as Record<string, unknown>)[
										col.key
									] ?? '—'}{/if}
							</TableBodyCell>
						{/each}
					</TableBodyRow>
				{/each}
			{/if}
		</TableBody>
	</Table>
</div>
