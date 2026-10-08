/**
 * Nature des catégories du catalogue : machines, accessoires, ou autre.
 *
 * Partagé entre la boutique (une catégorie de machines n'affiche que des
 * machines) et le script de rangement `scripts/fix-catalog-classification.ts`,
 * qui type les produits avec la même règle. Sans dépendance : importable par
 * les scripts, qui ne résolvent pas l'alias `$lib`.
 */

/** Branches de « Produits » dont les catégories rangent des machines. */
export const MACHINE_BRANCH_SLUGS = [
	'motoculture',
	'electroportatif',
	'machines-de-travaux-public'
];

/** Libellé de catégorie désignant des accessoires ou consommables, pas des machines. */
export const ACCESSORY_CATEGORY =
	/ACCES|BATTER|CHARGEUR|LAME|MECHE|BOUGIE|COURROIE|DURITE|FIL|HUILE|ROULEMENT|JOUET|OUTILS DE JARDIN|OUTILS POUR|COFFRET|ENSEMBLE D'OUTILS|LAMPE|ENCEINTE|RADIO|MACHINE A CAFE|GONFLEUR/;

/** Majuscules, sans accents, espaces simples : base de comparaison des libellés. */
export function normalizeLabel(value: string): string {
	return (value ?? '')
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toUpperCase()
		.replace(/[’']/g, "'")
		.replace(/\s+/g, ' ')
		.trim();
}

export type CategoryKind = 'machine' | 'accessory' | 'other';

/**
 * Nature d'une catégorie d'après sa lignée (de la racine vers elle) :
 * « machine » dans une branche machine sans libellé d'accessoire, « accessory »
 * dans une branche machine sous un libellé d'accessoire, « other » ailleurs.
 */
export function categoryKind(chain: { slug: string; name: string }[]): CategoryKind {
	const inMachineBranch = chain.some((c) => MACHINE_BRANCH_SLUGS.includes(c.slug));
	if (!inMachineBranch) return 'other';
	const accessory = chain.some((c) => ACCESSORY_CATEGORY.test(normalizeLabel(c.name)));
	return accessory ? 'accessory' : 'machine';
}
