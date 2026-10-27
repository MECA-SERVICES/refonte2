import type { PageServerLoad } from './$types';
import {
	inStockShopParts,
	inStockShopProducts,
	latestShopProducts,
	machineTypePhotos,
	type MachineType
} from '$lib/server/shop';
import { estimateProductTotal } from '$lib/server/catalog';
import { listPublishedArticles } from '$lib/server/blog';
import { loadHomeContent } from '$lib/server/home';

/** Types de machines de l'accueil, illustrés par une machine réelle du catalogue. */
const MACHINE_TYPES: MachineType[] = [
	{ label: 'Tondeuses', term: 'tondeuse', exclude: ['robot', 'tracteur', 'autoport'] },
	{ label: 'Tracteurs tondeuses', term: 'tracteur tondeuse' },
	{ label: 'Robots de tonte', term: 'robot' },
	{ label: 'Tronçonneuses', term: 'tronçonneuse' },
	{ label: 'Débroussailleuses', term: 'débroussailleuse' },
	{ label: 'Motoculteurs', term: 'motoculteur' },
	{ label: 'Souffleurs', term: 'souffleur' },
	{ label: 'Taille-haies', term: 'taille-haie' }
];

// L'en-tête Cache-Control est posé par le layout boutique, qui porte le panier :
// le redéfinir ici lèverait une erreur (« header is already set »).
export const load: PageServerLoad = async () => {
	const [inStock, latest, parts, productTotal, articles, home, photos] = await Promise.all([
		inStockShopProducts(10),
		latestShopProducts(10),
		inStockShopParts(4),
		estimateProductTotal(),
		listPublishedArticles(),
		// Tuiles, catégories et produits phares réglés en back-office (10.1, 10.3, 10.4).
		loadHomeContent(),
		machineTypePhotos(MACHINE_TYPES)
	]);

	return {
		inStock,
		latest,
		parts,
		productTotal,
		articles: articles.slice(0, 3),
		home,
		machineTypes: MACHINE_TYPES.map(({ label, term }) => ({ label, term, image: photos[label] }))
	};
};
