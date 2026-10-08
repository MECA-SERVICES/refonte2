/**
 * Corrections de rangement du catalogue — analyse du 2026-10-08.
 *
 * La migration a écarté les « catégories-marques » de PrestaShop (« Pièces
 * MAKITA », « EGO POWER+ »…) sans reclasser leurs produits : ils sont restés
 * accrochés au parent. Et `reclassify` les a épargnés, les croyant déjà rangés
 * côté « Produits » (lien `product_category` vers l'ancienne catégorie).
 *
 * Tâches, dans cet ordre :
 *
 *   makita       ≈ 20 000 pièces Makita posées à la racine « Électroportatif »
 *                → arbre des pièces (règles du premier mot), sauf les vraies
 *                  machines, batteries et chargeurs, rangés côté Produits.
 *   ego          294 produits EGO POWER posés à la racine « Motoculture »
 *                → machines, batteries/chargeurs, accessoires.
 *   machines     ≈ 290 machines rangées côté pièces → branche Produits.
 *   types        `product.type` : machine / consumable / part, pour que la
 *                boutique exclue les pièces des catégories machines.
 *
 * Le masquage des catégories vides (point 5) est fait côté boutique
 * (`$lib/server/shop.ts`), pas ici.
 *
 * ── Utilisation ────────────────────────────────────────────────────────────
 *
 *   node --experimental-strip-types --no-warnings --env-file=.env \
 *        scripts/fix-catalog-classification.ts --dry-run      # rapport seul
 *   node … scripts/fix-catalog-classification.ts              # écriture
 *   node … scripts/fix-catalog-classification.ts --only=types
 *
 * Idempotent : relancé, il ne retrouve plus rien à déplacer (les produits ne
 * sont plus à la racine), et les types sont recalculés à l'identique.
 * N'écrit que dans la base cible (`DATABASE_URL`), jamais dans PrestaShop.
 */
import { runTasks, type Task } from './lib/runner.ts';
import { closeTargetDb, targetDb, targetLabel } from './lib/target-db.ts';
import { log, count } from './lib/logger.ts';
import { buildKeywordIndex, firstWord } from './migrations/prestashop/taxonomy.ts';
import { categoryKind, normalizeLabel } from '../src/lib/catalog-kinds.ts';

// ---------------------------------------------------------------------------
// Repères de l'arbre (ids stables de la base cible)
// ---------------------------------------------------------------------------

const ROOT_PIECES = 1;
const ROOT_PRODUITS = 2;
const UNCLASSIFIED = 257; // Pièces détachées › À classer
const ELECTROPORTATIF = 404;
const MOTOCULTURE = 258;

/** Jouets et miniatures : jamais des machines, quel que soit leur nom. */
const TOY = /ROLLY TOYS|BRUDER|SIKU|\bFALK\b|A PEDALES|JOUET|MINIATURE/;

/**
 * Faux amis : accessoires portant un nom de machine (« SCIE TRÉPAN », « Scie
 * d'ensilage »), et tondeuses à animaux, qui ne sont pas des tondeuses à gazon.
 */
const NOT_A_MACHINE =
	/TREPAN|ENSILAGE|COLZA| POUR |^LAME|^GUIDE|^CHAINE|^BOBINE|^TETE|BOVIN|MOUTON|BETAIL|CHEV(AL|\.)|ANIMAL|AESCULAP|LISCOP|COMPRESSEUR DE RESSORT|^SCIE A RUBAN \d|DENT /;

/** Indices d'une machine motorisée, exigés pour les noms ambigus (outil manuel ou pièce). */
const POWERED =
	/SANS FIL|BATTERIE|LI-ION|\d+([,.]\d+)? ?V\b|\d+ ?W\b|THERMIQUE|ELECTRIQUE|MOTEUR|\d+ ?CC\b|PNEUMATIQUE|\bEX\b|\bXR\b/;

/**
 * Libellés réduits au type d'organe (« POMPE A EAU | ISEKI », « VENTILATEUR |
 * HUSQVARNA ») : côté pièces, ce sont des pièces moteur, pas des machines.
 */
const BARE_PART_NAME =
	/^(POMPES? A EAU|POMPES?|VENTILATEURS?|COMPRESSEURS?|RABOTS?|PULVERISATEURS?|SOUFFLEUR FRONTAL|ASPIRATEURS?|TARIERES?|AGRAFEUSES?|CISAILLES?)$/;

/** Préfixes commerciaux à ignorer pour reconnaître la machine. */
const COMMERCIAL_PREFIX = /^(PACK|DESTOCKAGE|PROMO|OFFRE)\s+/;

const norm = normalizeLabel;

// ---------------------------------------------------------------------------
// Règles « machine » : premier motif qui correspond → catégorie
// ---------------------------------------------------------------------------

type Rule = [RegExp, number];

/** Machines de motoculture (Produits › Motoculture). */
const MOTO_MACHINES: Rule[] = [
	[/^TRACTEURS? TONDEUSES?.*RAMASSAGE/, 272],
	[/^TRACTEURS? TONDEUSES?.*EJECTION/, 273],
	[/^TRACTEURS? TONDEUSES?.*MULCHING/, 276],
	[/^TRACTEURS? TONDEUSES?.*FRONTAL/, 274],
	[/^(TONDEUSE )?AUTO-?PORTEE.*\bZT|^TONDEUSE AUTO-?PORTEE.*ZERO/, 275],
	[/^(TONDEUSE )?AUTO-?PORTEE|^TRACTEURS? TONDEUSES?|^MINI[- ]?RIDER|^RIDER /, 271],
	[/^ROBOT(S)? (DE TONTE|TONDEUSE)|^TONDEUSE ROBOT|^TONDEUSE .*AURA/, 307],
	[/^TONDEUSES? .*(BATTERIE|\d+ ?V\b|LI-ION|SANS FIL)/, 264],
	[/^TONDEUSES? .*ELECTRIQUE/, 263],
	[/^TONDEUSES? .*TRACTEE/, 261],
	[/^TONDEUSES? /, 260],
	[/^DEBROUSSAILLEUSES? /, 287],
	[/^COUPE[- ]BORDURES? /, 330],
	[/^SOUFFLEURS? |^ASPIRATEUR (SOUFFLEUR|DE FEUILLES)/, 298],
	[/^TRONCONNEUSES? A DISQUE/, 467],
	[/^TRONCONNEUSES? /, 280],
	[/^ELAGUEUSES? |^PERCHE ELAGUEUSE/, 336],
	[/^TAILLE[- ]HAIES? |^SCULPTE-HAIE/, 315],
	[/^TARIERES? .*/, 302], // motorisée : vérifié par POWERED
	[/^SCARIFICATEURS? |^DECHAUMEUR/, 313],
	[/^MOTOBINEUSES? /, 284],
	[/^CULTIVATEUR .*(BATTERIE|\d+ ?V\b|THERMIQUE|MOTEUR)/, 284],
	[/^MOTOCULTEURS? /, 282],
	[/^MOTOFAUCHEUSES? /, 334],
	[/^NETTOYEURS? (HAUTE PRESSION|HP\b)/, 306],
	[/^PULVERISATEURS? |^ATOMISEURS? /, 286],
	[/^FRAISES? A NEIGE/, 333],
	[/^GROUPES? ELECTROGENES? /, 329],
	[/^BROYEURS? /, 259],
	[/^FENDEUSES? /, 292],
	[/^POMPES? A EAU|^VIDE[- ]CAVE/, 324],
	[/^ENGAZONNEUSE/, 342],
	[/^EPANDEUR/, 331]
];

/** Électroportatif (Produits › Électroportatif). */
const POWER_TOOLS: Rule[] = [
	[/^PERCEUSE[- ]VISSEUSE|^PERCEUSE .*VISSEUSE/, 431],
	[/^PERCEUSE MAGNETIQUE/, 433],
	[/^PERCEUSE /, 426],
	[/^VISSEUSE D'ANGLE/, 436],
	[/^VISSEUSE (A|À) CHOCS?/, 430],
	[/^VISSEUSE (PLAQUE|BARDAGE)/, 434],
	[/^VISSEUSE /, 429],
	[/^BOULONNEUSE /, 428],
	[/^MALAXEUR /, 427],
	[/^PERFORATEUR[- ]BURINEUR/, 448],
	[/^PERFORATEUR /, 447],
	[/^BURINEUR /, 449],
	[/^MARTEAU PIQUEUR/, 450],
	[/^CAROTTEUSE /, 451],
	[/^MEULEUSE /, 421],
	[/^CISAILLE /, 423],
	[/^GRIGNOTEUSE /, 424],
	[/^PONCEUSE /, 438],
	[/^RABOT /, 444],
	[/^SCIE CIRCULAIRE/, 457],
	[/^SCIE SABRE|^SCIE RECIPRO/, 458],
	[/^SCIE SAUTEUSE/, 459],
	[/^SCIE A ONGLETS?/, 460],
	[/^SCIE PLONGEANTE/, 463],
	[/^SCIE A RUBAN/, 465],
	[/^SCIE (SUR|DE) TABLE/, 462],
	[/^DEFONCEUSE /, 415],
	[/^AFFLEUREUSE /, 416],
	[/^LAMELLEUSE /, 417],
	[/^ENSEMBLE DE \d+ MACHINES/, 484],
	[/^DECAPEUR /, 454],
	[/^CLOUEUR /, 476],
	[/^AGRAFEUSE /, 478],
	[/^COMPRESSEUR /, 477],
	[/^TOURNEVIS /, 505],
	[/^CLE A (CHOCS?|CLIQUET).*(BATTERIE|SANS FIL|\d+ ?V\b)/, 514],
	[/^CLE A CHOCS?/, 475], // pneumatique
	[/^DECOUPEUSE /, 311],
	[/^ASPIRATEUR /, 406],
	[/^VENTILATEUR /, 408],
	[/^NETTOYEUR CANALISATION/, 489]
];

/** Catégories dont les noms sont ambigus : il faut un indice de motorisation. */
const NEEDS_POWER = new Set([302, 423, 478, 505, 324, 408, 477]);

/** Machine ? Renvoie sa catégorie, ou `null`. */
function machineCategory(name: string, branch: 'moto' | 'power' | 'any'): number | null {
	const n = norm(name).replace(COMMERCIAL_PREFIX, '');
	if (TOY.test(n) || NOT_A_MACHINE.test(n)) return null;
	const sets =
		branch === 'moto'
			? [MOTO_MACHINES, POWER_TOOLS]
			: branch === 'power'
				? [POWER_TOOLS, MOTO_MACHINES]
				: [MOTO_MACHINES, POWER_TOOLS];
	for (const rules of sets) {
		for (const [re, id] of rules) {
			if (!re.test(n)) continue;
			if (NEEDS_POWER.has(id) && !POWERED.test(n)) return null;
			return id;
		}
	}
	return null;
}

/** Batterie ou chargeur → catégorie de la branche concernée. */
function energyCategory(name: string, branch: 'moto' | 'power'): number | null {
	const n = norm(name);
	if (/^(PACK (DE )?(\d+ )?)?BATTERIES?\b|^BLOC BATTERIE|^BATTERIE DORSALE/.test(n)) {
		return /DORSALE/.test(n) ? 322 : branch === 'moto' ? 323 : 410;
	}
	if (/^(PACK )?CHARGEURS?\b/.test(n)) return branch === 'moto' ? 320 : 411;
	if (/^(CONVERTISSEUR|ADAPTATEUR|TRANSFORMATEUR|TRASFORMATEUR|CONTROLEUR DE BATTERIE)/.test(n)) {
		return branch === 'moto' ? 321 : 413;
	}
	return null;
}

/** Accessoire de motoculture : catégorie d'accessoires de la machine citée. */
function motoAccessoryCategory(name: string): number {
	const n = norm(name);
	const rules: Rule[] = [
		[/TRACTEUR|AUTO-?PORTEE|\bZT\d|\bTR\d|^BAC |^TOIT|^PARE/, 277],
		[/ROBOT|AURA|ANTENNE/, 308],
		[/TONDEUSE|MULCHING|^DEFLECTEUR|^OBTURATEUR/, 267],
		[/TRONCONNEUSE|^GUIDE|^CHAINE/, 281],
		[/SOUFFLEUR|ASPIRATEUR|^BUSE|^TURBO/, 299],
		[/TAILLE[- ]HAIE/, 316],
		[/ELAGUEUSE|^PERCHE/, 337],
		[/TARIERE|^MECHE/, 303],
		[/NETTOYEUR|^LANCE/, 305],
		[/^HARNAIS|^BANDOULIERE/, 288],
		[/DEBROUSS|COUPE[- ]BORDURE|^TETE|^BOBINE|^FIL |^BUMPER|^LAME/, 290],
		[/^OPTION|MULTI|^RALLONGE|^PORTE|^COUPE /, 327],
		[/^LAMPE/, 496]
	];
	for (const [re, id] of rules) if (re.test(n)) return id;
	return 296; // Motoculture › Outils de jardin › Accessoires outils de jardin
}

// ---------------------------------------------------------------------------
// Écriture commune
// ---------------------------------------------------------------------------

interface Move {
	id: number;
	name: string;
	from: number;
	to: number;
}

/** Applique des déplacements : catégorie principale, et lien secondaire vers l'ancienne retiré. */
async function applyMoves(moves: Move[]) {
	const sql = targetDb();
	const BATCH = 2000;
	for (let i = 0; i < moves.length; i += BATCH) {
		const batch = moves.slice(i, i + BATCH);
		await sql.begin(async (tx) => {
			const ids = batch.map((m) => m.id);
			const targets = batch.map((m) => m.to);
			await tx`
				UPDATE product p SET category_id = v.to, updated_at = now()
				  FROM (SELECT unnest(${ids}::int[]) AS id, unnest(${targets}::int[]) AS to) v
				 WHERE p.id = v.id`;
			// L'ancien rangement survivait en lien secondaire : c'est lui qui
			// faisait épargner ces produits par `reclassify`.
			const froms = batch.map((m) => m.from);
			await tx`
				DELETE FROM product_category pc
				 USING (SELECT unnest(${ids}::int[]) AS id, unnest(${froms}::int[]) AS from_id) v
				 WHERE pc.product_id = v.id AND pc.category_id = v.from_id`;
		});
	}
}

/** Rapport : volume par catégorie cible, avec quelques exemples. */
async function report(moves: Move[]) {
	const sql = targetDb();
	const names = new Map(
		(await sql<{ id: number; name: string }[]>`SELECT id, name FROM category`).map((c) => [
			Number(c.id),
			c.name
		])
	);
	const byTarget = new Map<number, Move[]>();
	for (const m of moves) byTarget.set(m.to, [...(byTarget.get(m.to) ?? []), m]);
	const ordered = [...byTarget].sort((a, b) => b[1].length - a[1].length);
	for (const [to, list] of ordered.slice(0, 30)) {
		log.info(
			`${String(list.length).padStart(6)} → ${names.get(to) ?? to}   ex. ${list
				.slice(0, 3)
				.map((m) => m.name.slice(0, 40))
				.join(' / ')}`
		);
	}
	if (ordered.length > 30) log.muted(`… ${ordered.length - 30} autres catégories cibles`);
}

// ---------------------------------------------------------------------------
// Tâches
// ---------------------------------------------------------------------------

const keywords = buildKeywordIndex();

/** Feuilles de l'arbre des pièces, par chemin « famille > sous-famille > type ». */
async function pieceLeaves() {
	const sql = targetDb();
	const rows = await sql<{ id: number; path: string }[]>`
		WITH RECURSIVE t AS (
			SELECT id, name::text AS path FROM category WHERE parent_id = ${ROOT_PIECES}
			UNION ALL
			SELECT c.id, t.path || ' > ' || c.name FROM category c JOIN t ON c.parent_id = t.id
		)
		SELECT id, path FROM t`;
	return new Map(rows.map((r) => [r.path, Number(r.id)]));
}

const makitaTask: Task = {
	name: 'makita',
	description: 'Pièces Makita posées à la racine « Électroportatif » → arbre des pièces',
	async run({ dryRun }) {
		const sql = targetDb();
		const leaves = await pieceLeaves();
		const rows = await sql<{ id: number; name: string; price_ht: string }[]>`
			SELECT id, name, price_ht FROM product WHERE category_id = ${ELECTROPORTATIF}`;
		log.muted(`${count(rows.length)} produits à la racine « Électroportatif »`);

		const moves: Move[] = [];
		let toUnclassified = 0;
		for (const p of rows) {
			const price = Number(p.price_ht);
			const machine = price >= 50 ? machineCategory(p.name, 'power') : null;
			const energy = energyCategory(p.name, 'power');
			let to: number;
			if (machine) to = machine;
			else if (energy && price >= 20) to = energy;
			else {
				const hit = keywords.get(firstWord(p.name));
				const leaf = hit ? leaves.get(`${hit.family} > ${hit.subFamily} > ${hit.type}`) : undefined;
				if (leaf) to = leaf;
				else {
					to = UNCLASSIFIED;
					toUnclassified++;
				}
			}
			moves.push({ id: Number(p.id), name: p.name, from: ELECTROPORTATIF, to });
		}

		await report(moves);
		log.muted(`dont ${count(toUnclassified)} sans règle → « À classer »`);
		if (dryRun) return { processed: 0, note: `simulation : ${count(moves.length)} déplacements` };
		await applyMoves(moves);
		return { processed: moves.length };
	}
};

const egoTask: Task = {
	name: 'ego',
	description: 'Produits posés à la racine « Motoculture » → machines, énergie, accessoires',
	async run({ dryRun }) {
		const sql = targetDb();
		const rows = await sql<{ id: number; name: string; price_ht: string }[]>`
			SELECT id, name, price_ht FROM product WHERE category_id = ${MOTOCULTURE}`;
		log.muted(`${count(rows.length)} produits à la racine « Motoculture »`);

		const moves: Move[] = rows.map((p) => {
			const price = Number(p.price_ht);
			const to =
				(price >= 80 ? machineCategory(p.name, 'moto') : null) ??
				energyCategory(p.name, 'moto') ??
				motoAccessoryCategory(p.name);
			return { id: Number(p.id), name: p.name, from: MOTOCULTURE, to };
		});

		await report(moves);
		if (dryRun) return { processed: 0, note: `simulation : ${count(moves.length)} déplacements` };
		await applyMoves(moves);
		return { processed: moves.length };
	}
};

/** Cibles trop ambiguës pour sortir un produit de l'arbre des pièces. */
const PART_SIDE_SKIP = new Set([408 /* Ventilateur */, 324 /* Pompes à eau */, 259 /* Broyeurs */]);

const machinesTask: Task = {
	name: 'machines',
	description: 'Machines rangées côté pièces → branche Produits',
	async run({ dryRun }) {
		const sql = targetDb();
		const rows = await sql<{ id: number; name: string; price_ht: string; category_id: number }[]>`
			WITH RECURSIVE t AS (
				SELECT id FROM category WHERE id = ${ROOT_PIECES}
				UNION ALL SELECT c.id FROM category c JOIN t ON c.parent_id = t.id
			)
			SELECT id, name, price_ht, category_id FROM product
			 WHERE is_active AND price_ht > 150 AND category_id IN (SELECT id FROM t)`;

		const moves: Move[] = [];
		for (const p of rows) {
			const bare = norm(p.name.split('|')[0]);
			if (BARE_PART_NAME.test(bare)) continue;
			const to = machineCategory(p.name, 'any');
			// Côté pièces, ventilateurs, pompes et broyeurs nommés ainsi sont le
			// plus souvent des organes de machine : on n'en sort aucun.
			if (to && !PART_SIDE_SKIP.has(to)) {
				moves.push({ id: Number(p.id), name: p.name, from: Number(p.category_id), to });
			}
		}
		log.muted(`${count(rows.length)} produits > 150 € HT côté pièces examinés`);
		await report(moves);
		if (dryRun) return { processed: 0, note: `simulation : ${count(moves.length)} déplacements` };
		await applyMoves(moves);
		return { processed: moves.length };
	}
};

/**
 * Premiers mots du référentiel des pièces qui désignent aussi des produits
 * finis vendus côté Produits (scie à main, pompe, lampe…) : jamais rétrogradés.
 */
const AMBIGUOUS_WORDS = new Set(['SCIE', 'POMPE', 'MOTEUR', 'LAMPE', 'FRAISE', 'KIT', 'BAC']);

/** Nom d'accessoire : ce qui s'ajoute à une machine sans en être une. */
const ACCESSORY_NAME =
	/^(LAMES?|JEU DE LAMES|BAC|KIT (MULCHING|INSTALLATION|ENTRETIEN|MAINTENANCE|D'ACCESSOIRES)|OBTURATEUR|DEFLECTEUR|HOUSSE|TOIT|PARE[- ]?CHOC|SAC|FILTRE|BUSE|GUIDE|CHAINE|BOBINE|TETE|HARNAIS|BANDOULIERE|CAPOT|ROUE|SUPPORT|ADAPTATEUR|RALLONGE|GODET|FOURCHE|DISQUE|MODULE|EXTENSION|CARTOUCHE|CROCHET|POIGNEE|SET|ENSEMBLE PELLE)\b/;

/** Nom commençant par une machine : « FENDEUSE … POUR TRACTEUR » reste une machine. */
const MACHINE_FIRST_WORD =
	/^(FENDEUSE|POMPE|BROYEUR|GYROBROYEUR|TONDEUSE|TRACTEUR|DEBROUSSAILLEUSE|TRONCONNEUSE|SOUFFLEUR|ASPIRATEUR|NETTOYEUR|GROUPE|MOTOBINEUSE|MOTOCULTEUR|TAILLE|COMPRESSEUR|PERCEUSE|VISSEUSE|MEULEUSE|SCIE|ROBOT|FRAISE A NEIGE|EPANDEUR|PULVERISATEUR|ATOMISEUR|SCARIFICATEUR|TARIERE|ELAGUEUSE|COUPE[- ]BORDURE|GENERATEUR|BALAYEUSE)/;

const typesTask: Task = {
	name: 'types',
	description: 'product.type : machine / consumable / part',
	async run({ dryRun }) {
		const sql = targetDb();

		const cats = await sql<{ id: number; name: string; slug: string; parent_id: number | null }[]>`
			SELECT id, name, slug, parent_id FROM category`;
		const byId = new Map(cats.map((c) => [Number(c.id), c]));
		/** Lignée de la racine vers la catégorie. */
		const chainOf = (id: number) => {
			const chain: { id: number; name: string; slug: string }[] = [];
			let cur = byId.get(id);
			while (cur && chain.length < 12) {
				chain.unshift({ id: Number(cur.id), name: cur.name, slug: cur.slug });
				cur = cur.parent_id != null ? byId.get(Number(cur.parent_id)) : undefined;
			}
			return chain;
		};

		// Même règle que la boutique (`$lib/catalog-kinds.ts`).
		const machineCats = new Set<number>();
		const produitsCats = new Set<number>();
		for (const c of cats) {
			const chain = chainOf(Number(c.id));
			if (!chain.some((x) => x.id === ROOT_PRODUITS)) continue;
			produitsCats.add(Number(c.id));
			if (categoryKind(chain) === 'machine') machineCats.add(Number(c.id));
		}

		const rows = await sql<
			{ id: number; name: string; price_ht: string; category_id: number | null; type: string }[]
		>`
			SELECT id, name, price_ht, category_id, type FROM product
			 WHERE category_id = ANY(${[...produitsCats]}::int[])`;

		const machine: number[] = [];
		const consumable: number[] = [];
		const part: number[] = [];
		const partSamples: string[] = [];
		const accessorySamples: string[] = [];
		for (const p of rows) {
			const cat = Number(p.category_id);
			if (!machineCats.has(cat)) {
				consumable.push(Number(p.id));
				continue;
			}
			const n = norm(p.name);
			const word = firstWord(p.name);
			// Accessoire posé dans une catégorie machine (batterie, chargeur, bac,
			// lame, kit, « … POUR … ») : visible dans sa sous-catégorie
			// d'accessoires, pas parmi les machines. Testé avant la pièce : un
			// chargeur ou un sac de ramassage n'a pas à disparaître.
			const isAccessory =
				!machineCategory(p.name, 'any') &&
				(energyCategory(p.name, 'moto') !== null ||
					ACCESSORY_NAME.test(n) ||
					(/ POUR /.test(n) && !MACHINE_FIRST_WORD.test(n)));
			// Pièce égarée : premier mot de pièce et petit prix (« POMPE »,
			// « SCIE », « MOTEUR » existent aussi en machines).
			const isPart =
				!isAccessory &&
				Number(p.price_ht) < 100 &&
				keywords.has(word) &&
				!AMBIGUOUS_WORDS.has(word) &&
				!machineCategory(p.name, 'any');
			if (isAccessory) {
				consumable.push(Number(p.id));
				if (accessorySamples.length < 12) accessorySamples.push(p.name);
			} else if (isPart) {
				part.push(Number(p.id));
				if (partSamples.length < 12) partSamples.push(p.name);
			} else machine.push(Number(p.id));
		}

		log.info(
			`${count(machineCats.size)} catégories machines sur ${count(produitsCats.size)} côté Produits`
		);
		log.info(`machine : ${count(machine.length)}`);
		log.info(`consumable (accessoires, consommables, EPI…) : ${count(consumable.length)}`);
		log.info(`part (pièce égarée en catégorie machine, masquée) : ${count(part.length)}`);
		if (partSamples.length) log.muted(`ex. ${partSamples.join(' / ')}`);
		if (accessorySamples.length) {
			log.muted(`accessoires sortis des catégories machines, ex. ${accessorySamples.join(' / ')}`);
		}

		if (dryRun) return { processed: 0, note: 'simulation' };

		const setType = async (ids: number[], type: string) => {
			for (let i = 0; i < ids.length; i += 5000) {
				const batch = ids.slice(i, i + 5000);
				await sql`UPDATE product SET type = ${type} WHERE id = ANY(${batch}::int[]) AND type <> ${type}`;
			}
		};
		await setType(machine, 'machine');
		await setType(consumable, 'consumable');
		await setType(part, 'part');
		// Côté pièces, tout reste « part » (valeur par défaut).
		return { processed: machine.length + consumable.length + part.length };
	}
};

log.muted(`cible : ${targetLabel()}`);
await runTasks({
	title: 'Corrections de rangement du catalogue',
	tasks: [makitaTask, egoTask, machinesTask, typesTask],
	cleanup: closeTargetDb
});
