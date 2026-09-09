<script lang="ts">
	import { page } from '$app/state';
	import type { ShopMenuChild } from '$lib/server/shop';

	/**
	 * Navigation principale en méga-menu.
	 *
	 * Le panneau affiche d'emblée toutes les familles du rayon, en colonnes, avec
	 * leurs sous-familles listées dessous. Aucune n'est masquée derrière un clic :
	 * le visiteur embrasse l'offre d'un regard et atteint sa destination en une
	 * seule action — le titre de colonne, un sous-lien, ou le « Voir tout ».
	 */

	type Section = {
		id: string;
		label: string;
		href: string;
		cta: string;
		hint: string;
		families: ShopMenuChild[];
	};

	let { sections }: { sections: Section[] } = $props();

	/** Section ouverte ; `null` quand le panneau est replié. */
	let openId = $state<string | null>(null);
	const active = $derived(sections.find((s) => s.id === openId) ?? null);

	/** Nombre de sous-familles listées sous chaque famille. */
	const SUB_LIMIT = 6;

	/** Accès directs, à droite de la barre. */
	const shortcuts = [
		{ label: 'Vues éclatées', href: '/vue-eclatee' },
		{ label: 'Promos', href: '/recherche' },
		{ label: 'SAV & atelier', href: '/compte' }
	];

	const toggle = (id: string) => (openId = openId === id ? null : id);
	const close = () => (openId = null);

	/**
	 * Le panneau se referme dès que l'URL change : la navigation SvelteKit ne
	 * recharge pas la page, il resterait donc ouvert par-dessus la destination.
	 */
	const location = $derived(page.url.pathname + page.url.search);
	$effect(() => {
		if (location) close();
	});
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && close()} />

<nav class="relative z-40 bg-shop-blue" aria-label="Navigation du catalogue" onmouseleave={close}>
	<div
		class="mx-auto flex w-full max-w-[1360px] flex-wrap items-stretch justify-between gap-0.5 px-4 sm:px-6 lg:px-8"
	>
		<div class="flex flex-wrap gap-0.5">
			{#each sections as section (section.id)}
				<button
					type="button"
					onclick={() => toggle(section.id)}
					onmouseenter={() => (openId = section.id)}
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
			{#each shortcuts as shortcut (shortcut.href)}
				<a
					href={shortcut.href}
					class="px-3.5 py-4 font-display text-[13px] font-semibold tracking-[0.04em] text-white uppercase hover:underline"
				>
					{shortcut.label}
				</a>
			{/each}
		</div>
	</div>

	{#if active}
		<div
			class="absolute inset-x-0 top-full max-h-[70vh] overflow-y-auto border-b-[3px] border-shop-blue bg-white shadow-[0_18px_40px_rgba(30,36,54,0.18)]"
		>
			<div class="mx-auto w-full max-w-[1360px] px-4 py-6 sm:px-6 lg:px-8">
				<!--
					Toutes les familles côte à côte. Le titre de colonne mène à la
					famille entière, les liens en dessous aux sous-familles.
				-->
				<div class="grid gap-x-8 gap-y-7 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
					{#each active.families as family (family.id)}
						{@const subs = family.children ?? []}
						<div class="min-w-0">
							<a
								href="/categorie/{family.slug}"
								class="block font-display text-[15px] font-extrabold text-shop-ink hover:text-shop-blue"
							>
								{family.name}
								<span aria-hidden="true" class="text-shop-faint">→</span>
							</a>

							{#if subs.length > 0}
								<ul class="mt-2 space-y-1">
									{#each subs.slice(0, SUB_LIMIT) as sub (sub.id)}
										<li>
											<a
												href="/categorie/{sub.slug}"
												class="block truncate text-[13.5px] text-shop-ink-soft hover:text-shop-blue hover:underline"
											>
												{sub.name}
											</a>
										</li>
									{/each}

									{#if subs.length > SUB_LIMIT}
										<li>
											<a
												href="/categorie/{family.slug}"
												class="block text-[13.5px] font-bold text-shop-blue hover:underline"
											>
												Tout {family.name.toLowerCase()} ({subs.length})
											</a>
										</li>
									{/if}
								</ul>
							{/if}
						</div>
					{/each}
				</div>

				<div
					class="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-shop-border pt-4 text-[13px] text-shop-muted"
				>
					<a
						href={active.href}
						class="font-display text-[13.5px] font-bold text-shop-red hover:underline"
					>
						{active.cta} →
					</a>
					<span>
						Besoin d'aide pour identifier une pièce ?
						<a href="tel:0950922336" class="font-bold text-shop-red hover:underline">
							09 50 92 23 36
						</a>
					</span>
				</div>
			</div>
		</div>
	{/if}
</nav>
