<script lang="ts">
	let { children } = $props();
</script>

<!-- `admin-theme` active les couleurs du back-office PrestaShop (layout.css). -->
<div class="admin-theme">
	{@render children()}
</div>
