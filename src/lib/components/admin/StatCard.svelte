<script lang="ts">
	import { Card } from 'flowbite-svelte';
	import type { Component } from 'svelte';
	import { formatNumber } from '$lib/money';

	let {
		label,
		value,
		icon,
		href,
		hint
	}: {
		label: string;
		value: string | number;
		icon?: Component;
		href?: string;
		/** Précision sous la valeur : période, mode de calcul. */
		hint?: string;
	} = $props();

	const Icon = $derived(icon);
</script>

<Card class="p-5" {href}>
	<div class="flex items-center justify-between gap-3">
		<div class="min-w-0">
			<p class="text-sm font-medium text-gray-500">{label}</p>
			<p class="mt-1 text-3xl font-bold text-gray-900">
				{typeof value === 'number' ? formatNumber(value) : value}
			</p>
			{#if hint}
				<p class="mt-1 text-xs text-gray-500">{hint}</p>
			{/if}
		</div>
		{#if Icon}
			<div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-cyan-100">
				<Icon class="h-6 w-6 text-cyan-600" />
			</div>
		{/if}
	</div>
</Card>
