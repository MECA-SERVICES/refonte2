/**
 * Synonymes métier de la recherche.
 *
 * Meilisearch ne fait ni racinisation ni rapprochement de sens : « courroie »
 * ne trouve « Timing belts » que si on le lui dit. Deux sources de décalage
 * entre ce que tape le client et ce qu'écrit la fiche, mesurées sur le
 * catalogue (comptes du 13/10/2026, produits actifs) :
 *
 * 1. **La langue du fournisseur.** Kramp, Husqvarna, Optibelt, Briggs &
 *    Stratton… livrent leurs désignations en anglais, parfois en allemand ou
 *    en italien : 18 250 « belts », 9 731 « screw », 2 579 « schraube »,
 *    8 358 « decal ». Sans traduction, la moitié des courroies est invisible.
 * 2. **Le vocabulaire du client.** « disqueuse » pour meuleuse, « rotofil »
 *    pour coupe-bordure, « tracteur tondeuse » pour autoportée.
 *
 * Règles de saisie :
 * - chaque groupe est réciproque : chaque expression appelle toutes les autres ;
 * - sans accent, en minuscules ;
 * - une expression ne joue que si ses mots se suivent, mots vides compris ;
 * - côté client, sans mot vide : les variantes avec mots de liaison sont
 *   générées (`joinerVariants`) — « savon main » se déclenche aussi sur
 *   « savon à main », « savon pour main », et « filtre air » sur « filtre d'air » ;
 * - côté fiche, telle qu'elle est rédigée : « nettoyant mains » n'atteint pas
 *   « Nettoyant pour mains », on ajoute donc « nettoyant pour mains » au groupe ;
 * - préférer l'expression précise au mot seul quand le mot est ambigu :
 *   « savon » ⇄ « nettoyant » ferait remonter les nettoyants freins, « plate »
 *   (anglais : plaque) capterait les « rondelles plates », « valve » (anglais :
 *   soupape) les valves de pneu, « starter » le starter du carburateur.
 *
 * Après modification : `bun run search:settings` (aucune réindexation), puis
 * `bun run search:eval` pour vérifier qu'aucun cas n'a régressé.
 */

/** Groupes d'expressions équivalentes, par famille. */
export const SYNONYM_GROUPS: string[][] = [
	// -------------------------------------------------------------------------
	// Pièces : français ⇄ langues des fournisseurs (anglais, allemand, italien)
	// -------------------------------------------------------------------------
	['courroie', 'courroies', 'belt', 'belts'],
	['courroie trapezoidale', 'v belt', 'wedge belt', 'wedge belts'],
	['courroie crantee', 'courroie dentee', 'courroie distribution', 'timing belt', 'timing belts'],
	['vis', 'screw', 'schraube'],
	['vis hexagonale', 'vis tete hexagonale', 'hex screw', 'sechskantschraube'],
	['ecrou', 'nut', 'mutter'],
	['boulon', 'bolt'],
	['rondelle', 'washer', 'scheibe'],
	['ressort', 'spring', 'feder'],
	['roulement', 'roulements', 'bearing'],
	['joint', 'seal', 'gasket', 'dichtung'],
	['joint torique', 'o ring', 'oring'],
	['entretoise', 'spacer'],
	['cale', 'shim'],
	['collier', 'clamp'],
	['support', 'bracket'],
	['levier', 'lever'],
	['poignee', 'handle'],
	['manche', 'manico'],
	['pignon', 'sprocket'],
	['engrenage', 'gear'],
	['poulie', 'pulley'],
	['chaine', 'chain'],
	['lame', 'lames', 'blade'],
	['couteau', 'couteaux', 'knife'],
	['roue', 'roues', 'wheel'],
	['essieu', 'axle'],
	['moyeu', 'hub'],
	['arbre', 'shaft'],
	['bras', 'arm'],
	['tige', 'rod'],
	['chassis', 'frame'],
	['couvercle', 'cover'],
	['capot', 'hood'],
	['boitier', 'housing'],
	['siege', 'seat'],
	['filtre', 'filter'],
	['filtre air', 'air filter'],
	['filtre huile', 'oil filter'],
	['filtre carburant', 'filtre essence', 'fuel filter'],
	['prefiltre', 'pre filtre'],
	['embrayage', 'clutch'],
	['frein', 'brake'],
	['cable frein', 'brake cable'],
	['cable embrayage', 'clutch cable'],
	['cable accelerateur', 'cable gaz', 'throttle cable'],
	['reservoir', 'tank'],
	['carburateur', 'carburetor', 'carburettor'],
	['silencieux', 'pot echappement', 'muffler'],
	['vilebrequin', 'crankshaft', 'kurbelwelle'],
	['segment piston', 'segments piston', 'piston ring', 'kolbenring'],
	// Pièces moteur (demande client 8.2, comptes du 26/10/2026). Mots ambigus
	// écartés : « cylinder » (aussi vérin), « regulateur », « bobine » et
	// « poussoir » seuls, « liner ».
	['bielle', 'connecting rod', 'conrod', 'pleuel', 'pleuelstange', 'biella'],
	['piston', 'kolben', 'pistone'],
	['axe piston', 'piston pin', 'gudgeon pin', 'kolbenbolzen'],
	['culasse', 'cylinder head', 'zylinderkopf', 'testata'],
	['joint culasse', 'head gasket', 'cylinder head gasket', 'zylinderkopfdichtung'],
	['soupape admission', 'intake valve', 'inlet valve'],
	['soupape echappement', 'exhaust valve'],
	['arbre cames', 'camshaft', 'nockenwelle'],
	['culbuteur', 'rocker arm', 'kipphebel'],
	['poussoir soupape', 'tappet', 'valve lifter'],
	['carter moteur', 'crankcase', 'kurbelgehause'],
	['volant moteur', 'flywheel', 'schwungrad'],
	['demarreur', 'starter motor'],
	['bobine allumage', 'ignition coil', 'zundspule'],
	['module allumage', 'ignition module'],
	['injecteur', 'injector', 'einspritzduse'],
	['pompe injection', 'injection pump'],
	['pompe huile', 'oil pump', 'olpumpe'],
	['joint spi', 'bague etancheite', 'oil seal', 'simmerring', 'wellendichtring'],
	['pochette joints', 'kit joints', 'gasket set', 'gasket kit', 'dichtsatz'],
	['regulateur moteur', 'regulateur vitesse', 'governor'],
	['reniflard', 'breather'],
	['moteur', 'engine'],
	['pompe', 'pump'],
	['ventilateur', 'fan'],
	['buse', 'nozzle'],
	['tendeur', 'tensioner'],
	['interrupteur', 'switch'],
	['relais', 'relay'],
	['faisceau', 'harness'],
	['capteur', 'sensor'],
	['fusible', 'fuse'],
	['ampoule', 'bulb'],
	['connecteur', 'steckverbindung'],
	['electrique', 'elec', 'elektr'],
	['autocollant', 'etiquette', 'decal', 'sticker'],
	['huile', 'oil'],
	['carburant', 'fuel'],
	['graisse', 'grease'],
	['batterie', 'battery', 'accu', 'accus'],
	['chargeur', 'charger'],

	// -------------------------------------------------------------------------
	// Pluriels courts : la tolérance aux fautes ne joue qu'à partir de 5 lettres
	// -------------------------------------------------------------------------
	['main', 'mains'],
	['dent', 'dents'],
	['fil', 'fils'],
	['soc', 'socs'],
	// Pas « pneumatique » : en atelier, c'est surtout « à air comprimé »
	// (cloueurs, clés à chocs), pas un pneu.
	['pneu', 'pneus', 'tyre'],
	['gant', 'gants'],
	['cle', 'cles'],
	['axe', 'axes'],
	['bac', 'bacs'],

	// -------------------------------------------------------------------------
	// Motoculture : vocabulaire du client ⇄ vocabulaire du catalogue
	// -------------------------------------------------------------------------
	['debroussailleuse', 'debrousailleuse', 'coupe bordure', 'coupe bordures', 'rotofil', 'trimmer'],
	['tondeuse autoportee', 'tracteur tondeuse', 'autoportee', 'autoportees', 'rider'],
	['robot tondeuse', 'robot tonte', 'robots tonte', 'automower'],
	['taille haie', 'taille haies', 'taillehaie', 'cisaille haie', 'hedge trimmer'],
	['souffleur', 'souffleuse', 'souffleur feuilles', 'blower'],
	['tronconneuse', 'scie chaine', 'chainsaw'],
	['elagueuse', 'perche elagage', 'elagueuse perche'],
	['motobineuse', 'bineuse'],
	['scarificateur', 'demousseur', 'aerateur gazon'],
	['fendeuse', 'fendeur', 'fend buche', 'fendeuse buches'],
	['groupe electrogene', 'generateur', 'generatrice'],
	['nettoyeur haute pression', 'hydronettoyeur', 'nettoyeur pression'],
	['gyrobroyeur', 'girobroyeur'],
	['broyeur vegetaux', 'broyeur vegetal', 'broyeur branches', 'broyeur jardin'],
	['plateau coupe', 'carter coupe', 'deck'],
	['bac ramassage', 'sac ramassage', 'grass bag', 'grass catcher'],
	['kit entretien', 'kit revision', 'service kit'],

	// Pièces d'usure de motoculture
	['fil nylon', 'fil debroussailleuse', 'fil coupe bordure', 'fil rotofil', 'trimmer line'],
	['tete fil', 'tete nylon', 'tete debroussailleuse', 'tete rotofil', 'trimmer head'],
	['guide chaine', 'guide tronconneuse', 'guide bar'],
	['chaine tronconneuse', 'chaine scie', 'saw chain'],
	['lame tondeuse', 'couteau tondeuse'],
	['bougie', 'bougie allumage', 'spark plug'],
	['lanceur', 'demarreur lanceur', 'recoil starter'],

	// -------------------------------------------------------------------------
	// Atelier, huiles et entretien
	// -------------------------------------------------------------------------
	['huile 2 temps', 'huile 2t', 'huile melange', 'huile 2tps'],
	['huile 4 temps', 'huile 4t', 'huile 4tps'],
	['degrippant', 'wd40', 'wd 40'],
	// « Lave-mains » désigne ici des cuves (Lemken, Pressol), pas du savon.
	[
		'savon main',
		'savon mains',
		'nettoyant main',
		'nettoyant mains',
		'nettoyant pour mains',
		'nettoyant a mains',
		'nettoyant a main',
		'pate de nettoyage pour mains'
	],
	['pate lavante', 'creme lavante', 'gel lavant', 'savon atelier'],

	// -------------------------------------------------------------------------
	// Électroportatif
	// -------------------------------------------------------------------------
	['meuleuse', 'disqueuse', 'meuleuse angle'],
	['perceuse visseuse', 'visseuse perceuse', 'visseuse'],
	['perforateur', 'perfo', 'marteau perforateur'],
	['boulonneuse', 'cle choc', 'visseuse choc'],
	['scie sauteuse', 'sauteuse'],
	['batterie lithium', 'batterie li ion', 'lithium ion'],

	// -------------------------------------------------------------------------
	// Équipements de protection individuelle
	// -------------------------------------------------------------------------
	['chaussures securite', 'chaussure securite', 'chaussures travail', 'chaussure travail'],
	['pantalon anti coupure', 'pantalon tronconneuse', 'pantalon forestier', 'pantalon bucheron'],
	['casque forestier', 'casque tronconneuse', 'casque bucheron', 'casque elagage'],
	['gilet haute visibilite', 'gilet jaune', 'gilet fluo', 'gilet securite'],
	['protection auditive', 'casque antibruit', 'casque anti bruit', 'bouchons oreilles'],
	['lunettes protection', 'lunettes securite', 'lunette protection'],
	['bleu travail', 'vetement travail', 'tenue travail'],

	// -------------------------------------------------------------------------
	// Agricole et hydraulique
	// -------------------------------------------------------------------------
	['cardan', 'arbre transmission', 'arbre cardan', 'pto shaft'],
	['prise force', 'pdf', 'pto'],
	['attelage', 'hitch'],
	['verin', 'verin hydraulique', 'hydraulic cylinder'],
	['flexible hydraulique', 'tuyau hydraulique', 'durite hydraulique', 'hydraulic hose'],
	['coupleur', 'raccord rapide', 'coupleur hydraulique', 'quick coupling'],
	['tuyau', 'durite', 'hose'],
	['raccord', 'fitting'],
	['bride', 'flange'],
	['marteau broyeur', 'fleau broyeur'],
	['chambre air', 'inner tube'],
	['anti crevaison', 'anticrevaison', 'preventif crevaison'],

	// -------------------------------------------------------------------------
	// Élevage, clôture, viticulture
	// -------------------------------------------------------------------------
	['electrificateur', 'electrificateur cloture', 'poste cloture', 'cloture electrique'],
	['fil cloture', 'cordelette cloture', 'cordon cloture'],
	['mangeoire', 'ratelier'],
	['secateur electrique', 'secateur batterie'],
	['lieuse', 'attacheuse', 'lieuse vigne']
];

/** Petits mots que le client glisse entre les mots d'une expression. */
const JOINERS = ['a', 'au', 'aux', 'd', 'de', 'des', 'du', 'en', 'l', 'la', 'le', 'les', 'pour'];

/**
 * Une expression et ses variantes de saisie : « savon main » → « savon a
 * main », « savon de main », « savon pour main »… — un mot de liaison dans
 * l'un des intervalles. La saisie est envoyée telle quelle à Meilisearch, qui
 * ne reconnaît une expression synonyme que mot pour mot.
 */
export function joinerVariants(term: string): string[] {
	const words = term.split(' ');
	const variants = [term];
	for (let gap = 1; gap < words.length; gap++) {
		for (const joiner of JOINERS) {
			variants.push([...words.slice(0, gap), joiner, ...words.slice(gap)].join(' '));
		}
	}
	return variants;
}

/**
 * Format attendu par Meilisearch : chaque expression, sous toutes ses
 * variantes de saisie, vers les autres expressions de son groupe.
 */
export const SYNONYMS: Record<string, string[]> = Object.fromEntries(
	SYNONYM_GROUPS.flatMap((group) =>
		group.flatMap((term) => {
			const others = group.filter((other) => other !== term);
			return joinerVariants(term).map((variant) => [variant, others]);
		})
	)
);
