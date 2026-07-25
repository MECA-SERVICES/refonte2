<script lang="ts">
	/**
	 * Panneau d'onglet pour les formulaires admin.
	 *
	 * Pourquoi ce composant plutôt que le panneau intégré de <Tabs> :
	 * Flowbite ne rend QUE le contenu de l'onglet actif (les autres sont démontés).
	 * Dans un formulaire mono-soumission, les champs des onglets non visibles
	 * disparaîtraient du FormData et le serveur les écraserait avec null.
	 *
	 * Ici tous les panneaux restent montés ; seul l'affichage change. Les champs
	 * cachés sont donc bien envoyés à l'enregistrement.
	 */
	import type { Snippet } from 'svelte';

	let {
		id,
		selected,
		children
	}: {
		id: string;
		selected: string;
		children: Snippet;
	} = $props();

	const active = $derived(selected === id);
</script>

<!--
	`hidden` (et non un démontage) : le champ reste dans le DOM et dans le FormData.
	inert empêche le focus clavier d'atteindre un panneau masqué.
-->
<div
	class={active ? 'space-y-6' : 'hidden'}
	inert={!active}
	role="tabpanel"
	aria-labelledby="tab-{id}"
>
	{@render children()}
</div>
