<script lang="ts">
	import { Badge } from 'flowbite-svelte';

	type BadgeColor =
		'primary' | 'secondary' | 'gray' | 'red' | 'green' | 'yellow' | 'indigo' | 'purple' | 'blue';

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
	const label = $derived(entry?.label ?? value ?? '—');
	const color = $derived(entry?.color ?? fallbackColor);
</script>

<Badge {color} rounded>{label}</Badge>
