<script lang="ts">
	import StateBadge from './StateBadge.svelte';

	let { active }: { active: boolean } = $props();
</script>

<StateBadge label={active ? 'Actif' : 'Inactif'} color={active ? 'green' : 'gray'} />
