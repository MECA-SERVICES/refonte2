/**
 * Couleurs du back-office PrestaShop 1.7.6.1 (prestakit 1.1), reprises pour
 * que l'équipe retrouve ses repères. La palette Tailwind du back-office
 * (`src/routes/layout.css`) utilise les mêmes valeurs.
 */
export const PS_COLORS = {
	primary: '#25b9d7',
	success: '#70b580',
	danger: '#c05c67',
	warning: '#cd9321',
	secondary: '#6c868e',
	dark: '#363a41'
} as const;

/** Couleurs nommées des badges (mêmes noms que ceux de Flowbite). */
export type BadgeColor =
	'primary' | 'secondary' | 'gray' | 'red' | 'green' | 'yellow' | 'blue' | 'indigo' | 'purple';

export const BADGE_COLORS: Record<BadgeColor, string> = {
	primary: PS_COLORS.primary,
	blue: PS_COLORS.primary,
	green: PS_COLORS.success,
	red: PS_COLORS.danger,
	yellow: PS_COLORS.warning,
	secondary: PS_COLORS.secondary,
	gray: PS_COLORS.secondary,
	indigo: PS_COLORS.dark,
	purple: PS_COLORS.dark
};

/**
 * Couleur du texte posé sur un fond coloré : noir ou blanc, celui qui contraste
 * le plus (luminance relative WCAG). La règle de PrestaShop (seuil de luminosité
 * 128, texte #383838) laissait 11 couleurs d'état sur 31 sous 4,5:1.
 * Une couleur illisible donne du blanc, comme dans PrestaShop.
 */
export function textColorOn(background: string): string {
	const hex = background.replace('#', '');
	const full = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex;
	const [r, g, b] = [0, 2, 4].map((i) => {
		const channel = parseInt(full.slice(i, i + 2), 16) / 255;
		return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
	});
	const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
	const onBlack = (luminance + 0.05) / 0.05;
	const onWhite = 1.05 / (luminance + 0.05);
	return onBlack > onWhite ? 'black' : 'white';
}
