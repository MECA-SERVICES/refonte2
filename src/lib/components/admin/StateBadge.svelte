<script lang="ts">
	import { BADGE_COLORS, textColorOn, type BadgeColor } from '$lib/admin-colors';

	/**
	 * Pastille au style de PrestaShop 1.7.6.1 (`span.label.color_field`) :
	 * fond plein, texte blanc ou gris foncé selon la couleur.
	 * `color` accepte une couleur nommée (« green ») ou hexadécimale (état de commande).
	 */
	let {
		label,
		color = 'gray',
		class: className = ''
	}: { label: string; color?: BadgeColor | (string & {}); class?: string } = $props();

	const background = $derived(BADGE_COLORS[color as BadgeColor] ?? color);
</script>

<span
	class="inline-block rounded-[.25em] px-[.4em] py-[.15em] text-xs leading-none whitespace-nowrap {className}"
	style:background-color={background}
	style:color={textColorOn(background)}
>
	{label}
</span>
