/** Helpers partagés de la vitrine (utilisables côté client comme côté serveur). */

/** Carte produit telle qu'exposée par les services vitrine ($lib/server/shop). */
export type ProductCard = {
	id: number;
	name: string;
	slug: string;
	reference: string;
	stock: number;
	priceTtc: string;
	priceTtcStrike: string | null;
	brandName: string | null;
	imageUrl: string | null;
};

/** URL canonique d'une fiche produit (id + slug, sur le modèle de l'ancienne boutique). */
export function shopProductPath(p: { id: number; slug: string }): string {
	return `/produit/${p.id}-${p.slug}`;
}

const eur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });

/** Formate un prix (chaîne numeric SQL ou nombre) en euros : « 1 234,56 € ». */
export function formatPrice(value: string | number): string {
	return eur.format(Number(value));
}
