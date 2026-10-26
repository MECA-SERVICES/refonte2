<script lang="ts">
	import { ChevronRightOutline } from 'flowbite-svelte-icons';

	/**
	 * Tuile promotionnelle de l'accueil, à la manière de Kramp (demande client
	 * 10.1) : aplat de couleur ou photo plein cadre, surtitre, grand titre,
	 * visuel, pastille ronde et bouton. Réglée dans « Apparence › Page d'accueil ».
	 */
	let {
		eyebrow = null,
		title,
		imageUrl = null,
		linkUrl,
		buttonLabel,
		tone = 'blue',
		badge = null
	}: {
		eyebrow?: string | null;
		title: string;
		imageUrl?: string | null;
		linkUrl: string;
		buttonLabel: string;
		tone?: string;
		badge?: string | null;
	} = $props();

	const background: Record<string, string> = {
		blue: 'bg-shop-blue',
		red: 'bg-shop-red',
		dark: 'bg-shop-ink',
		photo: 'bg-shop-ink'
	};
	const photo = $derived(tone === 'photo' && Boolean(imageUrl));
</script>

<a
	href={linkUrl}
	class="group relative flex aspect-square flex-col overflow-hidden p-5 text-white xl:p-6 {background[
		tone
	] ?? background.blue}"
>
	{#if photo}
		<img
			src={imageUrl}
			alt=""
			loading="lazy"
			class="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
		/>
		<span class="absolute inset-0 bg-gradient-to-b from-black/60 via-black/10 to-black/45"></span>
	{/if}

	<span class="relative">
		{#if eyebrow}
			<span
				class="block font-display text-xs font-semibold tracking-[0.04em] uppercase opacity-90 xl:text-sm"
			>
				{eyebrow}
			</span>
		{/if}
		<span
			class="mt-1 line-clamp-3 block font-display text-lg leading-[1.15] font-extrabold tracking-[0.01em] uppercase xl:text-2xl"
		>
			{title}
		</span>
	</span>

	<!-- Visuel dans l'espace restant : il ne passe jamais sous le titre. -->
	<span class="relative my-3 min-h-0 flex-1">
		{#if imageUrl && !photo}
			<img
				src={imageUrl}
				alt=""
				loading="lazy"
				class="h-full w-full object-contain object-right-bottom transition-transform duration-300 group-hover:scale-105"
			/>
		{/if}
	</span>

	{#if badge}
		<span
			class="absolute right-5 bottom-5 flex h-16 w-16 items-center justify-center rounded-full bg-shop-red font-display text-sm font-extrabold uppercase shadow-lg xl:h-20 xl:w-20 xl:text-lg"
		>
			{badge}
		</span>
	{/if}

	<span
		class="relative inline-flex w-fit items-center gap-2 rounded-md border-[1.5px] border-white px-4 py-2 font-display text-sm font-bold transition-colors group-hover:bg-white group-hover:text-shop-ink"
	>
		<ChevronRightOutline class="h-4 w-4" />
		{buttonLabel}
	</span>
</a>
