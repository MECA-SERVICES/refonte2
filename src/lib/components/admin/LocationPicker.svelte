<script lang="ts">
	/**
	 * Choix d'un emplacement de stock parmi les 375 repris de Dolibarr.
	 *
	 * Une liste déroulante de chemins complets était illisible : ici on tape le
	 * code de l'étiquette (« 4372 ») ou quelques mots (« droite 43 r7 »), et
	 * le clavier suffit (↑ ↓ Entrée Échap). Sans saisie, l'arbre complet
	 * s'affiche, indenté. Réutilisable par les écrans de mouvement de stock.
	 */
	import { ChevronDownOutline, CloseOutline } from 'flowbite-svelte-icons';
	import { formatNumber } from '$lib/money';
	import { locationScore } from '$lib/stock-locations';

	type PickerLocation = {
		id: number;
		name: string;
		code: string | null;
		path: string;
		depth: number;
		isActive: boolean;
		description?: string | null;
		/** Unités rangées, sous-emplacements compris (affichage seulement). */
		total?: number;
	};

	let {
		locations,
		name,
		value = $bindable(null),
		label,
		placeholder = 'Code ou nom, ex. 4372 ou « droite 43 r7 »',
		rootLabel,
		exclude = [],
		required = false,
		form
	}: {
		locations: PickerLocation[];
		/** Nom du champ envoyé (identifiant, vide pour la racine). */
		name: string;
		value?: number | null;
		/** Libellé lu par les lecteurs d'écran. */
		label: string;
		placeholder?: string;
		/** Propose la racine (aucun parent) sous ce libellé. */
		rootLabel?: string;
		/** Emplacements à ne pas proposer (ex. lui-même et ses sous-emplacements). */
		exclude?: number[];
		required?: boolean;
		/** Formulaire auquel rattacher le champ, s'il est déclaré ailleurs (attribut `form`). */
		form?: string;
	} = $props();

	const MAX_RESULTS = 80;
	const uid = $props.id();

	let query = $state('');
	let open = $state(false);
	let active = $state(0);
	let list = $state<HTMLUListElement | null>(null);

	const selected = $derived(locations.find((l) => l.id === value) ?? null);
	const candidates = $derived(locations.filter((l) => l.isActive && !exclude.includes(l.id)));

	/** Résultats classés : code exact, début de code, puis ordre de l'arbre. */
	const results = $derived.by(() => {
		if (!query.trim()) return candidates;
		return candidates
			.map((l, order) => ({ l, order, score: locationScore(query, l) }))
			.filter((r) => r.score !== null)
			.sort((a, b) => a.score! - b.score! || a.order - b.order)
			.map((r) => r.l);
	});
	// Sans saisie, l'arbre entier se parcourt ; une recherche trop large est tronquée.
	const shown = $derived(query.trim() ? results.slice(0, MAX_RESULTS) : results);
	const showRoot = $derived(rootLabel !== undefined && !query.trim());
	/** Options navigables au clavier : la racine éventuelle, puis les résultats. */
	const options = $derived<(PickerLocation | null)[]>(showRoot ? [null, ...shown] : shown);

	function openList() {
		if (open) return;
		open = true;
		query = '';
		active = Math.max(
			0,
			options.findIndex((o) => (o?.id ?? null) === value)
		);
	}

	function choose(option: PickerLocation | null) {
		value = option?.id ?? null;
		open = false;
		query = '';
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
			e.preventDefault();
			if (!open) return openList();
			const step = e.key === 'ArrowDown' ? 1 : -1;
			active = (active + step + options.length) % Math.max(options.length, 1);
			list?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
		} else if (e.key === 'Enter' && open) {
			e.preventDefault();
			if (options[active] !== undefined) choose(options[active]);
		} else if (e.key === 'Escape' && open) {
			e.preventDefault();
			open = false;
		}
	}

	/** Partie du chemin au-dessus de l'emplacement, affichée en petit. */
	function parentPath(l: PickerLocation) {
		return l.path.slice(0, Math.max(0, l.path.length - l.name.length - 3));
	}
</script>

<div class="relative">
	<input type="hidden" {name} {form} value={value ?? ''} />
	<div class="relative">
		<input
			type="text"
			role="combobox"
			aria-label={label}
			aria-expanded={open}
			aria-controls="{uid}-list"
			aria-autocomplete="list"
			aria-activedescendant={open && options.length ? `${uid}-opt-${active}` : undefined}
			autocomplete="off"
			{required}
			placeholder={selected ? '' : placeholder}
			value={open ? query : (selected?.path ?? (value === null && rootLabel ? rootLabel : ''))}
			oninput={(e) => {
				query = e.currentTarget.value;
				active = 0;
				open = true;
			}}
			onfocus={openList}
			onclick={openList}
			onblur={() => (open = false)}
			{onkeydown}
			class="block w-full truncate rounded-lg border border-gray-300 bg-gray-50 p-2.5 pe-16 text-sm text-gray-900 focus:border-primary-500 focus:ring-primary-500"
		/>
		<div class="absolute inset-y-0 end-0 flex items-center gap-0.5 pe-2">
			{#if value !== null && !required}
				<button
					type="button"
					aria-label="Effacer l'emplacement choisi"
					onmousedown={(e) => e.preventDefault()}
					onclick={() => choose(null)}
					class="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-700"
				>
					<CloseOutline class="h-3.5 w-3.5" />
				</button>
			{/if}
			<ChevronDownOutline class="pointer-events-none h-4 w-4 text-gray-400" />
		</div>
	</div>

	{#if open}
		<!-- mousedown sans perte du focus : le clic choisit avant que la liste ne se ferme. -->
		<ul
			bind:this={list}
			id="{uid}-list"
			role="listbox"
			aria-label={label}
			onmousedown={(e) => e.preventDefault()}
			class="absolute z-20 mt-1 max-h-80 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
		>
			{#each options as option, i (option?.id ?? 'root')}
				<!-- Le clavier est géré par le champ (aria-activedescendant), pas par l'option. -->
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<li
					id="{uid}-opt-{i}"
					data-index={i}
					role="option"
					aria-selected={(option?.id ?? null) === value}
					onclick={() => choose(option)}
					onmousemove={() => (active = i)}
					class="flex cursor-pointer items-center gap-2 py-1.5 pe-3 text-sm {i === active
						? 'bg-primary-50'
						: ''} {(option?.id ?? null) === value ? 'font-semibold' : ''}"
					style:padding-inline-start="{(option && !query.trim() ? option.depth * 1 : 0) + 0.75}rem"
				>
					{#if option === null}
						<span class="text-gray-700 italic">{rootLabel}</span>
					{:else}
						<span class="min-w-0 flex-1">
							{#if query.trim() && option.depth > 0}
								<span class="block truncate text-xs text-gray-500">{parentPath(option)}</span>
							{/if}
							<span class="block truncate text-gray-900">{option.name}</span>
						</span>
						{#if option.total}
							<span class="shrink-0 text-xs text-gray-500 tabular-nums">
								{formatNumber(option.total)} u.
							</span>
						{/if}
						{#if option.code}
							<span
								class="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-700"
								title={option.description ?? option.path}
							>
								{option.code}
							</span>
						{/if}
					{/if}
				</li>
			{:else}
				<li class="px-3 py-2 text-sm text-gray-500">Aucun emplacement ne correspond.</li>
			{/each}
			{#if results.length > shown.length}
				<li class="border-t border-gray-100 px-3 py-2 text-xs text-gray-500">
					{formatNumber(results.length - shown.length)} autres résultats : précisez la recherche.
				</li>
			{/if}
		</ul>
	{/if}
</div>
