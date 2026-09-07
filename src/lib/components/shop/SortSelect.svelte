<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { Select } from 'flowbite-svelte';

	let { sort }: { sort: string } = $props();

	const items = [
		{ value: 'new', name: 'Nouveautés' },
		{ value: 'price_asc', name: 'Prix croissant' },
		{ value: 'price_desc', name: 'Prix décroissant' },
		{ value: 'name', name: 'Nom (A-Z)' }
	];

	/** Change le tri en conservant les autres paramètres, et repart page 1. */
	function apply(event: Event) {
		const target = `${page.url.pathname}${buildQuery(
			(event.currentTarget as HTMLSelectElement).value
		)}`;
		goto(target, { keepFocus: true, noScroll: true });
	}

	/** Recompose la query string sans muter l'URL de la page courante. */
	function buildQuery(value: string) {
		const entries = [...page.url.searchParams.entries()].filter(
			([key]) => key !== 'tri' && key !== 'page'
		);
		entries.push(['tri', value]);
		return `?${new URLSearchParams(entries)}`;
	}
</script>

<label class="flex items-center gap-2 text-sm text-shop-muted">
	<span class="shrink-0">Trier par</span>
	<Select {items} value={sort} onchange={apply} size="sm" class="w-44" />
</label>
