<script lang="ts">
	import { Label, Select } from 'flowbite-svelte';
	import ShopButton from './ShopButton.svelte';

	/**
	 * Sélecteur de pièce en trois temps : marque → type de machine → modèle.
	 *
	 * C'est l'entrée principale du catalogue dans la maquette : plutôt que de
	 * chercher une référence à l'aveugle, le client décrit sa machine et on
	 * l'amène à la vue éclatée correspondante.
	 */

	let {
		brands,
		types,
		models,
		action = '/vue-eclatee'
	}: {
		brands: string[];
		types: string[];
		models: string[];
		/** Destination du formulaire : le sélecteur de pièce par machine. */
		action?: string;
	} = $props();

	/**
	 * Choix courant. `null` tant que le client n'a rien changé : la valeur
	 * affichée retombe alors sur la première option de la liste reçue, qui
	 * peut évoluer sans figer la sélection initiale.
	 */
	let picked = $state<{ brand?: string; type?: string; model?: string }>({});

	const brand = $derived(picked.brand ?? brands[0] ?? '');
	const type = $derived(picked.type ?? types[0] ?? '');
	const model = $derived(picked.model ?? models[0] ?? '');

	const toItems = (values: string[]) => values.map((v) => ({ value: v, name: v }));

	const labelClass = 'mb-1.5 block text-xs font-bold text-shop-muted';
	const selectClass = 'rounded-none border-shop-border bg-shop-subtle';
</script>

<div class="border-[1.5px] border-shop-ink bg-white p-5 sm:p-6">
	<p class="mb-3.5 font-display text-[15px] font-extrabold tracking-wide text-shop-ink uppercase">
		Sélecteur de pièce
	</p>

	<form method="GET" {action} class="grid gap-2.5 sm:grid-cols-3">
		<div>
			<Label for="finder-brand" class={labelClass}>1 · Marque</Label>
			<Select
				id="finder-brand"
				name="marque"
				items={toItems(brands)}
				value={brand}
				onchange={(e) => (picked = { ...picked, brand: e.currentTarget.value })}
				class={selectClass}
			/>
		</div>

		<div>
			<Label for="finder-type" class={labelClass}>2 · Type de machine</Label>
			<Select
				id="finder-type"
				name="type"
				items={toItems(types)}
				value={type}
				onchange={(e) => (picked = { ...picked, type: e.currentTarget.value })}
				class={selectClass}
			/>
		</div>

		<div>
			<Label for="finder-model" class={labelClass}>3 · Modèle</Label>
			<Select
				id="finder-model"
				name="modele"
				items={toItems(models)}
				value={model}
				onchange={(e) => (picked = { ...picked, model: e.currentTarget.value })}
				class={selectClass}
			/>
		</div>

		<!-- La recherche part sur le libellé complet de la machine. -->
		<input type="hidden" name="q" value="{brand} {model}" />

		<ShopButton type="submit" variant="buy" size="lg" block class="mt-1.5 sm:col-span-3">
			Ouvrir la vue éclatée
		</ShopButton>
	</form>

	<p class="mt-3 text-[13px] text-shop-muted">
		Vous avez la référence ?
		<a href="/recherche" class="font-semibold text-shop-blue hover:underline">
			Tapez-la directement
		</a>
		— ou envoyez-nous la plaque moteur en photo, on cherche pour vous.
	</p>
</div>
