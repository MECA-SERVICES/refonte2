<script lang="ts">
	let { label, color }: { label: string; color: string } = $props();
</script>

<span
	class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
	style="background-color: {color}"
>
	{label}
</span>
