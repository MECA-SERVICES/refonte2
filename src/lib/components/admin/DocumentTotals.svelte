<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Card } from 'flowbite-svelte';
	import { formatPrice } from '$lib/money';

	/**
	 * Totaux d'une facture comptoir ou d'un devis : HT, TVA par taux, TTC.
	 * `children` ajoute ses lignes dessous (réglé, reste à payer…).
	 */

	let {
		totalHt,
		totalTtc,
		taxBreakdown,
		children
	}: {
		totalHt: string;
		totalTtc: string;
		taxBreakdown: { rate: number; baseHt: number; taxAmount: number }[];
		children?: Snippet;
	} = $props();
</script>

<Card class="max-w-none p-5">
	<dl class="space-y-1.5 text-sm">
		<div class="flex justify-between">
			<dt class="text-gray-600">Total HT</dt>
			<dd class="tabular-nums">{formatPrice(totalHt)}</dd>
		</div>
		{#each taxBreakdown as t (t.rate)}
			<div class="flex justify-between text-xs">
				<dt class="text-gray-500">TVA {t.rate} % sur {formatPrice(t.baseHt)}</dt>
				<dd class="tabular-nums">{formatPrice(t.taxAmount)}</dd>
			</div>
		{/each}
		<div class="flex justify-between border-t border-gray-200 pt-2 text-base font-semibold">
			<dt>Total TTC</dt>
			<dd class="tabular-nums">{formatPrice(totalTtc)}</dd>
		</div>
		{@render children?.()}
	</dl>
</Card>
