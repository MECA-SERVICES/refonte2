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
					{ name: 'Vis anglaises', keywords: ['SCREW', 'HHCS'] }
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
					{ name: 'Rondelles', keywords: ['RONDELLE', 'WASHER', 'RDLE'] },
					{ name: 'Cales & shims', keywords: ['SHIM', 'CALE'] }
				]
			},
			{
				name: 'Goupilles & circlips',
				children: [
					{ name: 'Goupilles', keywords: ['GOUPILLE', 'PIN', 'EPINGLE', 'CHEVILLE'] },
					{
						name: 'Circlips & anneaux',
						keywords: ['CIRCLIP', 'CIRCLIPS', 'ANNEAU', 'RING', 'SNAP', 'RETAINING']
					},
					{ name: 'Clips & agrafes', keywords: ['CLIP', 'AGRAFE', 'CLIPS'] }
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
				children: [{ name: 'Roulements', keywords: ['ROULEMENT', 'BEARING', 'BILLE'] }]
			},
			{
				name: 'Paliers',
				children: [{ name: 'Paliers & flasques', keywords: ['PALIER', 'FLASQUE'] }]
			},
			{
				name: 'Bagues & douilles',
				children: [
					{ name: 'Bagues', keywords: ['BAGUE', 'BUSHING', 'BUSH', 'BAQUE', 'COLLAR'] },
					{ name: 'Douilles', keywords: ['DOUILLE'] },
					{ name: 'Coussinets', keywords: ['COUSSINET'] },
					{ name: 'Manchons', keywords: ['MANCHON', 'SLEEVE'] }
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
					{ name: 'Joints plats', keywords: ['JOINT', 'GASKET', 'SEALING'] },
					{ name: 'Joints spi', keywords: ['SEAL'] }
				]
			},
			{
				name: 'Joints toriques',
				children: [
					{ name: 'Joints toriques', keywords: ['O-RING', 'ORING', 'TORIQUE', "O'RING", 'JO'] }
				]
			},
			{
				name: 'Membranes',
				children: [
					{ name: 'Membranes & garnitures', keywords: ['MEMBRANE', 'GARNITURE', 'SOUFFLET'] }
				]
			}
		]
	},
	{
		name: 'Transmission',
		children: [
			{
				name: 'Courroies',
				children: [
					{ name: 'Courroies trapézoïdales', keywords: ['COURROIE', 'BELT', 'V-BELT'] },
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
					{ name: 'Pignons', keywords: ['PIGNON', 'SPROCKET', 'PINION'] },
					{
						name: 'Engrenages',
						keywords: ['ENGRENAGE', 'GEAR', 'RENVOI', 'GEARBOX', 'GEARCASE']
					}
				]
			},
			{
				name: 'Arbres & cardans',
				children: [
					{ name: 'Arbres', keywords: ['ARBRE', 'SHAFT'] },
					{ name: 'Cardans & PDF', keywords: ['CARDAN', 'PTO'] },
					{ name: 'Essieux', keywords: ['ESSIEU', 'AXLE', 'FUSEE'] }
				]
			},
			{
				name: 'Embrayages',
				children: [{ name: 'Embrayages', keywords: ['EMBRAYAGE', 'CLUTCH', 'CLOCHE'] }]
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
					{ name: 'Durites', keywords: ['DURITE', 'DURIT'] },
					{ name: 'Tuyaux', keywords: ['TUYAU', 'PIPE', 'CONDUITE', 'CONDUIT', 'TUBULURE'] }
				]
			},
			{
				name: 'Raccords',
				children: [
					{ name: 'Raccords', keywords: ['RACCORD', 'RACC', 'FITTING', 'TEE', 'REDUCTION'] },
					{ name: 'Coudes', keywords: ['COUDE', 'ELBOW'] },
					{ name: 'Bouchons hydrauliques', keywords: ['PLUG', 'NIPPLE', 'GRAISSEUR'] }
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
					{ name: 'Vannes', keywords: ['VANNE', 'VALVE', 'ROBINET'] },
					{ name: 'Clapets', keywords: ['CLAPET'] },
					{ name: 'Distributeurs', keywords: ['DISTRIBUTEUR', 'MANIFOLD'] }
				]
			},
			{
				name: 'Buses & gicleurs',
				children: [
					{ name: 'Buses', keywords: ['BUSE', 'NOZZLE', 'LANCE', 'DIFFUSEUR'] },
					{ name: 'Gicleurs', keywords: ['GICLEUR', 'JET-MAIN'] }
				]
			},
			{
				name: 'Instruments',
				children: [
					{ name: 'Manomètres & jauges', keywords: ['MANOMETRE', 'JAUGE', 'INDICATEUR'] },
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
					{ name: 'Câbles', keywords: ['CABLE', 'CORDON'] },
					{ name: 'Faisceaux', keywords: ['FAISCEAU', 'HARNESS', 'CABLAGE', 'WIRING'] },
					{ name: 'Fils', keywords: ['FIL', 'WIRE'] }
				]
			},
			{
				name: 'Composants électriques divers',
				// `ELEC.` (3 163) : abréviation d'import, tronquée par PrestaShop.
				// Le mot ne dit pas quel composant, seulement qu'il est électrique —
				// d'où ce nœud d'attente, à affiner au palier 4.
				children: [
					{
						name: 'Composants électriques',
						keywords: ['ELEC', 'CONDENSATEUR', 'REGULATEUR', 'CIRCUIT']
					}
				]
			},
			{
				name: 'Commande électrique',
				children: [
					{ name: 'Interrupteurs', keywords: ['INTERRUPTEUR', 'SWITCH', 'COMMUTATEUR'] },
					{ name: 'Contacteurs & relais', keywords: ['CONTACTEUR', 'RELAIS', 'RELAY'] }
				]
			},
			{
				name: 'Éclairage',
				children: [
					{ name: 'Phares & feux', keywords: ['FEU', 'PHARE', 'GYROPHARE', 'CABOCHON'] },
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
					{ name: 'Capteurs & sondes', keywords: ['CAPTEUR', 'SENSOR', 'SONDE', 'THERMOSTAT'] },
					{ name: 'Modules', keywords: ['MODULE', 'CARTE', 'CONTROLEUR'] }
				]
			},
			{
				name: 'Connectique',
				children: [
					{
						name: 'Connecteurs & fiches',
						keywords: ['CONNECTEUR', 'FICHE', 'PRISE', 'COSSE', 'TERMINAL', 'CONNECTOR']
					},
					{ name: 'Fusibles', keywords: ['FUSIBLE'] }
				]
			},
			{
				name: 'Moteurs électriques',
				children: [
					{
						name: 'Rotors & stators',
						keywords: ['ROTOR', 'STATOR', 'INDUIT', 'INDUCTEUR', 'ARMATURE']
					},
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
				children: [
					{
						name: 'Carburateurs',
						keywords: ['CARBURATEUR', 'CARBURETOR-ASSY', 'CARBURETOR', 'CARBURETTOR', 'FLOTTEUR']
					}
				]
			},
			{
				name: 'Bas moteur',
				children: [
					{ name: 'Pistons & segments', keywords: ['PISTON', 'SEGMENT'] },
					{ name: 'Cylindres', keywords: ['CYLINDRE', 'CYLINDER'] },
					{ name: 'Vilebrequins & bielles', keywords: ['VILEBREQUIN', 'BIELLE', 'CRANKSHAFT'] }
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
				children: [
					{ name: 'Silencieux & pots', keywords: ['SILENCIEUX', 'ECHAPPEMENT', 'POT', 'MUFFLER'] }
				]
			},
			{
				name: 'Moteurs complets',
				children: [{ name: 'Moteurs', keywords: ['MOTEUR', 'ENGINE', 'MOTOR'] }]
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
					{ name: 'Lames', keywords: ['LAME', 'BLADE', 'LAM', 'SCRAPER', 'RACLEUR'] },
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
					{ name: 'Forets & mèches', keywords: ['FORET', 'DRILL', 'MECHE', 'MANDRIN'] },
					{ name: 'Fraises', keywords: ['FRAISE'] },
					{ name: 'Pointes', keywords: ['POINTE'] }
				]
			},
			{
				name: 'Dents & socs',
				children: [
					{ name: 'Dents', keywords: ['DENT', 'TOOTH', 'TINE'] },
					{ name: 'Socs', keywords: ['SOC', 'COUTRE', 'RASETTE'] }
				]
			},
			{
				name: 'Guides',
				children: [{ name: 'Guides & mâchoires', keywords: ['GUIDE', 'MACHOIRE', 'GUIDAGE'] }]
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
					{ name: 'Capots', keywords: ['CAPOT', 'HOOD', 'SHROUD-ENGINE', 'COUVERTURE'] },
					{
						name: 'Couvercles',
						keywords: ['COUVERCLE', 'COVER', 'CACHE', 'CAPOTAGE', 'LID', 'ENJOLIVEUR']
					}
				]
			},
			{
				name: 'Tôlerie',
				children: [
					{ name: 'Tôles & plaques', keywords: ['TOLE', 'PLAQUE', 'PLATE', 'SHEET'] },
					{ name: 'Panneaux', keywords: ['PANNEAU'] },
					// Ajouté le 2026-10-13 (rangement de « À classer ») : ~300 fiches.
					{ name: 'Garde-boue & ailes', keywords: ['GARDE-BOUE', 'AILE'] }
				]
			},
			{
				name: 'Protections',
				children: [
					{
						name: 'Protections & carters de sécurité',
						keywords: ['PROTECTION', 'PROTECTEUR', 'GUARD', 'SHIELD', 'PROTEGE', 'CURTAIN']
					},
					{ name: 'Grilles', keywords: ['GRILLE'] },
					{ name: 'Déflecteurs', keywords: ['DEFLECTEUR', 'DEFLECTOR', 'BAVETTE', 'FLAP', 'CHUTE'] }
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
					{ name: 'Châssis & cadres', keywords: ['CHASSIS', 'CADRE', 'FRAME', 'POUTRE', 'BEAM'] },
					{ name: 'Corps & bases', keywords: ['CARCASSE', 'CORPS', 'BASE'] }
				]
			},
			{
				name: 'Vitrage & portes',
				children: [
					{ name: 'Vitres', keywords: ['VITRE', 'GLACE', 'PARE-BRISE'] },
					{ name: 'Portes', keywords: ['PORTE'] }
				]
			},
			// Ajoutés le 2026-10-13 (rangement de « À classer ») : les autocollants
			// et étiquettes constructeur (~15 000 fiches Kuhn, Husqvarna, Makita…)
			// n'avaient aucun rayon, ni les sièges.
			{
				name: 'Marquage',
				children: [
					{
						name: 'Autocollants & étiquettes',
						keywords: [
							'DECAL',
							'AUTOCOLLANT',
							'ETIQUETTE',
							'ETIQ',
							'ETIQ.ADH',
							'LABEL',
							'LABEL-BRAND',
							'STICKER',
							'ADESIVO'
						]
					}
				]
			},
			{
				name: 'Habitacle',
				children: [{ name: 'Sièges & ceintures', keywords: ['SEAT', 'CEINTURE'] }]
			}
		]
	},
	{
		name: 'Commandes',
		children: [
			{
				name: 'Leviers',
				children: [
					{
						name: 'Leviers & manettes',
						keywords: ['LEVIER', 'LEVER', 'MANETTE', 'COMMANDE', 'GACHETTE']
					}
				]
			},
			{
				name: 'Poignées',
				children: [
					{ name: 'Poignées', keywords: ['POIGNEE', 'HANDLE', 'MANCHE'] },
					{ name: 'Guidons', keywords: ['GUIDON'] }
				]
			},
			{
				name: 'Boutons',
				children: [{ name: 'Boutons', keywords: ['BOUTON', 'KNOB', 'MOLETTE'] }]
			},
			{
				name: 'Tringlerie',
				children: [
					{ name: 'Tringles & biellettes', keywords: ['TRINGLE', 'ROD', 'BIELLETTE'] },
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
					{
						name: 'Supports',
						keywords: ['SUPPORT', 'BRACKET', 'MOUNT', 'BRKT', 'EQUERRE', 'BEQUILLE']
					},
					{ name: 'Pattes & étriers', keywords: ['PATTE', 'ETRIER'] },
					{ name: 'Brides', keywords: ['BRIDE', 'FLANGE'] },
					{ name: 'Fixations', keywords: ['FIXATION', 'ATTACHMENT'] }
				]
			},
			{
				name: 'Bras & tiges',
				children: [
					{ name: 'Bras', keywords: ['BRAS', 'ARM'] },
					{ name: 'Tiges & barres', keywords: ['TIGE', 'BARRE', 'BAR', 'TIRANT', 'ROUND'] }
				]
			},
			{
				name: 'Tubes',
				children: [{ name: 'Tubes & profilés', keywords: ['TUBE', 'PROFILE', 'ACIER', 'RAIL'] }]
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
				children: [{ name: 'Entretoises', keywords: ['ENTRETOISE', 'SPACER', 'ESPACEUR'] }]
			},
			{
				name: 'Adaptateurs',
				children: [
					{ name: 'Adaptateurs', keywords: ['ADAPTATEUR', 'ADAPTER'] },
					{ name: 'Embouts', keywords: ['EMBOUT'] },
					{ name: 'Crochets & blocs', keywords: ['CROCHET', 'BLOC', 'EXTENSION'] }
				]
			},
			// Ajoutés le 2026-10-13 (rangement de « À classer »).
			{
				name: 'Charnières & verrous',
				children: [
					{
						name: 'Charnières & verrous',
						keywords: ['CHARNIERE', 'HINGE', 'VERROU', 'VERROUILLAGE', 'LATCH']
					}
				]
			},
			{
				name: 'Attelage',
				children: [{ name: 'Attelages', keywords: ['ATTELAGE', 'HITCH'] }]
			}
		]
	},
	{
		name: 'Ressorts & suspension',
		children: [
			{
				name: 'Ressorts',
				children: [{ name: 'Ressorts', keywords: ['RESSORT', 'SPRING', 'PRINTEMPS'] }]
			},
			{
				name: 'Amortisseurs',
				children: [
					{ name: 'Amortisseurs', keywords: ['AMORTISSEUR', 'DAMPER'] },
					{ name: 'Silentblocs & tampons', keywords: ['SILENTBLOC', 'TAMPON', 'SILENT'] }
				]
			}
		]
	},
	{
		name: 'Roues, pneus & freinage',
		children: [
			{
				name: 'Roues',
				children: [{ name: 'Roues & jantes', keywords: ['ROUE', 'WHEEL', 'JANTE', 'RIM'] }]
			},
			{
				name: 'Pneumatiques',
				children: [{ name: 'Pneus & chambres', keywords: ['PNEU', 'TYRE', 'CHAMBRE', 'TIRE'] }]
			},
			{
				name: 'Freinage',
				children: [
					{ name: 'Tambours & freins', keywords: ['TAMBOUR', 'FREIN', 'PLAQUETTE', 'BRAKE'] }
				]
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
				children: [
					{ name: 'Bouchons & capuchons', keywords: ['BOUCHON', 'CAP', 'CAPUCHON', 'OBTURATEUR'] }
				]
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
						keywords: ['VENTILATEUR', 'FAN', 'TURBINE', 'PLATEAU', 'VOLUTE', 'HOUSING-FAN']
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
				children: [{ name: 'Kits de réparation', keywords: ['KIT', 'SET', 'POCHETTE', 'SACHET'] }]
			},
			{
				name: 'Jeux & ensembles',
				children: [
					{
						name: 'Jeux & ensembles',
						keywords: ['JEU', 'ENSEMBLE', 'ENS', 'PIECE', 'ASSEMBLAGE']
					}
				]
			}
		]
	},
	/**
	 * Outillage à main — arbitrage n°1 du §6.2, tranché le 2026-08-08.
	 *
	 * Mesuré sur la source : la feuille KRAMP « Outillage à main » porte à elle
	 * seule **17 346 produits** qu'aucune règle ne classait — CLE (3 853),
	 * TOURNEVIS (1 189), PINCE (1 041). Ce sont des outils, pas des pièces
	 * détachées ; les ranger dans « Structure » ou « Commandes » aurait été faux.
	 */
	{
		name: 'Outillage à main',
		children: [
			{
				name: 'Outillage à main',
				children: [
					{
						name: 'Outils à main',
						keywords: ['CLE', 'TOURNEVIS', 'PINCE', 'MARTEAU', 'BURIN', 'LIME', 'SCIE', 'COFFRET']
					},
					{ name: 'Douilles & embouts', keywords: ['EMBOUTS'] }
				]
			},
			{
				name: 'Équipement d’atelier',
				children: [
					{ name: 'Soudage', keywords: ['ELECTRODES', 'SOUDURE'] },
					{ name: 'Peinture & consommables', keywords: ['PEINTURE', 'PINCEAU', 'AEROSOL'] },
					{ name: 'Lubrifiants & entretien', keywords: ['HUILE', 'GRAISSE', 'NETTOYANT', 'COLLE'] }
				]
			}
		]
	},
	/**
	 * EPI — ~4 700 produits KRAMP (vêtements, gants, chaussures, casques) plus
	 * les 383 de la branche boutique. Isolés ici pour ne pas polluer les
	 * familles techniques (§5.2 piège n°3).
	 */
	{
		name: 'Équipement de protection',
		children: [
			{
				name: 'EPI',
				children: [
					{
						name: 'Vêtements de travail',
						keywords: ['VESTE', 'PANTALON', 'SALOPETTE', 'COMBINAISON', 'T-SHIRT', 'PARKA']
					},
					{ name: 'Gants', keywords: ['GANTS', 'GANT'] },
					{ name: 'Chaussures & bottes', keywords: ['CHAUSSURES', 'CHAUSSURE', 'BOTTES'] },
					{
						name: 'Protection de la tête',
						keywords: ['CASQUE', 'LUNETTES', 'VISIERE', 'MASQUE']
					}
				]
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
 * Trois nettoyages, chacun mesuré sur la source :
 *
 *  1. **Ponctuation finale.** Les noms sont tronqués à ~30 caractères par
 *     l'import, ce qui laisse des virgules et points (`HOSE,` 1 623,
 *     `PLATE,` 1 284) — ~62 000 produits.
 *
 *  2. **Accents.** Les mots-clés de ce fichier sont écrits sans accents, mais
 *     la source en contient massivement : `CÂBLE` (5 514), `ÉCROU` (3 137),
 *     `POIGNÉE` (2 640), `VÉRIN` (2 160), `CHAÎNE` (1 731)… Sans cette
 *     normalisation, ces produits échappent à leur règle **alors que la règle
 *     existe**. Mesuré le 2026-08-08 sur les 1 053 957 produits :
 *     **27 394 produits récupérés**.
 *
 *  3. **Casse.** Les libellés mélangent `Remplacé Par` et `REMPLACE PAR`.
 */
export function firstWord(name: string): string {
	const raw = (name ?? '').trim().split(/\s+/)[0] ?? '';
	return raw
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '') // diacritiques combinants
		.toUpperCase()
		.replace(/[.,;:]+$/, '');
}
