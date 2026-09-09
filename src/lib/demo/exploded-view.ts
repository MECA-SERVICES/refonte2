/**
 * Jeu de démonstration des vues éclatées — CDC sections 13 et 38.
 *
 * Les planches techniques ne sont pas encore produites (elles supposent un
 * travail de découpe fournisseur décrit en section 38). Ces données figurent
 * l'écran cible tel que dessiné dans la maquette, pour valider le parcours et
 * l'ergonomie avant d'engager la production des planches.
 *
 * Elles sont volontairement isolées ici : le jour où les vraies planches
 * arrivent, seul le chargeur de page change.
 */

/** Une pièce de la planche, repérée par son numéro sur le plan. */
export type ExplodedPart = {
	/** Numéro de repère, commun au plan et au tableau. */
	mark: number;
	name: string;
	reference: string;
	priceHt: number;
	availability: string;
	/** Position du repère sur la planche, en pourcentage (x, y). */
	x: number;
	y: number;
};

export type ExplodedPlate = {
	slug: string;
	label: string;
	machine: string;
	brand: string;
	family: string;
	parts: ExplodedPart[];
};

/**
 * Planche de démonstration.
 *
 * Les prix sont hors taxes : le mode d'affichage du visiteur décide de ce qui
 * est présenté (CDC 03, P2).
 */
export const DEMO_PLATE: ExplodedPlate = {
	slug: 'husqvarna-550-xp-mark-ii-carter-embrayage',
	label: "Planche 04 — Carter d'embrayage & frein de chaîne",
	machine: '550 XP® Mark II',
	brand: 'Husqvarna',
	family: 'Tronçonneuses',
	parts: [
		{
			mark: 1,
			name: "Carter d'embrayage",
			reference: '537 29 44-02',
			priceHt: 35.75,
			availability: 'En stock',
			x: 22,
			y: 30
		},
		{
			mark: 2,
			name: 'Embrayage complet',
			reference: '537 04 34-02',
			priceHt: 57.08,
			availability: 'En stock',
			x: 46,
			y: 22
		},
		{
			mark: 3,
			name: 'Pignon de chaîne 3/8" 7 dents',
			reference: '505 09 87-25',
			priceHt: 20.75,
			availability: 'En stock',
			x: 64,
			y: 40
		},
		{
			mark: 4,
			name: 'Ruban de frein de chaîne',
			reference: '537 04 39-01',
			priceHt: 15.33,
			availability: 'Sous 48 h',
			x: 34,
			y: 58
		},
		{
			mark: 5,
			name: 'Ressort de frein',
			reference: '503 20 03-01',
			priceHt: 5.17,
			availability: 'En stock',
			x: 55,
			y: 68
		},
		{
			mark: 6,
			name: 'Tendeur de chaîne',
			reference: '537 25 84-02',
			priceHt: 10.67,
			availability: 'En stock',
			x: 76,
			y: 60
		},
		{
			mark: 7,
			name: 'Kit visserie carter (x4)',
			reference: '503 22 03-40',
			priceHt: 8.0,
			availability: 'En stock',
			x: 18,
			y: 74
		}
	]
};

/** Autres planches de la même machine, proposées au sélecteur. */
export const DEMO_PLATES = [
	DEMO_PLATE.label,
	'Planche 01 — Cylindre & piston',
	'Planche 02 — Carburateur & filtre à air',
	'Planche 06 — Guide & graissage'
];

/** Arborescence du sélecteur : marque → type de machine → modèle. */
export const DEMO_BRANDS = [
	'Husqvarna',
	'Stihl',
	'Honda',
	'Briggs & Stratton',
	'Kubota',
	'Etesia',
	'Iseki',
	'Anova'
];

export const DEMO_TYPES = [
	'Tronçonneuses',
	'Tondeuses',
	'Tracteurs tondeuses',
	'Débroussailleuses',
	'Taille-haies',
	'Souffleurs'
];

/**
 * Modèles par type de machine.
 *
 * `default` sert de repli : la démonstration reste cohérente quel que soit le
 * chemin choisi, sans exiger une matrice complète marque × type.
 */
export const DEMO_MODELS: Record<string, string[]> = {
	Tronçonneuses: ['550 XP® Mark II', '572 XP®', '135 Mark II', 'T540 XP® Mark III'],
	Tondeuses: ['LC 247S', 'LB 146S', 'Aspire™ LC34'],
	'Tracteurs tondeuses': ['TC 138', 'TS 146TXD', 'Rider 216T AWD'],
	default: ['Modèle A', 'Modèle B', 'Modèle C']
};

/** Nombre de références couvertes par la machine, affiché au sélecteur. */
export const DEMO_PART_COUNT = 212;

/** Questions fréquentes du sélecteur, reprises de la maquette. */
export const FINDER_HELP = [
	{
		title: 'Où trouver le numéro de série ?',
		text: 'Sur la plaque rivetée du carter, sous le châssis pour les tondeuses, sur le bloc moteur pour les autoportées.'
	},
	{
		title: 'Photo de la plaque moteur',
		text: 'Envoyez-la par message : on identifie le modèle et on vous renvoie les références exactes le jour même.'
	},
	{
		title: 'Référence remplacée ?',
		text: "Les constructeurs changent régulièrement les références. On applique l'équivalence d'origine à jour."
	}
];
