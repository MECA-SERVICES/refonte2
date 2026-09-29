<script lang="ts">
	/**
	 * Sélecteur de pièce de la charte v2 : carte blanche posée en chevauchement
	 * du hero, deux entrées — décrire sa machine (marque → type → modèle) ou
	 * taper directement une référence.
	 */

	let {
		brands,
		types,
		models,
		action = '/vue-eclatee',
		class: className = ''
	}: {
		brands: string[];
		types: string[];
		models: string[];
		/** Destination du formulaire : le sélecteur de pièce par machine. */
		action?: string;
		class?: string;
	} = $props();

	type Tab = 'machine' | 'ref';
	let tab = $state<Tab>('machine');

	/**
	 * Choix courant. `null` tant que le client n'a rien changé : la valeur
	 * affichée retombe alors sur la première option de la liste reçue, qui
	 * peut évoluer sans figer la sélection initiale.
	 */
	let picked = $state<{ brand?: string; type?: string; model?: string }>({});

	const brand = $derived(picked.brand ?? brands[0] ?? '');
	const type = $derived(picked.type ?? types[0] ?? '');
	const model = $derived(picked.model ?? models[0] ?? '');

	const selectClass =
		'w-full rounded-[10px] border-[1.5px] border-shop-border bg-white px-3.5 py-3 text-[15px] text-shop-ink focus:border-shop-blue focus:ring-0';

	const tabClass = (on: boolean) =>
		`rounded-lg px-4 py-2 font-display text-[13.5px] font-bold transition-colors ${
			on
				? 'bg-white text-shop-blue shadow-[0_1px_4px_rgba(30,36,54,0.12)]'
				: 'text-shop-muted hover:text-shop-ink'
		}`;
</script>

<div
	class="rounded-2xl bg-white p-5 shadow-[0_20px_50px_rgba(30,36,54,0.16),0_2px_6px_rgba(30,36,54,0.06)] sm:p-6 {className}"
>
	<div class="mb-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
		<div class="flex items-center gap-3">
			<span
				class="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-primary-50 text-shop-blue"
				aria-hidden="true"
			>
				<svg
					width="22"
					height="22"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path
						d="M14.7 6.3a4 4 0 0 0 5 5L13 18a3 3 0 0 1-4.2 0L4 13.2a3 3 0 0 1 0-4.2L10.7 2.3a4 4 0 0 0 4 4z"
					/>
				</svg>
			</span>
			<div>
				<p class="font-display text-[19px] font-extrabold tracking-[-0.01em] text-shop-ink">
					Trouvez la pièce de votre machine
				</p>
				<p class="text-[13.5px] text-shop-muted">
					Marque, type, modèle — on vous sort la vue éclatée et la référence d'origine.
				</p>
			</div>
		</div>

		<div class="flex gap-1 rounded-[10px] bg-shop-subtle p-1" role="tablist">
			<button
				type="button"
				role="tab"
				aria-selected={tab === 'machine'}
				onclick={() => (tab = 'machine')}
				class={tabClass(tab === 'machine')}
			>
				Par machine
			</button>
			<button
				type="button"
				role="tab"
				aria-selected={tab === 'ref'}
				onclick={() => (tab = 'ref')}
				class={tabClass(tab === 'ref')}
			>
				Par référence
			</button>
		</div>
	</div>

	{#if tab === 'machine'}
		<form method="GET" {action} class="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
			<label class="sr-only" for="finder-brand">Marque de ma machine</label>
			<select
				id="finder-brand"
				name="marque"
				value={brand}
				onchange={(e) => (picked = { ...picked, brand: e.currentTarget.value })}
				class={selectClass}
			>
				{#each brands as value (value)}
					<option {value}>{value}</option>
				{/each}
			</select>

			<label class="sr-only" for="finder-type">Type de machine</label>
			<select
				id="finder-type"
				name="type"
				value={type}
				onchange={(e) => (picked = { ...picked, type: e.currentTarget.value })}
				class={selectClass}
			>
				{#each types as value (value)}
					<option {value}>{value}</option>
				{/each}
			</select>

			<label class="sr-only" for="finder-model">Modèle</label>
			<select
				id="finder-model"
				name="modele"
				value={model}
				onchange={(e) => (picked = { ...picked, model: e.currentTarget.value })}
				class={selectClass}
			>
				{#each models as value (value)}
					<option {value}>{value}</option>
				{/each}
			</select>

			<!-- La recherche part sur le libellé complet de la machine. -->
			<input type="hidden" name="q" value="{brand} {model}" />

			<button
				type="submit"
				class="rounded-[10px] bg-shop-blue px-5 py-3 font-display text-[15px] font-bold text-white transition-colors hover:bg-shop-blue-dark"
			>
				Voir les pièces {brand}
			</button>
		</form>
	{:else}
		<form method="GET" action="/recherche" class="grid grid-cols-[minmax(0,1fr)_auto] gap-2.5">
			<label class="sr-only" for="finder-ref">Référence</label>
			<input
				id="finder-ref"
				type="search"
				name="q"
				placeholder="Saisissez la référence de la pièce ou de la machine — ex. 5313087-01"
				class="w-full rounded-[10px] border-[1.5px] border-shop-border px-3.5 py-3 text-[15px] text-shop-ink placeholder:text-shop-muted focus:border-shop-blue focus:ring-0"
			/>
			<button
				type="submit"
				class="rounded-[10px] bg-shop-blue px-5 py-3 font-display text-[15px] font-bold text-white transition-colors hover:bg-shop-blue-dark"
			>
				Rechercher
			</button>
		</form>
	{/if}

	<p class="mt-3.5 flex flex-wrap gap-x-5 gap-y-1.5 text-[13.5px] text-shop-muted">
		<a href="/vue-eclatee" class="font-bold text-shop-blue hover:underline">
			Où trouver la référence de ma machine ?
		</a>
		<a
			href="https://doc.mecaservicesshop.fr"
			target="_blank"
			rel="noopener"
			class="font-bold text-shop-blue hover:underline"
		>
			Parcourir les vues éclatées
		</a>
		<span>
			Un doute ? Appelez l'atelier au
			<a href="tel:0950922336" class="font-bold text-shop-ink hover:underline">09 50 92 23 36</a>
		</span>
	</p>
</div>
