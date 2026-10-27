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
 * Couleur du texte posé sur un fond coloré, avec la règle de PrestaShop
 * (`Tools::getBrightness`) : blanc si la luminosité est sous 128, sinon #383838.
 * Une couleur illisible compte comme foncée, comme dans PrestaShop.
 */
export function textColorOn(background: string): string {
	const hex = background.replace('#', '');
	const full = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex;
	const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
	const brightness = (r * 299 + g * 587 + b * 114) / 1000;
	return brightness >= 128 ? '#383838' : 'white';
}
