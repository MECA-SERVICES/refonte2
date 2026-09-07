<script lang="ts" generics="Row extends { id: string | number }">
	import {
		Table,
		TableHead,
		TableHeadCell,
		TableBody,
		TableBodyRow,
		TableBodyCell,
		Input,
		Select
	} from 'flowbite-svelte';
	import { SortOutline, CaretUpSolid, CaretDownSolid } from 'flowbite-svelte-icons';
	import { goto } from '$app/navigation';
	import type { Pathname } from '$app/types';
	import type { Snippet } from 'svelte';

	type SelectOption = { value: string; name: string };

	type Column<R> = {
		key: string;
		label: string;
		cell?: Snippet<[R]>;
		/** Nom du filtre par colonne (clé f_<filterKey> dans l'URL). Absent = non filtrable. */
		filterKey?: string;
		/** Si fourni, le filtre est un menu déroulant au lieu d'un input texte. */
		filterOptions?: SelectOption[];
		/** Nom de la colonne pour le tri (paramètre ?sort=). Absent = non triable. */
		sortKey?: string;
	};

	let {
		rows,
		columns,
		basePath,
		params,
		emptyMessage = 'Aucun résultat.',
		rowHref,
		debounceMs = 300
	}: {
		rows: Row[];
		columns: Column<Row>[];
		/** Chemin de base pour la navigation, ex. "/admin/customers". */
		basePath: Pathname;
		/** État courant depuis l'URL : filtres, tri, direction (+ paramètres à conserver). */
		params: {
			filters: Record<string, string>;
			sort: string;
			dir: string;
			extra?: Record<string, string>;
		};
		emptyMessage?: string;
		rowHref?: (row: Row) => Pathname;
		debounceMs?: number;
	} = $props();

	// Copie locale éditable, resynchronisée quand l'URL (params) change.
	let filterValues = $derived({ ...params.filters });

	let timer: ReturnType<typeof setTimeout> | undefined;

	/**
	 * Construit le chemin cible à partir des filtres non vides et du tri courant.
	 *
	 * Les chemins portent une query string : `resolve()` n'accepte que des
	 * identifiants de route littéraux, et l'application ne définit pas de
	 * `paths.base` — il n'y a donc rien à préfixer.
	 */
	function buildUrl(next: { sort?: string; dir?: string }): Pathname {
		// Paires clé/valeur assemblées à la main : la query string est construite
		// puis consommée immédiatement, sans lecture réactive.
		const pairs: [string, string][] = [];
		for (const [key, value] of Object.entries(params.extra ?? {})) {
			if (value) pairs.push([key, value]);
		}
		for (const [key, value] of Object.entries(filterValues)) {
			if (value.trim()) pairs.push([`f_${key}`, value.trim()]);
		}
		const sort = next.sort ?? params.sort;
		const dir = next.dir ?? params.dir;
		if (sort) {
			pairs.push(['sort', sort]);
			pairs.push(['dir', dir]);
		}
		const qs = pairs.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
		return (qs ? `${basePath}?${qs}` : basePath) as Pathname;
	}

	function onFilterInput(filterKey: string, e: Event) {
		const value = (e.currentTarget as HTMLInputElement).value;
		filterValues[filterKey] = value;
		clearTimeout(timer);
		timer = setTimeout(() => goto(buildUrl({}), { keepFocus: true, noScroll: true }), debounceMs);
	}

	function onFilterSelect(filterKey: string, e: Event) {
		filterValues[filterKey] = (e.currentTarget as HTMLSelectElement).value;
		goto(buildUrl({}), { keepFocus: true, noScroll: true });
	}

	/** Navigue vers la fiche de la ligne cliquée, si `rowHref` est fourni. */
	function openRow(row: Row) {
		if (!rowHref) return;
		goto(rowHref(row));
	}

	function toggleSort(sortKey: string) {
		const dir = params.sort === sortKey && params.dir === 'asc' ? 'desc' : 'asc';
		goto(buildUrl({ sort: sortKey, dir }), { keepFocus: true, noScroll: true });
	}
</script>

<Table hoverable shadow>
	<TableHead>
		{#each columns as col (col.key)}
			<TableHeadCell class={col.sortKey ? 'cursor-pointer select-none' : ''}>
				{#if col.sortKey}
					<button
						type="button"
						class="inline-flex items-center gap-1"
						onclick={() => toggleSort(col.sortKey!)}
					>
						{col.label}
						{#if params.sort === col.sortKey}
							{#if params.dir === 'asc'}
								<CaretUpSolid class="h-3 w-3" />
							{:else}
								<CaretDownSolid class="h-3 w-3" />
							{/if}
						{:else}
							<SortOutline class="h-3 w-3 text-gray-400" />
						{/if}
					</button>
				{:else}
					{col.label}
				{/if}
			</TableHeadCell>
		{/each}
	</TableHead>

	<TableBody>
		<!-- Ligne de filtres, un champ par colonne -->
		<TableBodyRow class="bg-gray-50 dark:bg-gray-800">
			{#each columns as col (col.key)}
				<TableBodyCell class="p-2">
					{#if col.filterKey && col.filterOptions}
						<Select
							size="sm"
							placeholder=""
							value={filterValues[col.filterKey] ?? ''}
							items={[{ value: '', name: 'Tous' }, ...col.filterOptions]}
							onchange={(e) => onFilterSelect(col.filterKey!, e)}
						/>
					{:else if col.filterKey}
						<Input
							size="sm"
							type="search"
							placeholder="Filtrer…"
							value={filterValues[col.filterKey] ?? ''}
							oninput={(e) => onFilterInput(col.filterKey!, e)}
						/>
					{/if}
				</TableBodyCell>
			{/each}
		</TableBodyRow>

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
					onclick={rowHref ? () => openRow(row) : undefined}
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
