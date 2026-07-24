<script lang="ts">
	import { Card } from 'flowbite-svelte';
	import type { Component } from 'svelte';

	let {
		label,
		value,
		icon,
		href
	}: {
		label: string;
		value: string | number;
		icon?: Component;
		href?: string;
	} = $props();

	const Icon = $derived(icon);
</script>

<Card class="p-5" {href}>
	<div class="flex items-center justify-between">
		<div>
			<p class="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</p>
			<p class="mt-1 text-3xl font-bold text-gray-900 dark:text-white">{value}</p>
		</div>
		{#if Icon}
			<div
				class="flex h-12 w-12 items-center justify-center rounded-lg bg-cyan-100 dark:bg-cyan-900"
			>
				<Icon class="h-6 w-6 text-cyan-600 dark:text-cyan-300" />
			</div>
		{/if}
	</div>
</Card>
