/**
 * Taxonomie cible des pièces détachées — la table de vérité de la reclassification.
 *
 * Validée par le client le 2026-08-07 (`MIGRATION-CATALOGUE.md` §6.3).
 *
 * ────────────────────────────────────────────────────────────────────────────
 *  Ce fichier est **volontairement séparé du moteur** (`08-reclassify.ts`) :
 *  affiner le classement doit se faire en éditant des données, jamais du code.
 *  Ajouter un mot-clé oublié = une ligne ici, rien d'autre à toucher.
 *
 *  Un mot-clé ne doit apparaître **qu'une seule fois** dans tout le fichier :
 *  le premier mot d'un nom produit désigne une seule famille. Le moteur refuse
 *  de démarrer si un doublon est détecté (voir `assertNoDuplicateKeywords`).
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Couverture mesurée sur les 1 053 957 produits source : **~752 000 classés (71,4 %)**.
 * Le reliquat part en « À classer » et se traite au fil de l'eau (§5.3, palier 4).
 */

/** Feuille de l'arbre : le niveau qui porte les mots-clés. */
export interface TypeRule {
	name: string;
	/**
	 * Premiers mots (MAJUSCULES, sans accents ni ponctuation finale) rangeant un
	 * produit ici. FR et EN mènent à la même feuille — les fournisseurs étrangers
	 * (KRAMP, OPTIBELT, B&S) livrent en anglais (§5.2).
	 */
	keywords: string[];
}

/** Niveau intermédiaire : sous-famille. */
export interface SubFamilyRule {
	name: string;
	children: TypeRule[];
}

/** Niveau 1 sous la racine « Pièces détachées ». */
export interface FamilyRule {
	name: string;
	children: SubFamilyRule[];
}

/**
 * Mots à ne JAMAIS utiliser comme signal : préfixes d'import, codes internes et
 * fragments sans valeur métier, relevés à l'étape 1.
 */
export const NOISE_WORDS = new Set([
	'HIGH',
	'PLUS',
	'(C)',
	'CJ',
	'MANUAL-KHI',
	'WC',
	// `AIR` (1 223) est trop ambigu pour classer : filtre à air, vérin
	// pneumatique, refroidissement… Il ne désigne pas un type de pièce.
	'AIR'
]);

// Note : `ENS.` (1 186) et `ELEC.` (3 163) sont bien des signaux métier —
// abréviations d'« ensemble » et « électrique ». Ils sont rangés par les règles
// (`Kits & ensembles`, `Électrique`) et n'ont donc rien à faire ici.

/**
 * Produits obsolètes : le nom commence par « REMPLACÉ PAR … ».
 * 18 803 produits — désactivés et liés à leur remplaçant, jamais rangés (§5.3 palier 1).
 */
export const OBSOLETE_PREFIXES = ['REMPLACÉ', 'REMPLACE'];

/** Racine des pièces. */
export const PIECES_ROOT = 'Pièces détachées';

/** Racine des produits finis — sa taxonomie est reprise de PrestaShop, pas construite ici. */
export const PRODUCTS_ROOT = 'Produits & machines';

/** Nom du nœud recueillant les produits qu'aucune règle ne classe. */
export const UNCLASSIFIED = 'À classer';

export const PIECE_TAXONOMY: FamilyRule[] = [
	{
		name: 'Visserie & boulonnerie',
		children: [
			{
				name: 'Vis',
				children: [
					{ name: 'Vis à métaux', keywords: ['VIS'] },
					{ name: 'Vis anglaises', keywords: ['SCREW'] }
				]
			},
			{
				name: 'Boulons & goujons',
				children: [
					{ name: 'Boulons', keywords: ['BOULON', 'BOLT'] },
					{ name: 'Goujons & tiges filetées', keywords: ['GOUJON', 'STUD'] }
				]
			},
			{
				name: 'Écrous',
				children: [{ name: 'Écrous', keywords: ['ECROU', 'NUT'] }]
			},
			{
				name: 'Rondelles & cales',
				children: [
					{ name: 'Rondelles', keywords: ['RONDELLE', 'WASHER'] },
					{ name: 'Cales & shims', keywords: ['SHIM', 'CALE'] }
				]
			},
			{
				name: 'Goupilles & circlips',
				children: [
					{ name: 'Goupilles', keywords: ['GOUPILLE', 'PIN'] },
					{ name: 'Circlips & anneaux', keywords: ['CIRCLIP', 'CIRCLIPS', 'ANNEAU', 'RING'] },
					{ name: 'Clips & agrafes', keywords: ['CLIP', 'AGRAFE'] }
				]
			},
			{
				name: 'Rivets & colliers',
				children: [
					{ name: 'Rivets', keywords: ['RIVET'] },
					{ name: 'Colliers de serrage', keywords: ['COLLIER', 'CLAMP'] },
					{ name: 'Attaches', keywords: ['ATTACHE', 'SERRE-CABLE'] }
				]
			},
			{
				name: 'Clavettes',
				children: [{ name: 'Clavettes', keywords: ['CLAVETTE', 'KEY'] }]
			}
		]
	},
	{
		name: 'Roulements & guidage',
		children: [
			{
				name: 'Roulements',
				children: [{ name: 'Roulements', keywords: ['ROULEMENT', 'BEARING'] }]
			},
			{
				name: 'Paliers',
				children: [{ name: 'Paliers & flasques', keywords: ['PALIER', 'FLASQUE'] }]
			},
			{
				name: 'Bagues & douilles',
				children: [
					{ name: 'Bagues', keywords: ['BAGUE', 'BUSHING'] },
					{ name: 'Douilles', keywords: ['DOUILLE'] },
					{ name: 'Coussinets', keywords: ['COUSSINET'] },
					{ name: 'Manchons', keywords: ['MANCHON'] }
				]
			},
			{
				name: 'Moyeux & butées',
				children: [
					{ name: 'Moyeux', keywords: ['MOYEU', 'HUB'] },
					{ name: 'Butées & rotules', keywords: ['BUTEE', 'ROTULE'] }
				]
			},
			{
				name: 'Galets & rouleaux',
				children: [
					{ name: 'Galets', keywords: ['GALET', 'ROLLER'] },
					{ name: 'Rouleaux', keywords: ['ROULEAU'] }
				]
			}
		]
	},
	{
		name: 'Joints & étanchéité',
		children: [
			{
				name: 'Joints',
				children: [
					{ name: 'Joints plats', keywords: ['JOINT', 'GASKET'] },
					{ name: 'Joints spi', keywords: ['SEAL'] }
				]
			},
			{
				name: 'Joints toriques',
				children: [{ name: 'Joints toriques', keywords: ['O-RING', 'ORING', 'TORIQUE'] }]
			},
			{
				name: 'Membranes',
				children: [{ name: 'Membranes & garnitures', keywords: ['MEMBRANE', 'GARNITURE'] }]
			}
		]
	},
	{
		name: 'Transmission',
		children: [
			{
				name: 'Courroies',
				children: [
					{ name: 'Courroies trapézoïdales', keywords: ['COURROIE', 'BELT'] },
					{ name: 'Courroies crantées', keywords: ['TIMING'] },
					{ name: 'Courroies striées', keywords: ['RIBBED', 'KRAFTBANDS', 'POLY-V'] }
				]
			},
			{
				name: 'Chaînes',
				children: [
					{ name: 'Chaînes', keywords: ['CHAINE', 'CHAIN'] },
					{ name: 'Maillons', keywords: ['MAILLON', 'LINK'] }
				]
			},
			{
				name: 'Poulies & pignons',
				children: [
					{ name: 'Poulies', keywords: ['POULIE', 'PULLEY'] },
					{ name: 'Pignons', keywords: ['PIGNON', 'SPROCKET'] },
					{ name: 'Engrenages', keywords: ['ENGRENAGE', 'GEAR'] }
				]
			},
			{
				name: 'Arbres & cardans',
				children: [
					{ name: 'Arbres', keywords: ['ARBRE', 'SHAFT'] },
					{ name: 'Cardans & PDF', keywords: ['CARDAN', 'PTO'] },
					{ name: 'Essieux', keywords: ['ESSIEU', 'AXLE'] }
				]
			},
			{
				name: 'Embrayages',
				children: [{ name: 'Embrayages', keywords: ['EMBRAYAGE', 'CLUTCH'] }]
			},
			{
				name: 'Tendeurs',
				children: [{ name: 'Tendeurs', keywords: ['TENDEUR', 'TENSIONER'] }]
			}
		]
	},
	{
		name: 'Hydraulique & pneumatique',
		children: [
			{
				name: 'Flexibles & durites',
				children: [
					{ name: 'Flexibles', keywords: ['FLEXIBLE', 'HOSE'] },
					{ name: 'Durites', keywords: ['DURITE'] },
					{ name: 'Tuyaux', keywords: ['TUYAU', 'PIPE'] }
				]
			},
			{
				name: 'Raccords',
				children: [
					{ name: 'Raccords', keywords: ['RACCORD', 'RACC', 'FITTING'] },
					{ name: 'Coudes', keywords: ['COUDE'] },
					{ name: 'Bouchons hydrauliques', keywords: ['PLUG', 'NIPPLE'] }
				]
			},
			{
				name: 'Vérins',
				children: [{ name: 'Vérins', keywords: ['VERIN'] }]
			},
			{
				name: 'Pompes',
				children: [{ name: 'Pompes', keywords: ['POMPE', 'PUMP'] }]
			},
			{
				name: 'Vannes & clapets',
				children: [
					{ name: 'Vannes', keywords: ['VANNE', 'VALVE'] },
					{ name: 'Clapets', keywords: ['CLAPET'] },
					{ name: 'Distributeurs', keywords: ['DISTRIBUTEUR'] }
				]
			},
			{
				name: 'Buses & gicleurs',
				children: [
					{ name: 'Buses', keywords: ['BUSE', 'NOZZLE'] },
					{ name: 'Gicleurs', keywords: ['GICLEUR'] }
				]
			},
			{
				name: 'Instruments',
				children: [
					{ name: 'Manomètres & jauges', keywords: ['MANOMETRE', 'JAUGE'] },
					{ name: 'Divers hydraulique', keywords: ['HYDRAULIC'] }
				]
			}
		]
	},
	{
		name: 'Électrique',
		children: [
			{
				name: 'Câblage',
				children: [
					{ name: 'Câbles', keywords: ['CABLE'] },
					{ name: 'Faisceaux', keywords: ['FAISCEAU', 'HARNESS'] },
					{ name: 'Fils', keywords: ['FIL', 'WIRE'] }
				]
			},
			{
				name: 'Composants électriques divers',
				// `ELEC.` (3 163) : abréviation d'import, tronquée par PrestaShop.
				// Le mot ne dit pas quel composant, seulement qu'il est électrique —
				// d'où ce nœud d'attente, à affiner au palier 4.
				children: [{ name: 'Composants électriques', keywords: ['ELEC'] }]
			},
			{
				name: 'Commande électrique',
				children: [
					{ name: 'Interrupteurs', keywords: ['INTERRUPTEUR', 'SWITCH'] },
					{ name: 'Contacteurs & relais', keywords: ['CONTACTEUR', 'RELAIS'] }
				]
			},
			{
				name: 'Éclairage',
				children: [
					{ name: 'Phares & feux', keywords: ['FEU', 'PHARE', 'GYROPHARE'] },
					{ name: 'Ampoules', keywords: ['AMPOULE', 'LAMP', 'LAMPE'] }
				]
			},
			{
				name: 'Énergie',
				children: [
					{ name: 'Batteries', keywords: ['BATTERIE', 'BATTERY'] },
					{ name: 'Chargeurs', keywords: ['CHARGEUR'] }
				]
			},
			{
				name: 'Électronique',
				children: [
					{ name: 'Capteurs & sondes', keywords: ['CAPTEUR', 'SENSOR', 'SONDE'] },
					{ name: 'Modules', keywords: ['MODULE'] }
				]
			},
			{
				name: 'Connectique',
				children: [
					{ name: 'Connecteurs & fiches', keywords: ['CONNECTEUR', 'FICHE', 'PRISE', 'COSSE'] },
					{ name: 'Fusibles', keywords: ['FUSIBLE'] }
				]
			},
			{
				name: 'Moteurs électriques',
				children: [
					{ name: 'Rotors & stators', keywords: ['ROTOR', 'STATOR', 'INDUIT'] },
					{ name: 'Charbons', keywords: ['CHARBON'] }
				]
			}
		]
	},
	{
		name: 'Moteur',
		children: [
			{
				name: 'Allumage',
				children: [
					{ name: 'Bougies', keywords: ['BOUGIE'] },
					{ name: 'Bobines & magnétos', keywords: ['BOBINE', 'ALLUMAGE', 'MAGNETO'] }
				]
			},
			{
				name: 'Carburation',
				children: [{ name: 'Carburateurs', keywords: ['CARBURATEUR'] }]
			},
			{
				name: 'Bas moteur',
				children: [
					{ name: 'Pistons & segments', keywords: ['PISTON', 'SEGMENT'] },
					{ name: 'Cylindres', keywords: ['CYLINDRE', 'CYLINDER'] },
					{ name: 'Vilebrequins & bielles', keywords: ['VILEBREQUIN', 'BIELLE'] }
				]
			},
			{
				name: 'Distribution',
				children: [{ name: 'Culasses & soupapes', keywords: ['CULASSE', 'SOUPAPE'] }]
			},
			{
				name: 'Démarrage',
				children: [
					{ name: 'Démarreurs', keywords: ['DEMARREUR'] },
					{ name: 'Lanceurs', keywords: ['LANCEUR'] },
					{ name: 'Alternateurs & volants', keywords: ['ALTERNATEUR', 'VOLANT'] }
				]
			},
			{
				name: 'Échappement',
				children: [{ name: 'Silencieux & pots', keywords: ['SILENCIEUX', 'ECHAPPEMENT', 'POT'] }]
			},
			{
				name: 'Moteurs complets',
				children: [{ name: 'Moteurs', keywords: ['MOTEUR', 'ENGINE'] }]
			}
		]
	},
	{
		name: 'Filtration',
		children: [
			{
				name: 'Filtres',
				children: [{ name: 'Filtres', keywords: ['FILTRE', 'FILTER'] }]
			},
			{
				name: 'Cartouches',
				children: [{ name: 'Cartouches & éléments', keywords: ['CARTOUCHE', 'ELEMENT'] }]
			}
		]
	},
	{
		name: 'Coupe & usure',
		children: [
			{
				name: 'Lames & couteaux',
				children: [
					{ name: 'Lames', keywords: ['LAME', 'BLADE'] },
					{ name: 'Couteaux', keywords: ['COUTEAU', 'KNIFE'] }
				]
			},
			{
				name: 'Disques',
				children: [{ name: 'Disques', keywords: ['DISQUE', 'DISC'] }]
			},
			{
				name: 'Perçage & fraisage',
				children: [
					{ name: 'Forets & mèches', keywords: ['FORET', 'DRILL', 'MECHE'] },
					{ name: 'Fraises', keywords: ['FRAISE'] },
					{ name: 'Pointes', keywords: ['POINTE'] }
				]
			},
			{
				name: 'Dents & socs',
				children: [
					{ name: 'Dents', keywords: ['DENT', 'TOOTH'] },
					{ name: 'Socs', keywords: ['SOC'] }
				]
			},
			{
				name: 'Guides',
				children: [{ name: 'Guides & mâchoires', keywords: ['GUIDE', 'MACHOIRE'] }]
			},
			{
				name: 'Brosses',
				children: [{ name: 'Brosses', keywords: ['BROSSE', 'BRUSH'] }]
			}
		]
	},
	{
		name: 'Carrosserie & protection',
		children: [
			{
				name: 'Carters & capots',
				children: [
					{ name: 'Carters', keywords: ['CARTER'] },
					{ name: 'Capots', keywords: ['CAPOT', 'HOOD'] },
					{ name: 'Couvercles', keywords: ['COUVERCLE', 'COVER', 'CACHE', 'CAPOTAGE'] }
				]
			},
			{
				name: 'Tôlerie',
				children: [
					{ name: 'Tôles & plaques', keywords: ['TOLE', 'PLAQUE', 'PLATE', 'SHEET'] },
					{ name: 'Panneaux', keywords: ['PANNEAU'] }
				]
			},
			{
				name: 'Protections',
				children: [
					{
						name: 'Protections & carters de sécurité',
						keywords: ['PROTECTION', 'PROTECTEUR', 'GUARD', 'SHIELD']
					},
					{ name: 'Grilles', keywords: ['GRILLE'] },
					{ name: 'Déflecteurs', keywords: ['DEFLECTEUR'] }
				]
			},
			{
				name: 'Boîtiers',
				children: [
					{ name: 'Boîtiers & logements', keywords: ['BOITIER', 'HOUSING', 'LOGEMENT'] },
					{ name: 'Boîtes & consoles', keywords: ['BOITE', 'CONSOLE', 'PLATINE'] }
				]
			},
			{
				name: 'Châssis',
				children: [
					{ name: 'Châssis & cadres', keywords: ['CHASSIS', 'CADRE', 'FRAME'] },
					{ name: 'Corps & bases', keywords: ['CARCASSE', 'CORPS', 'BASE'] }
				]
			},
			{
				name: 'Vitrage & portes',
				children: [
					{ name: 'Vitres', keywords: ['VITRE', 'GLACE'] },
					{ name: 'Portes', keywords: ['PORTE'] }
				]
			}
		]
	},
	{
		name: 'Commandes',
		children: [
			{
				name: 'Leviers',
				children: [
					{ name: 'Leviers & manettes', keywords: ['LEVIER', 'LEVER', 'MANETTE', 'COMMANDE'] }
				]
			},
			{
				name: 'Poignées',
				children: [
					{ name: 'Poignées', keywords: ['POIGNEE', 'HANDLE'] },
					{ name: 'Guidons', keywords: ['GUIDON'] }
				]
			},
			{
				name: 'Boutons',
				children: [{ name: 'Boutons', keywords: ['BOUTON', 'KNOB'] }]
			},
			{
				name: 'Tringlerie',
				children: [
					{ name: 'Tringles & biellettes', keywords: ['TRINGLE', 'ROD'] },
					{ name: 'Pédales', keywords: ['PEDALE'] }
				]
			},
			{
				name: 'Supports de commande',
				children: [{ name: 'Têtes & porte-outils', keywords: ['TETE', 'HOLDER'] }]
			}
		]
	},
	{
		name: 'Structure & fixation',
		children: [
			{
				name: 'Supports',
				children: [
					{ name: 'Supports', keywords: ['SUPPORT', 'BRACKET'] },
					{ name: 'Pattes & étriers', keywords: ['PATTE', 'ETRIER'] },
					{ name: 'Brides', keywords: ['BRIDE', 'FLANGE'] },
					{ name: 'Fixations', keywords: ['FIXATION'] }
				]
			},
			{
				name: 'Bras & tiges',
				children: [
					{ name: 'Bras', keywords: ['BRAS', 'ARM'] },
					{ name: 'Tiges & barres', keywords: ['TIGE', 'BARRE', 'BAR'] }
				]
			},
			{
				name: 'Tubes',
				children: [{ name: 'Tubes & profilés', keywords: ['TUBE', 'PROFILE'] }]
			},
			{
				name: 'Axes & pivots',
				children: [
					{ name: 'Axes', keywords: ['AXE'] },
					{ name: 'Pivots', keywords: ['PIVOT'] }
				]
			},
			{
				name: 'Entretoises',
				children: [{ name: 'Entretoises', keywords: ['ENTRETOISE', 'SPACER'] }]
			},
			{
				name: 'Adaptateurs',
				children: [
					{ name: 'Adaptateurs', keywords: ['ADAPTATEUR', 'ADAPTER'] },
					{ name: 'Embouts', keywords: ['EMBOUT'] },
					{ name: 'Crochets & blocs', keywords: ['CROCHET', 'BLOC', 'EXTENSION'] }
				]
			}
		]
	},
	{
		name: 'Ressorts & suspension',
		children: [
			{
				name: 'Ressorts',
				children: [{ name: 'Ressorts', keywords: ['RESSORT', 'SPRING'] }]
			},
			{
				name: 'Amortisseurs',
				children: [
					{ name: 'Amortisseurs', keywords: ['AMORTISSEUR', 'DAMPER'] },
					{ name: 'Silentblocs & tampons', keywords: ['SILENTBLOC', 'TAMPON'] }
				]
			}
		]
	},
	{
		name: 'Roues, pneus & freinage',
		children: [
			{
				name: 'Roues',
				children: [{ name: 'Roues & jantes', keywords: ['ROUE', 'WHEEL', 'JANTE'] }]
			},
			{
				name: 'Pneumatiques',
				children: [{ name: 'Pneus & chambres', keywords: ['PNEU', 'TYRE', 'CHAMBRE'] }]
			},
			{
				name: 'Freinage',
				children: [{ name: 'Tambours & freins', keywords: ['TAMBOUR', 'FREIN', 'PLAQUETTE'] }]
			}
		]
	},
	{
		name: 'Réservoirs & contenants',
		children: [
			{
				name: 'Réservoirs',
				children: [{ name: 'Réservoirs & cuves', keywords: ['RESERVOIR', 'TANK', 'CUVE'] }]
			},
			{
				name: 'Bouchons',
				children: [{ name: 'Bouchons & capuchons', keywords: ['BOUCHON', 'CAP', 'CAPUCHON'] }]
			},
			{
				name: 'Sacs & bacs',
				children: [{ name: 'Sacs & bacs', keywords: ['SAC', 'BAG', 'BAC'] }]
			}
		]
	},
	{
		name: 'Refroidissement',
		children: [
			{
				name: 'Ventilation',
				children: [
					{
						name: 'Ventilateurs & turbines',
						keywords: ['VENTILATEUR', 'FAN', 'TURBINE', 'PLATEAU']
					}
				]
			},
			{
				name: 'Radiateurs',
				children: [{ name: 'Radiateurs', keywords: ['RADIATEUR', 'RADIATOR'] }]
			}
		]
	},
	{
		name: 'Kits & ensembles',
		children: [
			{
				name: 'Kits',
				children: [{ name: 'Kits de réparation', keywords: ['KIT', 'SET'] }]
			},
			{
				name: 'Jeux & ensembles',
				children: [{ name: 'Jeux & ensembles', keywords: ['JEU', 'ENSEMBLE', 'ENS', 'PIECE'] }]
			}
		]
	}
];

/**
 * Vérifie qu'aucun mot-clé n'est réclamé par deux feuilles.
 *
 * Un doublon rendrait le classement dépendant de l'ordre de parcours — donc
 * instable d'une exécution à l'autre. Mieux vaut échouer au démarrage que
 * ranger 30 000 produits au mauvais endroit.
 */
export function assertNoDuplicateKeywords(taxonomy: FamilyRule[] = PIECE_TAXONOMY): void {
	const seen = new Map<string, string>();
	const duplicates: string[] = [];

	for (const family of taxonomy) {
		for (const sub of family.children) {
			for (const type of sub.children) {
				for (const keyword of type.keywords) {
					const path = `${family.name} > ${sub.name} > ${type.name}`;
					const previous = seen.get(keyword);
					if (previous) {
						duplicates.push(`« ${keyword} » réclamé par « ${previous} » et « ${path} »`);
					} else {
						seen.set(keyword, path);
					}
				}
			}
		}
	}

	if (duplicates.length > 0) {
		throw new Error(`Taxonomie invalide — mots-clés en doublon :\n  ${duplicates.join('\n  ')}`);
	}
}

/** Index plat mot-clé → chemin complet, construit une fois au démarrage. */
export function buildKeywordIndex(
	taxonomy: FamilyRule[] = PIECE_TAXONOMY
): Map<string, { family: string; subFamily: string; type: string }> {
	assertNoDuplicateKeywords(taxonomy);

	const index = new Map<string, { family: string; subFamily: string; type: string }>();
	for (const family of taxonomy) {
		for (const sub of family.children) {
			for (const type of sub.children) {
				for (const keyword of type.keywords) {
					index.set(keyword, { family: family.name, subFamily: sub.name, type: type.name });
				}
			}
		}
	}
	return index;
}

/**
 * Normalise le premier mot d'un nom produit pour la comparaison.
 *
 * Les noms sont tronqués à ~30 caractères par l'import, ce qui laisse des
 * virgules et points en fin de mot (`HOSE,` 1 623, `PLATE,` 1 284). Sans ce
 * nettoyage, ces variantes échappent aux règles — ~62 000 produits à elles seules.
 */
export function firstWord(name: string): string {
	const raw = (name ?? '').trim().split(/\s+/)[0] ?? '';
	return raw.toUpperCase().replace(/[.,;:]+$/, '');
}
