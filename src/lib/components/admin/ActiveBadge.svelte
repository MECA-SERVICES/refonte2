<script lang="ts">
	import { Badge } from 'flowbite-svelte';

	let { active }: { active: boolean } = $props();
</script>

<Badge color={active ? 'green' : 'gray'} rounded>
	{active ? 'Actif' : 'Inactif'}
</Badge>
