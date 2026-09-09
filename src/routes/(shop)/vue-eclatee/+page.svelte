<script lang="ts">
	import Breadcrumb from '$lib/components/shop/Breadcrumb.svelte';
	import Panel from '$lib/components/shop/Panel.svelte';
	import ShopButton from '$lib/components/shop/ShopButton.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	/**
	 * Sélecteur en trois étapes : marque, type de machine, modèle.
	 *
	 * Chaque choix restreint le suivant. Le modèle est réinitialisé dès que le
	 * type change, sinon l'écran afficherait une combinaison impossible.
	 */
	// `null` tant que le visiteur n'a rien choisi : la valeur affichée retombe
	// alors sur la première option courante, qui suit les données de la page.
	let picked = $state<{ brand: string | null; type: string | null; model: string | null }>({
		brand: null,
		type: null,
		model: null
	});

	const brand = $derived(picked.brand ?? data.brands[0]);
	const machineType = $derived(picked.type ?? data.types[0]);
	const models = $derived(data.models[machineType] ?? data.models.default);
	const model = $derived(picked.model ?? models[0]);

	/** Changer de type invalide le modèle : la combinaison n'existerait plus. */
	const pickType = (value: string) => {
		picked = { ...picked, type: value, model: null };
	};

	/** Étape courante, pour l'indicateur de progression. */
	const steps = ['Marque', 'Type de machine', 'Modèle'];
</script>

<svelte:head>
	<title>Trouver une pièce par machine — MS Shop</title>
	<meta
		name="description"
		content="Sélectionnez votre marque, votre type de machine et votre modèle : vue éclatée, références d'origine et stock atelier sur la même page."
	/>
</svelte:head>

<Breadcrumb items={[{ label: 'Vues éclatées' }]} />

<h1
	class="font-display text-[28px] font-extrabold tracking-[-0.025em] text-shop-ink sm:text-[42px]"
>
	Trouver une pièce par machine
</h1>
<p class="mt-2 max-w-[64ch] text-base text-shop-muted">
	Trois clics : la marque, le type de machine, le modèle. On vous emmène directement sur la vue
	éclatée et les références d'origine.
</p>

<!-- ================= Progression ================= -->
<div class="mt-6 flex flex-wrap gap-2.5">
	{#each steps as label, i (label)}
		<div
			class="border-[1.5px] border-shop-ink px-3.5 py-2 font-display text-[13.5px] font-bold {i ===
			steps.length - 1
				? 'bg-shop-ink text-white'
				: 'bg-shop-border-soft text-shop-ink'}"
		>
			{i + 1} · {label}
		</div>
	{/each}
</div>

<!-- ================= Sélecteur ================= -->
{#snippet column(title: string, options: string[], current: string, pick: (v: string) => void)}
	<div class="bg-white p-5">
		<p
			class="mb-3.5 font-display text-[13px] font-extrabold tracking-[0.1em] text-shop-muted uppercase"
		>
			{title}
		</p>
		<div class="max-h-72 space-y-1.5 overflow-y-auto">
			{#each options as option (option)}
				<button
					type="button"
					onclick={() => pick(option)}
					aria-pressed={current === option}
					class="block w-full border-[1.5px] px-3.5 py-2.5 text-left text-[14.5px] font-semibold transition-colors {current ===
					option
						? 'border-shop-ink bg-shop-ink text-white'
						: 'border-shop-border bg-white text-shop-ink hover:border-shop-ink'}"
				>
					{option}
				</button>
			{/each}
		</div>
	</div>
{/snippet}

<div
	class="mt-6 grid gap-px border-[1.5px] border-shop-border bg-shop-border sm:grid-cols-2 lg:grid-cols-3"
>
	{@render column('1 · Marque', data.brands, brand, (v) => (picked = { ...picked, brand: v }))}
	{@render column('2 · Type de machine', data.types, machineType, pickType)}
	{@render column('3 · Modèle', models, model, (v) => (picked = { ...picked, model: v }))}
</div>

<!-- ================= Sélection ================= -->
<div
	class="text-shop-surface flex flex-wrap items-center justify-between gap-5 bg-shop-blue px-6 py-6"
>
	<div>
		<p class="mb-1.5 text-xs font-bold tracking-[0.12em] text-white/70 uppercase">
			Sélection en cours
		</p>
		<p class="font-display text-[22px] font-extrabold tracking-[-0.01em] text-white">
			{brand} · {machineType} · {model}
		</p>
	</div>

	<ShopButton variant="buy" href="/vue-eclatee/{data.plateSlug}">
		Voir les {data.partCount} pièces →
	</ShopButton>
</div>

<!-- ================= Aide ================= -->
<div class="mt-9 grid gap-4.5 sm:grid-cols-2 lg:grid-cols-3">
	{#each data.help as item (item.title)}
		<Panel class="p-5">
			<p class="font-display text-base font-extrabold text-shop-ink">{item.title}</p>
			<p class="mt-2 text-sm leading-relaxed text-shop-ink-soft">{item.text}</p>
		</Panel>
	{/each}
</div>
