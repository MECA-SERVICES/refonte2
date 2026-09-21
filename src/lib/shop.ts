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
	/** Vrai si la vignette est le logo de la marque, faute de photo produit. */
	imageIsBrandLogo?: boolean;
};

/** URL canonique d'une fiche produit (id + slug, sur le modèle de l'ancienne boutique). */
export function shopProductPath(p: { id: number; slug: string }): string {
	return `/produit/${p.id}-${p.slug}`;
}

// Le formatage des prix vit dans $lib/money ; ré-exporté ici par commodité
// pour les composants vitrine qui importent déjà depuis $lib/shop.
export { formatPrice } from '$lib/money';
