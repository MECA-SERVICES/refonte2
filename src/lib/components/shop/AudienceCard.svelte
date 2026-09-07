<script lang="ts">
	/**
	 * Carte « porte d'entrée » : à qui l'on s'adresse, ce qu'on propose, et la
	 * condition tarifaire associée (TTC, HT, devis).
	 */

	let {
		title,
		text,
		detail,
		cta,
		href
	}: {
		title: string;
		text: string;
		/** Mention tarifaire ou de délai, détachée par un filet. */
		detail: string;
		cta: string;
		href: string;
	} = $props();
</script>

<div class="flex flex-col gap-3 border-[1.5px] border-shop-border bg-white p-6">
	<p class="font-display text-xl font-extrabold tracking-tight text-shop-ink">{title}</p>
	<p class="text-[14.5px] leading-relaxed text-shop-ink-soft">{text}</p>
	<p class="border-t border-shop-border-soft pt-3 text-[13px] text-shop-muted">{detail}</p>
	<a {href} class="font-display text-sm font-bold text-shop-red hover:underline">{cta} →</a>
</div>
