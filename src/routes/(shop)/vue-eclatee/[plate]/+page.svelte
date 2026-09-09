<script lang="ts">
	import Breadcrumb from '$lib/components/shop/Breadcrumb.svelte';
	import ImagePlaceholder from '$lib/components/shop/ImagePlaceholder.svelte';
	import { formatPrice } from '$lib/shop';
	import { effectiveTaxRate, priceSuffix } from '$lib/tax';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const plate = $derived(data.plate);

	/**
	 * Repère survolé ou sélectionné.
	 *
	 * Un seul état pilote le plan et le tableau : cliquer une pastille surligne
	 * la ligne, survoler une ligne allume la pastille. C'est ce va-et-vient qui
	 * fait l'intérêt d'une vue éclatée.
	 */
	let active = $state<number | null>(null);

	/** Les prix de démonstration sont HT ; l'affichage suit le profil (P2). */
	const suffix = $derived(priceSuffix(data.tax.displayMode));
	const rate = $derived(effectiveTaxRate(20, data.tax.regime));

	const shownPrice = (priceHt: number) =>
		data.tax.displayMode === 'ht' ? priceHt : priceHt * (1 + rate / 100);
</script>

<svelte:head>
	<title>{plate.machine} — {plate.label} | MS Shop</title>
	<meta
		name="description"
		content="Vue éclatée {plate.machine} : repères, références d'origine et disponibilité atelier."
	/>
</svelte:head>

<Breadcrumb
	items={[
		{ label: 'Vues éclatées', href: '/vue-eclatee' },
		{ label: plate.brand },
		{ label: plate.family },
		{ label: plate.machine }
	]}
/>

<div class="mb-5 flex flex-wrap items-end justify-between gap-4">
	<h1
		class="font-display text-[26px] font-extrabold tracking-[-0.025em] text-shop-ink sm:text-[36px]"
	>
		{plate.machine} — Carter d'embrayage &amp; frein de chaîne
	</h1>

	<label class="text-sm">
		<span class="sr-only">Changer de planche</span>
		<select
			class="border-[1.5px] border-shop-ink bg-white px-3 py-2.5 text-sm text-shop-ink"
			aria-label="Changer de planche"
		>
			{#each data.plates as item (item)}
				<option>{item}</option>
			{/each}
		</select>
	</label>
</div>

<div class="grid gap-6 lg:grid-cols-2 lg:items-start">
	<!-- ================= Planche ================= -->
	<div class="relative border-[1.5px] border-shop-border bg-white">
		<ImagePlaceholder label="Planche technique — {plate.label}" class="h-[520px] w-full border-0" />

		{#each plate.parts as part (part.mark)}
			<button
				type="button"
				onclick={() => (active = part.mark)}
				onmouseenter={() => (active = part.mark)}
				aria-label="Repère {part.mark} — {part.name}"
				aria-pressed={active === part.mark}
				class="absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white font-display text-[13px] font-extrabold text-white shadow-md transition-colors {active ===
				part.mark
					? 'bg-shop-red'
					: 'bg-shop-blue hover:bg-shop-red'}"
				style="left: {part.x}%; top: {part.y}%"
			>
				{part.mark}
			</button>
		{/each}
	</div>

	<!-- ================= Nomenclature ================= -->
	<div class="min-w-0">
		<div class="border-[1.5px] border-shop-border bg-white">
			<div
				class="flex justify-between gap-3 border-b-[1.5px] border-shop-border px-4 py-3.5 font-display text-[13px] font-extrabold tracking-[0.08em] text-shop-muted uppercase"
			>
				<span>Repère · Désignation</span>
				<span>Prix {suffix}</span>
			</div>

			{#each plate.parts as part (part.mark)}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					onmouseenter={() => (active = part.mark)}
					class="flex flex-wrap items-center justify-between gap-3 border-b border-shop-border-soft px-4 py-3.5 transition-colors last:border-b-0 {active ===
					part.mark
						? 'bg-shop-border-soft'
						: 'bg-white'}"
				>
					<div class="flex min-w-0 items-center gap-3">
						<span
							class="flex h-6.5 w-6.5 shrink-0 items-center justify-center font-display text-[12.5px] font-extrabold text-white transition-colors {active ===
							part.mark
								? 'bg-shop-red'
								: 'bg-shop-blue'}"
						>
							{part.mark}
						</span>
						<div class="min-w-0">
							<p class="text-[14.5px] font-bold text-shop-ink">{part.name}</p>
							<p class="text-[12.5px] text-shop-muted">
								Réf. {part.reference} · {part.availability}
							</p>
						</div>
					</div>

					<div class="flex items-center gap-3">
						<span class="font-display font-bold whitespace-nowrap text-shop-ink">
							{formatPrice(shownPrice(part.priceHt))}
						</span>
						<button
							type="button"
							aria-label="Ajouter {part.name} au panier"
							class="border-[1.5px] border-shop-ink bg-shop-subtle px-2.5 py-1.5 text-[13px] font-bold text-shop-ink transition-colors hover:bg-shop-ink hover:text-white"
						>
							+
						</button>
					</div>
				</div>
			{/each}
		</div>

		<div
			class="border-[1.5px] border-t-0 border-shop-border bg-shop-border-soft p-4 text-[13.5px] leading-relaxed text-shop-ink-soft"
		>
			Un repère absent de la planche ou une référence remplacée par le constructeur ? Envoyez-nous
			le numéro de série — on retrouve l'équivalence d'origine.
		</div>
	</div>
</div>
