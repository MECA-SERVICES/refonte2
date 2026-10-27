<script lang="ts">
	import type { BadgeColor } from '$lib/admin-colors';
	import StateBadge from './StateBadge.svelte';

	let {
		value,
		map = {},
		fallbackColor = 'gray'
	}: {
		value: string | null | undefined;
		map?: Record<string, { label: string; color: BadgeColor }>;
		fallbackColor?: BadgeColor;
	} = $props();

	const entry = $derived(value ? map[value] : undefined);
</script>

<StateBadge label={entry?.label ?? value ?? '—'} color={entry?.color ?? fallbackColor} />
