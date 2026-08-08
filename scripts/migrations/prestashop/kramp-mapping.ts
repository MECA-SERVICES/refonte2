/**
 * KRAMP — suppression du silo fournisseur, rattachement à l'arbre commun.
 *
 * ────────────────────────────────────────────────────────────────────────────
 *  Décision client (2026-08-08) : « la catégorie KRAMP doit être supprimée,
 *  c'est comme une marque ; les catégories à l'intérieur doivent rejoindre le
 *  reste de l'arborescence. »
 *
 *  KRAMP (`id_category` 7057) est un **catalogue fournisseur importé tel quel** :
 *  480 catégories sur 3 niveaux, 169 006 produits, qui dupliquent des notions
 *  déjà présentes ailleurs (`Roulements`, `Filtres`, `Gants`, `Raccords`).
 *  C'est la règle n°5 du §4.1 : catalogue fournisseur ≠ catalogue boutique.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * ── Pourquoi un mapping, et pas seulement les règles du premier mot ────────
 *
 *  Mesuré le 2026-08-08 en lecture seule sur `prod5`, sur les 169 006 produits
 *  KRAMP : les règles du premier mot n'en classent que **59,1 %**. Les
 *  **68 956 restants (40,8 %)** finiraient en « À classer ».
 *
 *  Or le libellé KRAMP est un signal **plus fiable que le premier mot** —
 *  chaque feuille est thématiquement homogène :
 *
 *      Vêtements et protection (EPI) > Gants      →  GANTS(701) GANT(53)
 *      Hydraulique > Coupleurs                    →  COUPLEUR(489) COUPLEURS(65)
 *      Entraînement > Roulements                  →  ROULEMENTS(626)
 *      Outillage et équipement d'atelier > …      →  CLÉ(3664) TOURNEVIS(1189)
 *
 *  Le §5.4 l'avait anticipé : « KRAMP > Hydraulique & Entraînement → famille
 *  Hydraulique, plus fiable que le premier mot du nom ».
 *
 * ── Ordre d'application (voir `09-reclassify.ts`) ──────────────────────────
 *
 *  Le premier mot reste **prioritaire** : il décrit le produit lui-même, donc
 *  il est plus précis quand il matche (« COURROIE » → Courroies trapézoïdales,
 *  là où KRAMP ne dirait que « Entraînement »). Le mapping ci-dessous n'est
 *  consulté **qu'en repli**, pour les produits qu'aucune règle ne classe.
 */

/**
 * Sous-famille KRAMP (niveau 4) → chemin dans l'arbre des pièces.
 *
 * La cible est donnée en `Famille > Sous-famille > Type` **tel qu'il existe
 * dans `taxonomy.ts`** : le mapping ne crée aucune catégorie, il ne fait que
 * pointer vers l'arbre commun. Un chemin inexistant fait échouer le démarrage
 * (`assertKrampTargetsExist`), plutôt que de ranger dans le vide.
 *
 * Les sous-familles sans équivalent propre dans l'arbre des pièces (Jouets,
 * Élevage, Agencement de magasin…) sont volontairement **absentes** : ce ne
 * sont pas des pièces détachées, elles partent en « À classer » où elles
 * seront traitées au palier 4 plutôt que rangées de force.
 */
export const KRAMP_SUBFAMILY_MAP: Record<string, string> = {
	// ── Hydraulique & pneumatique ──────────────────────────────────────────
	Hydraulique: 'Hydraulique & pneumatique > Raccords > Raccords',
	Pneumatique: 'Hydraulique & pneumatique > Raccords > Raccords',
	'Irrigation & réserve d’eau': 'Hydraulique & pneumatique > Pompes > Pompes',
	"Irrigation & réserve d'eau": 'Hydraulique & pneumatique > Pompes > Pompes',

	// ── Transmission ───────────────────────────────────────────────────────
	// « Entraînement » couvre roulements, cardans, chaînes et courroies : on
	// vise le nœud le plus général de la transmission, le premier mot
	// affinera quand il le peut.
	'Entraînement': 'Transmission > Arbres & cardans > Arbres',

	// ── Électrique ─────────────────────────────────────────────────────────
	'Électronique': 'Électrique > Câblage > Câbles',
	'Électronique embarquée': 'Électrique > Câblage > Faisceaux',

	// ── Coupe & usure ──────────────────────────────────────────────────────
	'Travail du sol': 'Coupe & usure > Dents & socs > Socs',

	// ── Filtration ─────────────────────────────────────────────────────────
	Filtration: 'Filtration > Filtres > Filtres',

	// ── Visserie ───────────────────────────────────────────────────────────
	'Boulonnerie & quincaillerie': 'Visserie & boulonnerie > Écrous > Écrous',

	// ── Structure ──────────────────────────────────────────────────────────
	'Pièces de véhicule': 'Structure & fixation > Supports > Supports',
	'Pièces pour excavatrice': 'Structure & fixation > Supports > Supports',
	'Pièces pour chargeur frontal': 'Structure & fixation > Supports > Supports',
	'Pièces de cabine': 'Carrosserie & protection > Boîtiers > Boîtiers & logements',

	// ── Moteur ─────────────────────────────────────────────────────────────
	'Alternateurs et démarreurs': 'Moteur > Démarrage > Alternateurs & volants',
	'Environnement moteur': 'Moteur > Moteurs complets > Moteurs',
	'Pièces de moteur': 'Moteur > Moteurs complets > Moteurs',

	// ── Réservoirs ─────────────────────────────────────────────────────────
	'Fertilisation & lisier': 'Réservoirs & contenants > Réservoirs > Réservoirs & cuves',

	// ── Refroidissement / éclairage ────────────────────────────────────────
	'Éclairage': 'Électrique > Éclairage > Phares & feux',

	// ── Outillage à main ───────────────────────────────────────────────────
	// Le plus gros reliquat mesuré (17 346 produits) : CLE(3853),
	// TOURNEVIS(1189), PINCE(1041). Ce sont des outils, pas des pièces — d'où
	// le nœud dédié créé dans `taxonomy.ts`.
	"Outillage et équipement d'atelier": 'Outillage à main > Outillage à main > Outils à main',
	'Outillage et équipement d’atelier': 'Outillage à main > Outillage à main > Outils à main',

	// ── EPI ────────────────────────────────────────────────────────────────
	// ~4 700 produits : vêtements, gants, chaussures, casques. Non plus des
	// pièces : ils rejoignent le nœud EPI.
	'Vêtements et protection (EPI)': 'Équipement de protection > EPI > Vêtements de travail'
};

/**
 * Feuilles KRAMP (niveau 5) au mapping plus précis que leur sous-famille.
 *
 * Ne contient que les feuilles où le gain est **mesuré et net** : une feuille
 * « Gants » (794 produits) mérite d'aller dans les EPI, pas dans un nœud
 * générique. Clé = libellé exact de la feuille source.
 */
export const KRAMP_LEAF_MAP: Record<string, string> = {
	Roulements: 'Roulements & guidage > Roulements > Roulements',
	'Transmissions à cardan (PTO)': 'Transmission > Arbres & cardans > Cardans & PDF',
	'Chaînes techniques': 'Transmission > Chaînes > Chaînes',
	"Courroies d'entraînement": 'Transmission > Courroies > Courroies trapézoïdales',
	Raccords: 'Hydraulique & pneumatique > Raccords > Raccords',
	'Tuyaux & raccords': 'Hydraulique & pneumatique > Flexibles & durites > Tuyaux',
	'Tuyaux et raccords': 'Hydraulique & pneumatique > Flexibles & durites > Tuyaux',
	Coupleurs: 'Hydraulique & pneumatique > Raccords > Raccords',
	'Vérins et accessoires': 'Hydraulique & pneumatique > Vérins > Vérins',
	'Pompes & moteurs': 'Hydraulique & pneumatique > Pompes > Pompes',
	Pompes: 'Hydraulique & pneumatique > Pompes > Pompes',
	'Pompes à eau': 'Hydraulique & pneumatique > Pompes > Pompes',
	'Distributeurs & composants en ligne':
		'Hydraulique & pneumatique > Vannes & clapets > Distributeurs',
	Distributeurs: 'Hydraulique & pneumatique > Vannes & clapets > Distributeurs',
	"Compresseurs d'air": 'Hydraulique & pneumatique > Pompes > Pompes',
	Filtres: 'Filtration > Filtres > Filtres',
	'Fils et Câbles': 'Électrique > Câblage > Câbles',
	'Appareillage industriel': 'Électrique > Commande électrique > Interrupteurs',
	'Batteries et accessoires': 'Électrique > Énergie > Batteries',
	'Composants électriques d’atelier': 'Électrique > Câblage > Câbles',
	"Composants électriques d'atelier": 'Électrique > Câblage > Câbles',
	'Éclairages': 'Électrique > Éclairage > Phares & feux',
	Charrues: 'Coupe & usure > Dents & socs > Socs',
	Cultivateurs: 'Coupe & usure > Dents & socs > Dents',
	Herses: 'Coupe & usure > Dents & socs > Dents',
	Fraises: 'Coupe & usure > Perçage & fraisage > Fraises',
	'Déchaumeurs à disques': 'Coupe & usure > Disques > Disques',
	'Abrasifs et outils de coupe': 'Coupe & usure > Disques > Disques',
	'Produits carbure': 'Coupe & usure > Dents & socs > Dents',
	Quincailleries: 'Visserie & boulonnerie > Écrous > Écrous',
	'Colliers de serrage et Fixations de tubes':
		'Visserie & boulonnerie > Rivets & colliers > Colliers de serrage',
	'Chaînes longues et câbles': 'Transmission > Chaînes > Chaînes',
	Moteurs: 'Moteur > Moteurs complets > Moteurs',
	'Ponts-avant et directions': 'Transmission > Arbres & cardans > Essieux',
	'Pièces de cabines': 'Carrosserie & protection > Boîtiers > Boîtiers & logements',

	// ── EPI : feuilles plus précises que la sous-famille ───────────────────
	Gants: 'Équipement de protection > EPI > Gants',
	'Chaussures et bottes': 'Équipement de protection > EPI > Chaussures & bottes',
	'Casques et masques respiratoires': 'Équipement de protection > EPI > Protection de la tête',
	Vêtements: 'Équipement de protection > EPI > Vêtements de travail',
	'Vêtement Kramp': 'Équipement de protection > EPI > Vêtements de travail',

	// ── Outillage : feuilles plus précises ─────────────────────────────────
	'Outillage à main': 'Outillage à main > Outillage à main > Outils à main',
	'Outillage à main KRAMP': 'Outillage à main > Outillage à main > Outils à main',
	'Outillage énergisé': 'Outillage à main > Outillage à main > Outils à main',
	'Soudage et brasage': 'Outillage à main > Équipement d’atelier > Soudage',
	'Peinture & accessoires': 'Outillage à main > Équipement d’atelier > Peinture & consommables',
	'Produits de nettoyage': 'Outillage à main > Équipement d’atelier > Lubrifiants & entretien',
	'Équipement pour carburants et lubrifiants':
		'Outillage à main > Équipement d’atelier > Lubrifiants & entretien'
};

/** Sépare un chemin `A > B > C` en ses trois niveaux. */
export function splitTarget(path: string): { family: string; subFamily: string; type: string } {
	const parts = path.split('>').map((p) => p.trim());
	if (parts.length !== 3) {
		throw new Error(`Chemin KRAMP invalide (3 niveaux attendus) : « ${path} »`);
	}
	return { family: parts[0]!, subFamily: parts[1]!, type: parts[2]! };
}

/**
 * Résout un produit KRAMP vers un chemin de l'arbre commun.
 *
 * La feuille (niveau 5) prime sur la sous-famille (niveau 4) : elle est plus
 * précise. Retourne `null` si aucune correspondance — le produit part alors en
 * « À classer », ce qui est préférable à un rangement arbitraire.
 */
export function resolveKrampPath(subFamily: string, leaf: string): string | null {
	return KRAMP_LEAF_MAP[leaf?.trim() ?? ''] ?? KRAMP_SUBFAMILY_MAP[subFamily?.trim() ?? ''] ?? null;
}

/**
 * Vérifie au démarrage que toutes les cibles existent dans `taxonomy.ts`.
 *
 * Sans ce contrôle, une faute de frappe dans un chemin enverrait silencieusement
 * des milliers de produits nulle part — le mode de défaillance exact qui a causé
 * les 81 % d'orphelins.
 */
export function assertKrampTargetsExist(knownPaths: Set<string>): void {
	const missing: string[] = [];

	for (const [key, path] of Object.entries({ ...KRAMP_SUBFAMILY_MAP, ...KRAMP_LEAF_MAP })) {
		if (!knownPaths.has(path)) missing.push(`« ${key} » → « ${path} »`);
	}

	if (missing.length > 0) {
		throw new Error(
			`Mapping KRAMP : ${missing.length} cible(s) absente(s) de la taxonomie :\n  ${missing.join('\n  ')}`
		);
	}
}
