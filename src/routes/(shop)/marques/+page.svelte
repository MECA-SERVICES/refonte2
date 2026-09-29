<script lang="ts">
	import { formatNumber } from '$lib/money';
	import Breadcrumb from '$lib/components/shop/Breadcrumb.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let query = $state('');
	/** Initiale sélectionnée ; `null` quand aucun filtre alphabétique n'est posé. */
	let letter = $state<string | null>(null);

	/**
	 * Initiale de classement.
	 *
	 * Les accents sont repliés (« Kärcher » se range sous K) et tout ce qui n'est
	 * pas une lettre part dans « # », comme dans un annuaire papier.
	 */
	function initial(name: string) {
		const c = name
			.trim()
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '')
			.charAt(0)
			.toUpperCase();
		return /[A-Z]/.test(c) ? c : '#';
	}

	/** Forme comparable : sans accent ni casse, pour que « karcher » trouve « Kärcher ». */
	const fold = (s: string) =>
		s
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '')
			.toLowerCase();

	const letters = $derived([...new Set(data.brands.map((b) => initial(b.name)))].sort());

	const filtered = $derived.by(() => {
		const q = fold(query.trim());
		return data.brands.filter(
			(b) =>
				(letter === null || initial(b.name) === letter) && (q === '' || fold(b.name).includes(q))
		);
	});

	/**
	 * Regroupement par initiale, pour les intertitres de la liste.
	 *
	 * La liste arrive déjà triée par nom depuis le serveur : il suffit donc de
	 * la parcourir en ouvrant un groupe à chaque changement d'initiale.
	 */
	const groups = $derived.by(() => {
		const out: { key: string; items: typeof data.brands }[] = [];
		for (const b of filtered) {
			const key = initial(b.name);
			const last = out.at(-1);
			if (last?.key === key) last.items.push(b);
			else out.push({ key, items: [b] });
		}
		return out;
	});

	function reset() {
		query = '';
		letter = null;
	}
</script>

<svelte:head>
	<title>Toutes les marques — MS Shop</title>
	<meta
		name="description"
		content="Les {formatNumber(
			data.brands.length
		)} marques de motoculture et de pièces détachées distribuées par MS Shop."
	/>
</svelte:head>

<Breadcrumb items={[{ label: 'Marques' }]} />

<h1
	class="font-display text-[30px] leading-[1.05] font-extrabold tracking-[-0.025em] text-shop-ink sm:text-[38px] lg:text-[44px]"
>
	Toutes nos <span class="text-shop-blue">marques</span>
</h1>
<p class="mt-2 max-w-[70ch] text-[15.5px] leading-relaxed text-shop-muted">
	{formatNumber(data.brands.length)} marques référencées, pièces d'origine et adaptables homologuées.
	Choisissez la vôtre pour accéder à son catalogue.
</p>

<!-- ================= Filtres ================= -->
<div class="mt-6 rounded-2xl border-[1.5px] border-shop-border-soft bg-white p-4 sm:p-5">
	<label class="block">
		<span class="sr-only">Rechercher une marque</span>
		<input
			type="search"
			bind:value={query}
			placeholder="Rechercher une marque (ex. Husqvarna, Stiga…)"
			class="w-full rounded-xl border-2 border-shop-border px-4 py-3 text-[15px] text-shop-ink placeholder:text-shop-muted focus:border-shop-blue focus:ring-0"
		/>
	</label>

	<!-- Navigation alphabétique : sur un millier d'entrées, elle reste le moyen
	     le plus rapide d'atteindre une marque dont on connaît le nom. -->
	<div class="mt-3.5 flex flex-wrap gap-1.5">
		<button
			type="button"
			onclick={() => (letter = null)}
			class="rounded-full border-[1.5px] px-3 py-1.5 font-display text-[13px] font-bold transition-colors {letter ===
			null
				? 'border-shop-ink bg-shop-ink text-white'
				: 'border-shop-border bg-white text-shop-ink hover:border-shop-ink'}"
		>
			Tout
		</button>
		{#each letters as l (l)}
			<button
				type="button"
				onclick={() => (letter = letter === l ? null : l)}
				class="min-w-9 rounded-full border-[1.5px] px-2 py-1.5 font-display text-[13px] font-bold transition-colors {letter ===
				l
					? 'border-shop-ink bg-shop-ink text-white'
					: 'border-shop-border bg-white text-shop-ink hover:border-shop-ink'}"
			>
				{l}
			</button>
		{/each}
	</div>
</div>

<!-- ================= Résultats ================= -->
{#if filtered.length === 0}
	<div
		class="mt-6 rounded-2xl border-[1.5px] border-shop-border-soft bg-shop-subtle p-8 text-center"
	>
		<p class="font-display text-base font-bold text-shop-ink">Aucune marque ne correspond.</p>
		<p class="mt-1 text-sm text-shop-muted">
			Vérifiez l'orthographe, ou consultez la liste complète.
		</p>
		<button
			type="button"
			onclick={reset}
			class="mt-4 rounded-[10px] border-[1.5px] border-shop-ink px-4 py-2.5 font-display text-sm font-bold text-shop-ink transition-colors hover:bg-shop-ink hover:text-white"
		>
			Réinitialiser
		</button>
	</div>
{:else}
	<p class="mt-5 text-sm text-shop-muted" aria-live="polite">
		{formatNumber(filtered.length)}
		{filtered.length > 1 ? 'marques' : 'marque'}
	</p>

	{#each groups as group (group.key)}
		<section class="mt-6">
			<h2
				class="mb-3 border-b-[1.5px] border-shop-border-soft pb-1.5 font-display text-lg font-extrabold text-shop-ink"
			>
				{group.key}
			</h2>
			<ul class="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
				{#each group.items as item (item.id)}
					<li>
						<a
							href="/marque/{item.slug}"
							class="flex h-full items-center gap-3 rounded-xl border-[1.5px] border-shop-border-soft bg-white p-3 transition-colors hover:border-shop-blue"
						>
							{#if item.logoUrl}
								<img
									src={item.logoUrl}
									alt=""
									loading="lazy"
									class="h-9 w-14 shrink-0 object-contain"
								/>
							{/if}
							<span class="min-w-0">
								<span class="block truncate font-display text-sm font-bold text-shop-ink">
									{item.name}
								</span>
								<span class="flex items-center gap-1.5 text-xs text-shop-muted">
									{formatNumber(item.total)} réf.{#if item.inStock > 0}
										<span class="h-1.5 w-1.5 rounded-full bg-shop-green" aria-hidden="true"></span>
										{formatNumber(item.inStock)} en stock{/if}
								</span>
							</span>
						</a>
					</li>
				{/each}
			</ul>
		</section>
	{/each}
{/if}
