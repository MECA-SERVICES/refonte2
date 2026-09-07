<script lang="ts">
	import type { ShopMenuChild } from '$lib/server/shop';

	/**
	 * Navigation principale en méga-menu.
	 *
	 * Chaque section ouvre un panneau où l'on descend l'arborescence colonne
	 * après colonne : choisir une entrée fait apparaître ses enfants à droite,
	 * jusqu'à cinq niveaux. Sur un catalogue de plus d'un million de références,
	 * c'est ce parcours par affinages successifs qui permet d'atteindre la pièce
	 * sans passer par la recherche.
	 */

	type Section = {
		id: string;
		label: string;
		/** Intitulé de chaque colonne, du plus général au plus précis. */
		columns: string[];
		cta: string;
		ctaHref: string;
		hint: string;
		roots: ShopMenuChild[];
	};

	let { sections }: { sections: Section[] } = $props();

	/** Section ouverte ; `null` quand le panneau est replié. */
	let openId = $state<string | null>(null);
	/** Chemin sélectionné dans la section ouverte, un libellé par niveau. */
	let path = $state<ShopMenuChild[]>([]);

	const active = $derived(sections.find((s) => s.id === openId) ?? null);

	/** Colonnes à afficher : la racine, puis les enfants de chaque choix. */
	const columns = $derived.by(() => {
		if (!active) return [];
		const result: { title: string; items: ShopMenuChild[] }[] = [];
		let level = active.roots;

		for (let depth = 0; depth <= path.length && depth < active.columns.length; depth++) {
			if (level.length === 0) break;
			result.push({ title: active.columns[depth] ?? '', items: level });
			const picked = path[depth];
			if (!picked) break;
			level = picked.children ?? [];
		}
		return result;
	});

	const trail = $derived(
		path.length > 0
			? path.map((entry) => entry.name).join('  ›  ')
			: 'Choisissez pour affiner — 5 niveaux disponibles'
	);

	function toggle(id: string) {
		openId = openId === id ? null : id;
		path = [];
	}

	function close() {
		openId = null;
		path = [];
	}

	/** Sélectionne une entrée à un niveau donné et tronque le chemin au-delà. */
	function pick(depth: number, entry: ShopMenuChild) {
		path = [...path.slice(0, depth), entry];
	}

	const isSelected = (depth: number, entry: ShopMenuChild) => path[depth]?.id === entry.id;
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && close()} />

<div class="relative z-40 bg-shop-blue">
	<div
		class="mx-auto flex w-full max-w-[1360px] flex-wrap items-stretch justify-between gap-0.5 px-4 sm:px-6 lg:px-8"
	>
		<div class="flex flex-wrap gap-0.5">
			{#each sections as section (section.id)}
				<button
					type="button"
					onclick={() => toggle(section.id)}
					aria-expanded={openId === section.id}
					class="px-4 py-4 font-display text-sm font-bold tracking-[0.04em] text-white uppercase transition-colors {openId ===
					section.id
						? 'bg-shop-blue-dark'
						: 'hover:bg-shop-blue-dark/60'}"
				>
					{section.label}
					<span class="ms-0.5 text-[11px] {openId === section.id ? 'opacity-100' : 'opacity-60'}">
						▾
					</span>
				</button>
			{/each}
		</div>

		<div class="flex flex-wrap items-center gap-0.5">
			<a
				href="https://doc.mecaservicesshop.fr"
				class="px-3.5 py-4 font-display text-[13px] font-semibold tracking-[0.04em] text-white uppercase hover:underline"
			>
				Vues éclatées
			</a>
			<a
				href="/recherche"
				class="px-3.5 py-4 font-display text-[13px] font-semibold tracking-[0.04em] text-white uppercase hover:underline"
			>
				Promos
			</a>
			<a
				href="/compte"
				class="px-3.5 py-4 font-display text-[13px] font-semibold tracking-[0.04em] text-white uppercase hover:underline"
			>
				SAV &amp; atelier
			</a>
		</div>
	</div>

	{#if active}
		<div
			class="absolute inset-x-0 top-full border-b-[3px] border-shop-blue bg-white shadow-[0_18px_40px_rgba(30,36,54,0.18)]"
		>
			<div class="mx-auto w-full max-w-[1360px] px-4 sm:px-6 lg:px-8">
				<!-- Fil du parcours en cours, et sortie vers la liste complète -->
				<div
					class="flex flex-wrap items-center justify-between gap-3 border-b border-shop-border py-3.5"
				>
					<p class="min-w-0 text-[13.5px] text-shop-muted">
						<span
							class="font-display text-[12.5px] font-extrabold tracking-[0.06em] text-shop-blue uppercase"
						>
							{active.label}
						</span>
						<span class="mx-2 text-shop-faint">›</span>{trail}
					</p>
					<div class="flex items-center gap-2.5">
						<a
							href={active.ctaHref}
							class="font-display text-[13.5px] font-bold text-shop-red hover:underline"
						>
							{active.cta} →
						</a>
						<button
							type="button"
							onclick={close}
							class="border-[1.5px] border-shop-border bg-shop-subtle px-2.5 py-1.5 text-[13px] font-bold text-shop-muted hover:border-shop-ink"
						>
							Fermer ✕
						</button>
					</div>
				</div>

				<!-- Colonnes en cascade : un niveau de l'arborescence par colonne -->
				<div class="flex gap-px overflow-x-auto bg-shop-border">
					{#each columns as column, depth (column.title + depth)}
						<div class="min-w-[196px] flex-1 shrink-0 basis-52 bg-white">
							<p
								class="px-3.5 pt-3.5 pb-2 font-display text-[11px] font-extrabold tracking-[0.12em] text-shop-faint uppercase"
							>
								{column.title}
							</p>
							<div class="max-h-[352px] overflow-y-auto pb-3">
								{#each column.items as entry (entry.id)}
									{@const deeper = (entry.children?.length ?? 0) > 0}
									{@const selected = isSelected(depth, entry)}
									{#if deeper}
										<button
											type="button"
											onclick={() => pick(depth, entry)}
											class="flex w-full items-center justify-between gap-2.5 border-l-[3px] px-3.5 py-2 text-left text-sm {selected
												? 'border-shop-red bg-shop-border-soft font-bold text-shop-ink'
												: 'border-transparent text-shop-ink-soft hover:bg-shop-subtle'}"
										>
											<span class="min-w-0 truncate">{entry.name}</span>
											<span
												class="shrink-0 text-[15px] font-bold {selected
													? 'text-shop-blue'
													: 'text-shop-faint'}"
											>
												›
											</span>
										</button>
									{:else}
										<a
											href="/categorie/{entry.slug}"
											class="flex w-full items-center justify-between gap-2.5 border-l-[3px] border-transparent px-3.5 py-2 text-left text-sm text-shop-ink-soft hover:bg-shop-subtle"
										>
											<span class="min-w-0 truncate">{entry.name}</span>
										</a>
									{/if}
								{/each}
							</div>
						</div>
					{/each}
				</div>

				<div
					class="flex flex-wrap items-center justify-between gap-4 py-3 text-[13px] text-shop-muted"
				>
					<span>{active.hint}</span>
					<span>
						Besoin d'aide pour identifier une pièce ?
						<a href="tel:0950922336" class="font-bold text-shop-red hover:underline">
							09 50 92 23 36
						</a>
					</span>
				</div>
			</div>
		</div>

		<!-- Cliquer à côté referme le panneau. -->
		<button
			type="button"
			onclick={close}
			aria-label="Fermer le menu"
			class="fixed inset-0 -z-10 cursor-default"
			tabindex="-1"
		></button>
	{/if}
</div>
