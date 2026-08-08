/**
 * Nœuds-marques à écarter de l'arbre de navigation.
 *
 * ────────────────────────────────────────────────────────────────────────────
 *  Règle n°1 du cahier des charges (§4.1) : « si un nœud contient une marque,
 *  un modèle ou une année dans son nom, il n'a rien à faire dans l'arbre ».
 *
 *  Elle vaut pour les pièces **comme pour les produits**. Une catégorie-marque
 *  recrée sous elle tout l'arbre des types, et duplique la navigation :
 *
 *      Motoculture > EGO POWER+ > TONDEUSES       (17)   ← doublon
 *      Motoculture > Tondeuses                    (272)  ← le vrai nœud
 *      Motoculture > EGO POWER+ > TRONCONNEUSES   (21)   ← doublon
 *      Motoculture > Tronçonneuses                (167)  ← le vrai nœud
 *
 *  La marque n'est pas perdue pour autant : elle vit dans `product.brand_id`,
 *  renseigné pour 99,7 % du catalogue, et sert d'axe de navigation à part
 *  entière (page marque), jamais de rangement.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * ── Pourquoi une liste explicite plutôt qu'une détection automatique ───────
 *
 *  Le croisement automatique avec les 1 117 marques de `ps_manufacturer` a été
 *  mesuré : il produit **deux faux positifs** (`Laser & télémètre` et
 *  `Niveau laser` sont des types d'outils, pas la marque « LASER ») et **rate
 *  deux vrais cas** (`FAG` et `Giraphe` ne sont pas déclarés comme marques).
 *
 *  Sur une décision structurante — supprimer un nœud et redistribuer ses
 *  produits — une heuristique à 4 erreurs sur 15 n'est pas acceptable. La liste
 *  ci-dessous est donc validée à la main, avec la mesure en regard.
 */

/** Un nœud de l'arbre source à ne pas reprendre, et ce qu'on fait de ses produits. */
export interface BrandNode {
	/** `ps_category.id_category` du nœud à écarter. */
	legacyPsId: number;
	/** Nom source, pour la lisibilité des rapports. */
	name: string;
	/** Produits sous ce nœud (mesure du 2026-08-07), pour vérifier l'ordre de grandeur. */
	products: number;
	/** Pourquoi ce nœud est écarté. */
	reason: string;
	/**
	 * Où repartent ses produits :
	 *  - `parent`   : remontés au parent du nœud (le vrai type est au-dessus)
	 *  - `pieces`   : ce sont des pièces, ils repartent dans le tri par règles
	 *  - `drop`     : nœud technique vide ou résiduel, rien à redistribuer
	 */
	redirect: 'parent' | 'pieces' | 'drop';
}

/**
 * Liste validée le 2026-08-07 (décision client : « les marques ne devraient pas
 * être des catégories, il faut ranger par produits »).
 *
 * Total : ~21 700 produits redistribués.
 */
export const BRAND_NODES: BrandNode[] = [
	{
		legacyPsId: 518,
		name: 'Pieces MAKITA - DOLMAR',
		products: 14214,
		reason: "Marque, et ce sont des pièces : n'a rien à faire sous « Électroportatif »",
		redirect: 'pieces'
	},
	{
		legacyPsId: 519,
		name: 'ACCESSOIRES MAKITA',
		products: 5862,
		reason: 'Marque — accessoires et pièces MAKITA',
		redirect: 'pieces'
	},
	{
		legacyPsId: 3833,
		name: 'EGO POWER+',
		products: 363,
		reason:
			'Marque — ses 25 sous-nœuds dupliquent Tondeuses, Tronçonneuses, Taille-haies… du même arbre',
		redirect: 'parent'
	},
	{
		legacyPsId: 3848,
		name: 'OUTILS WOLF',
		products: 150,
		reason: 'Marque (absente de ps_manufacturer, donc indétectable automatiquement)',
		redirect: 'parent'
	},
	{
		legacyPsId: 298,
		name: 'Roulement FAG',
		products: 1032,
		reason: 'Marque de roulements (absente de ps_manufacturer)',
		redirect: 'parent'
	},
	{
		legacyPsId: 319,
		name: 'Roulement SKF',
		products: 13,
		reason: 'Marque de roulements',
		redirect: 'parent'
	},
	{
		legacyPsId: 4127,
		name: 'Ponceuse murale Giraphe',
		products: 4,
		reason: 'Nom commercial de gamme, pas un type de ponceuse',
		redirect: 'parent'
	},
	{
		legacyPsId: 520,
		name: 'ONGLET IMPORT MACHINES',
		products: 63,
		reason: "Résidu technique d'import, pas une catégorie métier",
		redirect: 'parent'
	},
	// Pages promotionnelles : un nœud par opération commerciale, avec la marque
	// et le modèle dans le nom. Ce sont des landing pages, pas du rangement.
	{
		legacyPsId: 3708,
		name: 'promo-broyeurs-iseki',
		products: 1,
		reason: 'Page promo (marque + modèle dans le nom)',
		redirect: 'parent'
	},
	{
		legacyPsId: 3719,
		name: 'promo-souffleurs-aspirateurs-solo-by-al-ko',
		products: 1,
		reason: 'Page promo',
		redirect: 'parent'
	},
	{
		legacyPsId: 3720,
		name: 'promo-souffleurs-iseki',
		products: 1,
		reason: 'Page promo',
		redirect: 'parent'
	},
	{
		legacyPsId: 3721,
		name: 'promo-taille-haies-163-solo-by-al-ko',
		products: 1,
		reason: 'Page promo',
		redirect: 'parent'
	},
	{
		legacyPsId: 3722,
		name: 'promo-iht24d56-iseki',
		products: 0,
		reason: 'Page promo vide',
		redirect: 'drop'
	},
	{
		legacyPsId: 3723,
		name: 'promo-ipht27h165n-iseki',
		products: 0,
		reason: 'Page promo vide',
		redirect: 'drop'
	}
];

/** Index par `legacy_ps_id`, pour le filtrage pendant la reprise de l'arbre. */
export const BRAND_NODE_IDS = new Set(BRAND_NODES.map((n) => n.legacyPsId));

/**
 * Nœuds dont les produits sont des pièces déguisées en produits finis.
 * Ils ne sont pas remontés au parent : ils repartent dans le tri par règles.
 */
export const PIECES_NODE_IDS = new Set(
	BRAND_NODES.filter((n) => n.redirect === 'pieces').map((n) => n.legacyPsId)
);
