/**
 * Rangement des produits restés dans « Pièces détachées › À classer ».
 *
 * La migration (`09-reclassify`) range sur le **premier mot** du nom. Au
 * 2026-10-13, 282 862 produits actifs lui avaient échappé : pièces Kuhn,
 * Kverneland, B&S, Husqvarna… aux noms anglais ou tronqués. Ce script reprend
 * leur rangement, sans toucher aux produits déjà classés.
 *
 * Tâches, dans cet ordre :
 *
 *   taxonomy   crée les rayons ajoutés à `taxonomy.ts` sous « Pièces
 *              détachées » (Autocollants & étiquettes, Sièges & ceintures…).
 *              Pas la tâche `08-taxonomy` de la migration : elle recréerait
 *              aussi la racine « Produits & machines », renommée depuis
 *              « Produits ». Idempotente.
 *   rules      règles de `taxonomy.ts` :
 *              - premier mot du nom (règles enrichies de 111 mots-clés) ;
 *              - sinon, si le premier mot n'est qu'un qualificatif (« High
 *                Performance Timing Belts », « REAR SHAFT », « LOCK NUT »),
 *                premier mot-clé connu qui suit. Jamais au-delà d'un vrai nom :
 *                « DECAL, BELT GUARD » n'est pas une courroie.
 *
 *   ai         la longue traîne (noms cryptiques, anglais, allemands…) :
 *              Claude Haiku 5.5 choisit un rayon dans la liste des feuilles de
 *              « Pièces détachées », d'après le nom, la marque et les
 *              caractéristiques. En cas de doute, le produit reste « À classer ».
 *              Batch API (moitié prix) ; `--batch=<id>` reprend un lot déjà
 *              envoyé sans le repayer. `--effort=medium` active la réflexion du
 *              modèle (plus juste, plus cher). Clé : `ANTHROPIC_API_KEY`.
 *
 * ── Utilisation ────────────────────────────────────────────────────────────
 *
 *   bun run classify:unclassified -- --dry-run     # rapport seul, aucune écriture
 *   bun run classify:unclassified                  # écriture
 *   bun run classify:unclassified -- --only=rules --limit=1000
 *   bun run classify:unclassified -- --only=ai --limit=500 --dry-run   # échantillon à relire
 *
 * Le rapport (CSV) et le fichier de retour arrière sont écrits dans
 * `reports/classement/`. Les produits rangés voient leur `updated_at` mis à
 * jour : `bun run search:sync` les réindexe ensuite.
 *
 * N'écrit que dans la base cible (`DATABASE_URL`), jamais dans PrestaShop.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import Anthropic from '@anthropic-ai/sdk';
import { resolve } from 'node:path';
import { runTasks, type Task } from './lib/runner.ts';
import { projectRoot, requireEnv } from './lib/env.ts';
import { closeTargetDb, targetDb } from './lib/target-db.ts';
import { count, log } from './lib/logger.ts';
import { slugify, uniqueSlug } from './lib/transform.ts';
import {
	buildKeywordIndex,
	NOISE_WORDS,
	OBSOLETE_PREFIXES,
	PIECE_TAXONOMY,
	PIECES_ROOT,
	UNCLASSIFIED
} from './migrations/prestashop/taxonomy.ts';

/** Lot de lecture et d'écriture. */
const BATCH = 5_000;

/**
 * Premiers mots qui ne disent pas ce qu'est la pièce : préfixes d'import
 * (`NOISE_WORDS`), positions et qualificatifs anglais. Derrière eux, le
 * premier mot-clé connu désigne la pièce : « Hexagon Head **Screw** »,
 * « Ball **Bearing** », « Rear **Shaft** ».
 */
const QUALIFIERS = new Set([
	...NOISE_WORDS,
	'C',
	'S',
	'BALL',
	'CABIN',
	'CAGE',
	'CHEESE',
	'CONNECTING',
	'CONTROL',
	'DOUBLE',
	'DOUBLE-SIDED',
	'DRIVE',
	'DUST',
	'ELECTRICAL',
	'END',
	'FLAT',
	'FRONT',
	'FUEL',
	'HEX',
	'HEXAGON',
	'HYDR',
	'INNER',
	'LEFT',
	'LOCK',
	'LOCKING',
	'LOWER',
	'MAIN',
	'OIL',
	'OUTER',
	'PLASTIC',
	'PRESSURE',
	'REAR',
	'RIGHT',
	'ROLL',
	'RUBBER',
	'SAFETY',
	'SERVICE',
	'SIDE',
	'SOCKET',
	'TENSION',
	'THREADED',
	'THROTTLE',
	'UPPER',
	'VARIABLE'
]);

/** Produits arrêtés : signalés dans le rapport, jamais rangés. */
const DISCONTINUED = /^(PLUS COMMERCIALIS|CE REPORTER|NE SE FAIT PLUS)/;

/** Mot normalisé : majuscules, sans accents ni ponctuation en bordure. */
function normalizeWord(word: string): string {
	return word
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toUpperCase()
		.replace(/^[^A-Z0-9']+|[^A-Z0-9']+$/g, '');
}

/** Mots de la désignation (avant la marque ajoutée par l'import : « … | KUHN »). */
export function designationWords(name: string): string[] {
	const designation = name
		.split('|')[0]
		// « O RING », « O'RING » : un seul mot, sinon « RING » enverrait le
		// joint torique dans les circlips.
		.replace(/^\s*o[\s']+ring\b/i, 'O-RING');
	return designation
		.split(/[\s,;:()/]+/)
		.map(normalizeWord)
		.filter(Boolean);
}

export type RuleMatch = { keyword: string; via: 'premier-mot' | 'après-qualificatif' };

/**
 * Mot-clé qui range ce nom, ou `null`. Le premier mot d'abord ; s'il n'est
 * qu'un qualificatif, le premier mot-clé qui suit la série de qualificatifs.
 */
export function matchRule(words: string[], keywords: Set<string>): RuleMatch | null {
	const [first] = words;
	if (!first) return null;
	if (keywords.has(first)) return { keyword: first, via: 'premier-mot' };
	if (!QUALIFIERS.has(first)) return null;

	for (const word of words.slice(1)) {
		if (keywords.has(word)) return { keyword: word, via: 'après-qualificatif' };
		// Un vrai nom non reconnu arrête la lecture : le mot-clé suivant
		// qualifierait ce nom, il ne le désignerait pas.
		if (!QUALIFIERS.has(word) && !/\d/.test(word)) return null;
	}
	return null;
}

/** Champ CSV échappé. */
function csv(value: string | number): string {
	const text = String(value);
	return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function reportPath(name: string): string {
	const dir = resolve(projectRoot, 'reports', 'classement');
	mkdirSync(dir, { recursive: true });
	const day = new Date().toISOString().slice(0, 10);
	return resolve(dir, `${day}-${name}.csv`);
}

/** Chemins de l'arbre des pièces (`source = 'rule'`) → id. */
async function pieceTree() {
	const sql = targetDb();
	const tree = await sql<{ id: number; name: string; parent_id: number | null }[]>`
		SELECT id, name, parent_id FROM category WHERE source = 'rule'`;
	const byId = new Map(tree.map((c) => [Number(c.id), c]));
	const pathOf = (c: { name: string; parent_id: number | null }): string => {
		const parent = c.parent_id != null ? byId.get(Number(c.parent_id)) : undefined;
		return parent ? `${pathOf(parent)} > ${c.name}` : c.name;
	};
	return new Map(tree.map((c) => [pathOf(c), Number(c.id)]));
}

const taxonomyTask: Task = {
	name: 'taxonomy',
	description: 'Crée les rayons de taxonomy.ts absents de « Pièces détachées »',

	async run({ dryRun }) {
		const sql = targetDb();
		const idByPath = await pieceTree();
		if (!idByPath.has(PIECES_ROOT)) throw new Error(`Racine « ${PIECES_ROOT} » introuvable.`);

		// Familles, sous-familles et feuilles, parents d'abord.
		const planned: { path: string; parentPath: string; name: string; position: number }[] = [];
		PIECE_TAXONOMY.forEach((family, f) => {
			const familyPath = `${PIECES_ROOT} > ${family.name}`;
			planned.push({ path: familyPath, parentPath: PIECES_ROOT, name: family.name, position: f });
			family.children.forEach((sub, s) => {
				const subPath = `${familyPath} > ${sub.name}`;
				planned.push({ path: subPath, parentPath: familyPath, name: sub.name, position: s });
				sub.children.forEach((leaf, l) => {
					planned.push({
						path: `${subPath} > ${leaf.name}`,
						parentPath: subPath,
						name: leaf.name,
						position: l
					});
				});
			});
		});
		const missing = planned.filter((p) => !idByPath.has(p.path));

		for (const p of missing) log.muted(`${dryRun ? 'à créer' : 'création'} : ${p.path}`);
		if (dryRun || missing.length === 0) {
			return { processed: 0, note: `${count(missing.length)} rayon(s) à créer` };
		}

		const used = new Set(
			(await sql<{ slug: string }[]>`SELECT slug FROM category`).map((r) => r.slug)
		);
		for (const p of missing) {
			const [row] = await sql<{ id: number }[]>`
				INSERT INTO category ${sql({
					parent_id: idByPath.get(p.parentPath)!,
					name: p.name,
					slug: uniqueSlug(slugify(p.name), used),
					is_active: true,
					position: p.position,
					source: 'rule'
				})}
				RETURNING id`;
			idByPath.set(p.path, Number(row.id));
		}
		return { processed: missing.length };
	}
};

type Assignment = { id: number; categoryId: number };

/**
 * Écrit des rangements, précédés d'un fichier de retour arrière.
 *
 * Tous ces produits étaient dans « À classer », avec le même rayon en
 * catégorie secondaire (doublon de la migration) : le lien est retiré, sans
 * quoi ils resteraient listés sous « À classer ». `category_id = À classer`
 * sert de garde : un produit rangé entre-temps à la main n'est pas écrasé.
 */
async function applyAssignments(assignments: Assignment[], unclassifiedId: number) {
	const sql = targetDb();

	// Horodaté : un second passage le même jour n'écrase pas le précédent.
	const rollbackFile = reportPath(
		`retour-arriere-${new Date().toISOString().slice(11, 19).replace(/:/g, '')}`
	);
	writeFileSync(
		rollbackFile,
		['# Remettre ces produits dans « À classer » (id ' + unclassifiedId + ')', 'id']
			.concat(assignments.map((a) => String(a.id)))
			.join('\n') + '\n'
	);
	log.muted(`Retour arrière : ${rollbackFile}`);

	let written = 0;
	for (let i = 0; i < assignments.length; i += BATCH) {
		const chunk = assignments.slice(i, i + BATCH);
		await sql.begin(async (tx) => {
			await tx`
				UPDATE product AS p
				   SET category_id = v.category_id, updated_at = now()
				  FROM unnest(
				         ${sql.array(chunk.map((a) => a.id))}::int[],
				         ${sql.array(chunk.map((a) => a.categoryId))}::int[]
				       ) AS v(id, category_id)
				 WHERE p.id = v.id AND p.category_id = ${unclassifiedId}`;
			await tx`
				DELETE FROM product_category
				 WHERE category_id = ${unclassifiedId}
				   AND product_id IN ${sql(chunk.map((a) => a.id))}`;
		});
		written += chunk.length;
	}

	log.success(
		`${count(written)} produits rangés. Lancer \`bun run search:sync\` pour la recherche.`
	);
	return written;
}

const rulesTask: Task = {
	name: 'rules',
	description:
		'Range « À classer » par les règles de taxonomy.ts (premier mot, puis après qualificatif)',
	dependsOn: ['taxonomy'],

	async run({ dryRun, limit }) {
		const sql = targetDb();
		const index = buildKeywordIndex();
		const keywords = new Set(index.keys());

		const idByPath = await pieceTree();

		const unclassifiedId = idByPath.get(`${PIECES_ROOT} > ${UNCLASSIFIED}`);
		if (!unclassifiedId) throw new Error(`Rayon « ${UNCLASSIFIED} » introuvable.`);

		const leafId = (keyword: string) => {
			const rule = index.get(keyword)!;
			const path = `${PIECES_ROOT} > ${rule.family} > ${rule.subFamily} > ${rule.type}`;
			const id = idByPath.get(path);
			// En simulation, les rayons tout juste ajoutés n'existent pas encore.
			if (!id && !dryRun) throw new Error(`Rayon absent : ${path} — jouer la tâche « taxonomy ».`);
			if (!id) return { id: -1, path: `${path} (à créer)` };
			return { id, path };
		};

		const report = [['id', 'reference', 'nom', 'rayon', 'regle', 'mot'].join(';')];
		const discontinued = [['id', 'reference', 'nom'].join(';')];
		const assignments: Assignment[] = [];
		const byLeaf = new Map<string, { total: number; samples: string[] }>();
		let read = 0;
		let unmatched = 0;
		let lastId = 0;

		for (;;) {
			const size = limit === null ? BATCH : Math.min(BATCH, limit - read);
			if (size <= 0) break;
			const rows = await sql<{ id: number; name: string; reference: string | null }[]>`
				SELECT id, name, reference FROM product
				 WHERE category_id = ${unclassifiedId} AND is_active AND id > ${lastId}
				 ORDER BY id
				 LIMIT ${size}`;
			if (rows.length === 0) break;

			for (const row of rows) {
				const words = designationWords(row.name);
				const upper = words.join(' ');
				if (OBSOLETE_PREFIXES.some((p) => upper.startsWith(p)) || DISCONTINUED.test(upper)) {
					discontinued.push([row.id, row.reference ?? '', row.name].map(csv).join(';'));
					continue;
				}

				const match = matchRule(words, keywords);
				if (!match) {
					unmatched++;
					continue;
				}
				const leaf = leafId(match.keyword);
				assignments.push({ id: row.id, categoryId: leaf.id });
				report.push(
					[row.id, row.reference ?? '', row.name, leaf.path, match.via, match.keyword]
						.map(csv)
						.join(';')
				);
				const bucket = byLeaf.get(leaf.path) ?? { total: 0, samples: [] };
				bucket.total++;
				if (bucket.samples.length < 3) bucket.samples.push(row.name.split('|')[0].trim());
				byLeaf.set(leaf.path, bucket);
			}

			read += rows.length;
			lastId = rows[rows.length - 1].id;
		}

		const reportFile = reportPath(dryRun ? 'regles-simulation' : 'regles');
		writeFileSync(reportFile, report.join('\n') + '\n');
		const discontinuedFile = reportPath('arretes');
		writeFileSync(discontinuedFile, discontinued.join('\n') + '\n');

		log.info(`${count(read)} produits lus dans « ${UNCLASSIFIED} »`);
		log.success(`${count(assignments.length)} rangés par les règles`);
		log.info(`${count(unmatched)} sans règle — pour l'étape IA`);
		log.info(
			`${count(discontinued.length - 1)} arrêtés (PLUS COMMERCIALISÉ, REMPLACÉ PAR…), non rangés`
		);
		log.muted(`Rapport : ${reportFile}`);
		log.muted(`Arrêtés : ${discontinuedFile}`);
		for (const [path, bucket] of [...byLeaf].sort((a, b) => b[1].total - a[1].total).slice(0, 25)) {
			log.muted(
				`${count(bucket.total).padStart(7)}  ${path.replace(`${PIECES_ROOT} > `, '')} — ${bucket.samples.join(' · ')}`
			);
		}

		if (dryRun) return { processed: 0, note: `simulation : ${count(assignments.length)} à ranger` };

		const written = await applyAssignments(assignments, unclassifiedId);
		return { processed: written };
	}
};

// ---------------------------------------------------------------------------
// Étape IA
// ---------------------------------------------------------------------------

/** Modèle retenu avec le client : rapide et très économique pour un choix dans une liste. */
const AI_MODEL = 'claude-haiku-5-5';

/** Produits par requête : un compromis entre coût des instructions et taille de la réponse. */
const PRODUCTS_PER_REQUEST = 50;

/** Réponse du modèle quand aucun rayon ne convient. */
const NO_CATEGORY = 'AUCUN';

/**
 * Réponse d'une requête : un rayon par produit, choisi dans une liste fermée
 * de chemins (`enum`). Un identifiant numérique laissait le modèle confondre
 * des rayons voisins — « Papillon », « Pastille », « Porte-lame » finissaient
 * tous dans « Rouleaux » ; un libellé imposé ne peut être ni inventé ni décalé.
 */
function aiSchema(labels: string[]) {
	return {
		type: 'object',
		properties: {
			results: {
				type: 'array',
				items: {
					type: 'object',
					properties: {
						id: { type: 'integer' },
						category: { type: 'string', enum: [...labels, NO_CATEGORY] }
					},
					required: ['id', 'category'],
					additionalProperties: false
				}
			}
		},
		required: ['results'],
		additionalProperties: false
	};
}

/** Libellé d'un rayon proposé au modèle : son chemin, sans la racine. */
function leafLabel(path: string): string {
	return path.replace(`${PIECES_ROOT} > `, '');
}

function aiInstructions(leaves: { id: number; path: string }[]): string {
	return [
		"Tu ranges les pièces détachées d'un distributeur français de matériel de motoculture,",
		'agricole et électroportatif (tondeuses, tracteurs, tronçonneuses, outillage…).',
		'',
		'Pour chaque produit, choisis le rayon le plus précis dans la liste ci-dessous et renvoie',
		'son chemin exact. Les noms viennent des fournisseurs : souvent tronqués, en anglais, en',
		'allemand, en italien ou en portugais (« Decal », « Weld, idler arm », « Schraube »,',
		'« Adesivo »). Appuie-toi aussi sur la marque et les caractéristiques fournies.',
		'',
		'Règles :',
		"- Un chemin de la liste, recopié à l'identique.",
		"- Range selon ce QU'EST la pièce, pas selon la machine qui la porte : « Weld, idler arm »",
		'  est un bras, « Bush, steering » une bague, « Poussoir de soupape » va avec les soupapes.',
		'- Dès que le nom désigne une pièce identifiable, choisis le rayon le plus proche, même',
		"  s'il n'est pas parfait : « Papillon gaz », « Pointeau » → carburateurs ; « Masselotte »",
		'  → embrayages ; « Panier » → sacs & bacs ; « Diaphragme pompe » → membranes.',
		`- Renvoie ${NO_CATEGORY} seulement si le nom ne désigne aucune pièce identifiable : référence ou code`,
		'  seul, mot générique (« Accessoires », « Parts », « Assembly », « Pièce »), texte illisible.',
		'- Abréviations fréquentes : ENS. = ensemble, CPL/CPLT = complet, EMBR. = embrayage,',
		'  ROULEMT = roulement, TEND. = tendeur, AR/AV = arrière/avant,',
		'  G./D. = gauche/droite, SUP./INF. = supérieur/inférieur.',
		'- Un résultat pour chaque produit, avec son identifiant tel que fourni.',
		'',
		'Rayons :',
		...leaves.map((l) => leafLabel(l.path))
	].join('\n');
}

type AiProduct = { id: number; name: string; brand: string | null; specs: string | null };

/** Lot envoyé, enregistré pour pouvoir en relire les résultats sans le repayer. */
type BatchState = { batchId: string; requests: Record<string, number[]> };

const aiTask: Task = {
	name: 'ai',
	description: `Range la longue traîne avec ${AI_MODEL} (Batch API) — échantillon : --limit=500 --dry-run`,
	dependsOn: ['rules'],

	async run({ dryRun, limit, options }) {
		const sql = targetDb();
		const client = new Anthropic({ apiKey: requireEnv('ANTHROPIC_API_KEY') });
		const keywords = new Set(buildKeywordIndex().keys());

		const idByPath = await pieceTree();
		const unclassifiedId = idByPath.get(`${PIECES_ROOT} > ${UNCLASSIFIED}`);
		if (!unclassifiedId) throw new Error(`Rayon « ${UNCLASSIFIED} » introuvable.`);

		// Feuilles de « Pièces détachées », hors « À classer ».
		const paths = [...idByPath.keys()];
		const leaves = paths
			.filter((path) => path.startsWith(`${PIECES_ROOT} > `))
			.filter((path) => !paths.some((other) => other.startsWith(`${path} > `)))
			.filter((path) => idByPath.get(path) !== unclassifiedId)
			.map((path) => ({ id: idByPath.get(path)!, path }))
			.sort((a, b) => a.path.localeCompare(b.path, 'fr'));
		const leafByLabel = new Map(leaves.map((l) => [leafLabel(l.path), l]));
		log.muted(`${count(leaves.length)} rayons proposés au modèle`);

		let state: BatchState;
		const products = new Map<number, AiProduct>();

		const resumeId = typeof options.batch === 'string' ? options.batch : null;
		if (resumeId) {
			state = JSON.parse(readFileSync(reportPath(`ia-lot-${resumeId}`), 'utf8')) as BatchState;
			log.step(`Reprise du lot ${resumeId}`);
			// Noms des produits du lot, pour le rapport.
			const ids = Object.values(state.requests).flat();
			for (let i = 0; i < ids.length; i += BATCH) {
				const rows = await sql<AiProduct[]>`
					SELECT id, name, NULL AS brand, NULL AS specs FROM product
					 WHERE id = ANY(${sql.array(ids.slice(i, i + BATCH))}::int[])`;
				for (const row of rows) products.set(row.id, row);
			}
		} else {
			// Produits sans règle, hors produits arrêtés : la même sélection que
			// l'étape précédente laisse de côté.
			let lastId = 0;
			for (;;) {
				const size = limit === null ? BATCH : Math.min(BATCH, limit - products.size);
				if (size <= 0) break;
				const rows = await sql<AiProduct[]>`
					SELECT p.id, p.name, b.name AS brand,
					       (SELECT string_agg(s.name || ' : ' || s.value, ' ; ')
					          FROM (SELECT name, value FROM product_spec
					                 WHERE product_id = p.id ORDER BY name LIMIT 4) s) AS specs
					  FROM product p
					  LEFT JOIN brand b ON b.id = p.brand_id
					 WHERE p.category_id = ${unclassifiedId} AND p.is_active AND p.id > ${lastId}
					 ORDER BY p.id
					 LIMIT ${size}`;
				if (rows.length === 0) break;
				for (const row of rows) {
					const words = designationWords(row.name);
					const upper = words.join(' ');
					const skip =
						OBSOLETE_PREFIXES.some((prefix) => upper.startsWith(prefix)) ||
						DISCONTINUED.test(upper) ||
						matchRule(words, keywords) !== null;
					if (!skip) products.set(row.id, row);
				}
				lastId = rows[rows.length - 1].id;
			}
			if (products.size === 0) return { processed: 0, note: 'rien à ranger' };

			const ids = [...products.keys()];
			const requests: Anthropic.Messages.Batches.BatchCreateParams.Request[] = [];
			state = { batchId: '', requests: {} };
			const instructions = aiInstructions(leaves);
			const effort =
				options.effort === 'low' || options.effort === 'medium' || options.effort === 'high'
					? options.effort
					: null;
			const schema = aiSchema([...leafByLabel.keys()]);
			for (let i = 0; i < ids.length; i += PRODUCTS_PER_REQUEST) {
				const chunk = ids.slice(i, i + PRODUCTS_PER_REQUEST);
				const customId = `p${chunk[0]}-${chunk.length}`;
				state.requests[customId] = chunk;
				const lines = chunk.map((id) => {
					const p = products.get(id)!;
					return [id, p.name, p.brand ?? '', p.specs ?? ''].join(' | ');
				});
				requests.push({
					custom_id: customId,
					params: {
						model: AI_MODEL,
						max_tokens: 16000,
						// Sans `--effort`, pas de réflexion préalable : choisir dans une
						// liste n'en demande guère, et c'est le moins cher.
						...(effort
							? { thinking: { type: 'adaptive' as const } }
							: { thinking: { type: 'disabled' as const } }),
						output_config: { effort: effort ?? 'low', format: { type: 'json_schema', schema } },
						system: [{ type: 'text', text: instructions, cache_control: { type: 'ephemeral' } }],
						messages: [
							{
								role: 'user',
								content: `Produits (identifiant | nom | marque | caractéristiques) :\n${lines.join('\n')}`
							}
						]
					}
				});
			}

			const batch = await client.messages.batches.create({ requests });
			state.batchId = batch.id;
			writeFileSync(reportPath(`ia-lot-${batch.id}`), JSON.stringify(state));
			log.success(
				`Lot ${batch.id} envoyé : ${count(ids.length)} produits, ${count(requests.length)} requêtes`
			);
		}

		// Attente : la plupart des lots finissent en moins d'une heure.
		for (;;) {
			const batch = await client.messages.batches.retrieve(state.batchId);
			const c = batch.request_counts;
			log.muted(
				`${batch.processing_status} — ${c.succeeded} réussies, ${c.errored} en erreur, ${c.processing} en cours`
			);
			if (batch.processing_status === 'ended') break;
			await new Promise((resolve) => setTimeout(resolve, 30_000));
		}

		const report = [['id', 'nom', 'rayon'].join(';')];
		const assignments: Assignment[] = [];
		const usage = { input: 0, cacheRead: 0, cacheWrite: 0, output: 0 };
		let doubts = 0;
		let invalid = 0;
		let failed = 0;

		for await (const result of await client.messages.batches.results(state.batchId)) {
			const expected = new Set(state.requests[result.custom_id] ?? []);
			if (result.result.type !== 'succeeded') {
				failed += expected.size;
				continue;
			}
			const message = result.result.message;
			usage.input += message.usage.input_tokens;
			usage.cacheRead += message.usage.cache_read_input_tokens ?? 0;
			usage.cacheWrite += message.usage.cache_creation_input_tokens ?? 0;
			usage.output += message.usage.output_tokens;

			const text = message.content.find((block) => block.type === 'text')?.text ?? '';
			let parsed: { results: { id: number; category: string }[] };
			try {
				parsed = JSON.parse(text);
			} catch {
				failed += expected.size;
				continue;
			}
			for (const { id, category } of parsed.results) {
				if (!expected.has(id)) continue;
				expected.delete(id);
				const leaf = leafByLabel.get(category);
				if (category === NO_CATEGORY) {
					doubts++;
				} else if (!leaf) {
					invalid++;
				} else {
					assignments.push({ id, categoryId: leaf.id });
					const name = products.get(id)?.name ?? '';
					report.push([id, name, leaf.path].map(csv).join(';'));
				}
			}
			doubts += expected.size; // produits omis par le modèle : laissés de côté
		}

		const reportFile = reportPath(
			dryRun ? `ia-simulation-${state.batchId}` : `ia-${state.batchId}`
		);
		writeFileSync(reportFile, report.join('\n') + '\n');

		// Tarif Batch API de Haiku 5.5 (moitié prix) : 0,05 $ / 0,25 $ par million.
		const cost =
			(usage.input * 0.05 +
				usage.cacheWrite * 0.0625 +
				usage.cacheRead * 0.005 +
				usage.output * 0.25) /
			1_000_000;
		log.success(`${count(assignments.length)} rangés par ${AI_MODEL}`);
		log.info(`${count(doubts)} laissés « À classer » (doute du modèle)`);
		if (invalid > 0) log.warn(`${count(invalid)} réponses hors liste, ignorées`);
		if (failed > 0) log.warn(`${count(failed)} produits en échec de requête, à relancer`);
		log.info(`Coût estimé : ${cost.toFixed(2)} $`);
		log.muted(`Rapport : ${reportFile}`);

		if (dryRun) return { processed: 0, note: `simulation : ${count(assignments.length)} à ranger` };
		const written = await applyAssignments(assignments, unclassifiedId);
		return { processed: written };
	}
};

await runTasks({
	title: 'Rangement de « À classer »',
	tasks: [taxonomyTask, rulesTask, aiTask],
	cleanup: closeTargetDb
});
