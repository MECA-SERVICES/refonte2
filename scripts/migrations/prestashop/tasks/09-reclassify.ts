/**
 * Reclassification des produits — seconde moitié de l'étape 7 du cahier des charges.
 *
 * Range chaque produit dans l'arbre créé par `08-taxonomy.ts`, en appliquant les
 * règles de `taxonomy.ts` au **premier mot** de son nom (§5.1 : 300 mots couvrent
 * 69,5 % du catalogue ; la mesure de l'étape 1 donne 71,4 % avec 283 mots-clés).
 *
 * ── Ordre des paliers (§5.3), volontairement séquentiel ────────────────────
 *   1. Obsolètes  `REMPLACÉ*` → `is_active = false`, jamais rangés (~18 800)
 *   2. Bruit      préfixes d'import sans valeur métier → « À classer »
 *   3. Règles     premier mot → feuille de l'arbre (~752 000)
 *   4. Reliquat   tout le reste → « À classer » (~302 000)
 *
 * Chaque palier retire du volume au suivant : un produit `REMPLACÉ PAR 703961`
 * ne doit jamais être rangé dans « Réservoirs » parce qu'il contient « PAR ».
 *
 * ── Sécurité ───────────────────────────────────────────────────────────────
 * `--dry-run` produit le **rapport complet sans écrire une ligne** : volume par
 * règle et échantillon de 10 produits, comme l'exige le §6 étape 7 (« validé
 * avant écriture en production »). C'est le mode à utiliser en premier.
 */
import type { Task } from '../../../lib/runner.ts';
import { targetDb } from '../../../lib/target-db.ts';
import { log, count, color, progress } from '../../../lib/logger.ts';
import {
	buildKeywordIndex,
	firstWord,
	NOISE_WORDS,
	OBSOLETE_PREFIXES,
	PIECES_ROOT,
	UNCLASSIFIED
} from '../taxonomy.ts';
import { resolveKrampPath, assertKrampTargetsExist } from '../kramp-mapping.ts';

/** Lot de lecture des produits cible. */
const PAGE_SIZE = 20_000;

/** Lot d'écriture des rangements. */
const WRITE_BATCH = 5000;

interface TargetProduct {
	id: number;
	name: string;
	supplier_category_path: string | null;
}

/** Compteur par feuille, avec échantillon pour le rapport de validation. */
interface Bucket {
	path: string;
	categoryId: number;
	total: number;
	samples: string[];
}

export const reclassifyTask: Task = {
	name: 'reclassify',
	description: 'Range les produits dans le nouvel arbre (règles premier mot)',
	// `product-taxonomy` doit avoir tourné : c'est lui qui place les produits
	// finis (tondeuses, tronçonneuses…) dans la taxonomie métier. Sans lui,
	// `alreadyPlaced` est vide et les règles du premier mot rangeraient une
	// tondeuse dans « Coupe & usure ».
	dependsOn: ['taxonomy', 'product-taxonomy'],

	async run({ dryRun, limit }) {
		const sql = targetDb();
		const keywords = buildKeywordIndex();

		// --- Résolution des chemins de l'arbre vers leurs id ---
		const rows = await sql<{ id: number; name: string; parent_id: number | null }[]>`
			SELECT id, name, parent_id FROM category WHERE source = 'rule'`;

		if (rows.length === 0) {
			throw new Error('Arbre cible absent : jouer la tâche « taxonomy » avant « reclassify ».');
		}

		const byId = new Map(rows.map((c) => [Number(c.id), c]));
		const pathOf = (c: { name: string; parent_id: number | null }): string => {
			const parent = c.parent_id != null ? byId.get(Number(c.parent_id)) : undefined;
			return parent ? `${pathOf(parent)} > ${c.name}` : c.name;
		};

		const idByPath = new Map<string, number>();
		for (const c of rows) idByPath.set(pathOf(c), Number(c.id));

		const unclassifiedId = idByPath.get(`${PIECES_ROOT} > ${UNCLASSIFIED}`);
		if (!unclassifiedId) {
			throw new Error(`Nœud « ${UNCLASSIFIED} » introuvable — rejouer « taxonomy ».`);
		}

		log.muted(`${count(idByPath.size)} catégories de l'arbre cible résolues`);

		// Échoue tôt si une cible du mapping KRAMP n'existe pas dans l'arbre :
		// une faute de frappe y enverrait des milliers de produits nulle part —
		// exactement le mode de défaillance silencieux à l'origine des 81 %
		// d'orphelins. Les chemins sont comparés sans le préfixe racine.
		assertKrampTargetsExist(
			new Set(
				[...idByPath.keys()]
					.filter((p) => p.startsWith(`${PIECES_ROOT} > `))
					.map((p) => p.slice(PIECES_ROOT.length + 3))
			)
		);

		// --- Produits déjà rangés dans la taxonomie « produits & machines » ---
		// `10-product-taxonomy` reprend telle quelle la taxonomie métier de la
		// source (Tondeuses, Tronçonneuses…). Ces produits ne doivent PAS être
		// reclassés en pièces : leur rangement est déjà le bon, et les règles du
		// premier mot les enverraient dans « Coupe » ou « Moteur ».
		const machineRows = await sql<{ product_id: number }[]>`
			SELECT DISTINCT pc.product_id
			  FROM product_category pc
			  JOIN category c ON c.id = pc.category_id
			 WHERE c.source = 'legacy'`;
		const alreadyPlaced = new Set(machineRows.map((r) => Number(r.product_id)));

		if (alreadyPlaced.size > 0) {
			log.muted(
				`${count(alreadyPlaced.size)} produits déjà rangés côté « produits & machines » — épargnés`
			);
		}

		// --- Parcours des produits ---
		const [{ total }] = await sql<{ total: number }[]>`SELECT COUNT(*)::int AS total FROM product`;
		const expected = limit ?? Number(total);
		log.muted(`${count(Number(total))} produits en cible`);

		const buckets = new Map<string, Bucket>();
		const obsolete: number[] = [];
		/** Rangements à écrire : (produit, catégorie). */
		const assignments: { id: number; categoryId: number }[] = [];

		let read = 0;
		let matched = 0;
		/** Classés par le chemin fournisseur KRAMP, faute de règle sur le nom. */
		let matchedBySupplier = 0;
		let unmatched = 0;
		/** Produits épargnés car déjà rangés côté « produits & machines ». */
		let skipped = 0;
		let lastId = 0;
		const bar = progress('produits', expected);

		for (;;) {
			// La page ne dépasse jamais le reliquat de `--limit` : sans ce calcul,
			// `--limit=1000` chargerait une page entière de 20 000 et en rangerait
			// 20 000 — or c'est justement la commande d'essai prudent avant la
			// migration complète, celle qui doit écrire le moins possible.
			const remaining = limit === null ? PAGE_SIZE : Math.min(PAGE_SIZE, limit - read);
			if (remaining <= 0) break;

			const page = await sql<TargetProduct[]>`
				SELECT id, name, supplier_category_path FROM product
				 WHERE id > ${lastId}
				 ORDER BY id
				 LIMIT ${remaining}`;
			if (page.length === 0) break;

			for (const p of page) {
				const word = firstWord(p.name);

				// Palier 0 — produits déjà rangés dans la taxonomie métier reprise :
				// on ne touche à rien. Une tondeuse n'a pas à finir dans « Coupe »
				// parce que son nom commence par « TONDEUSE ».
				if (alreadyPlaced.has(Number(p.id))) {
					skipped++;
					continue;
				}

				// Palier 1 — obsolètes : sortis de la navigation, pas rangés.
				if (OBSOLETE_PREFIXES.some((prefix) => word.startsWith(prefix))) {
					obsolete.push(Number(p.id));
					continue;
				}

				// Palier 2 — bruit d'import : pas un type de pièce.
				// Palier 3 — règle sur le premier mot.
				const hit = NOISE_WORDS.has(word) ? undefined : keywords.get(word);

				// Palier 3bis — repli sur le chemin fournisseur KRAMP.
				//
				// Le premier mot reste PRIORITAIRE : il décrit le produit lui-même
				// (« COURROIE » → Courroies trapézoïdales), là où KRAMP ne dirait
				// que « Entraînement ». Mais quand aucune règle ne matche, le
				// libellé fournisseur est un signal fiable : mesuré le 2026-08-08,
				// il classe 29 956 produits de plus (KRAMP passe de 59 % à 89 %).
				let krampPath: string | null = null;
				if (!hit && p.supplier_category_path) {
					const [subFamily = '', leaf = ''] = p.supplier_category_path.split('>');
					const target = resolveKrampPath(subFamily.trim(), leaf.trim());
					if (target) krampPath = `${PIECES_ROOT} > ${target}`;
				}

				const path = hit
					? `${PIECES_ROOT} > ${hit.family} > ${hit.subFamily} > ${hit.type}`
					: (krampPath ?? `${PIECES_ROOT} > ${UNCLASSIFIED}`);

				const categoryId = hit || krampPath ? idByPath.get(path) : unclassifiedId;
				if (categoryId === undefined) {
					throw new Error(`Chemin absent de la base : « ${path} » — rejouer « taxonomy ».`);
				}

				if (hit) matched++;
				else if (krampPath) matchedBySupplier++;
				else unmatched++;

				let bucket = buckets.get(path);
				if (!bucket) {
					bucket = { path, categoryId, total: 0, samples: [] };
					buckets.set(path, bucket);
				}
				bucket.total++;
				if (bucket.samples.length < 10) bucket.samples.push(p.name);

				assignments.push({ id: Number(p.id), categoryId });
			}

			read += page.length;
			lastId = Number(page[page.length - 1].id);
			bar.tick(read);
			if (limit !== null && read >= limit) break;
		}

		bar.done(read);

		// --- Rapport de validation (§6 étape 7) ---
		log.title('Rapport de reclassification');
		const ordered = [...buckets.values()].sort((a, b) => b.total - a.total);

		for (const bucket of ordered.slice(0, 25)) {
			const share = read > 0 ? ((bucket.total / read) * 100).toFixed(1) : '0';
			console.log(
				`  ${color.bold(count(bucket.total).padStart(9))} ${share.padStart(5)}%  ${bucket.path}`
			);
			log.muted(`            ex. ${bucket.samples.slice(0, 3).join(' · ').slice(0, 90)}`);
		}
		if (ordered.length > 25) log.muted(`  … et ${count(ordered.length - 25)} autres feuilles`);

		console.log();
		const pct = (n: number) => (read > 0 ? ((n / read) * 100).toFixed(1) : '0');
		log.info(`classés par règle : ${count(matched)} (${pct(matched)} %)`);
		log.info(
			`classés via KRAMP : ${count(matchedBySupplier)} (${pct(matchedBySupplier)} %) — repli fournisseur`
		);
		log.info(`« À classer »      : ${count(unmatched)} (${pct(unmatched)} %)`);
		log.info(`produits & machines épargnés : ${count(skipped)} (${pct(skipped)} %)`);
		log.info(`obsolètes désactivés : ${count(obsolete.length)}`);

		if (dryRun) {
			log.warn('Simulation — aucune écriture. Valider le rapport, puis relancer sans --dry-run.');
			return { processed: 0, note: 'simulation' };
		}

		// --- Écriture ---
		// Table temporaire + UPDATE ... FROM : un million d'UPDATE unitaires
		// prendrait des heures, la jointure quelques secondes.
		log.step('Écriture des rangements…');
		let updated = 0;

		await sql.begin(async (tx) => {
			await tx`
				CREATE TEMP TABLE tmp_reclassify (
					product_id  int NOT NULL,
					category_id int NOT NULL
				) ON COMMIT DROP`;

			for (let i = 0; i < assignments.length; i += WRITE_BATCH) {
				const slice = assignments.slice(i, i + WRITE_BATCH).map((a) => ({
					product_id: a.id,
					category_id: a.categoryId
				}));
				await tx`INSERT INTO tmp_reclassify ${tx(slice)}`;
			}

			await tx`CREATE INDEX ON tmp_reclassify (product_id)`;
			await tx`ANALYZE tmp_reclassify`;

			// Catégorie principale : porte l'URL canonique et le fil d'Ariane.
			const result = await tx`
				UPDATE product p
				   SET category_id = t.category_id
				  FROM tmp_reclassify t
				 WHERE p.id = t.product_id
				   AND p.category_id IS DISTINCT FROM t.category_id`;
			updated = result.count;

			// Rangement N-N : c'est lui que lit la navigation (§4.1 règle n°4).
			await tx`
				INSERT INTO product_category (product_id, category_id)
				SELECT t.product_id, t.category_id FROM tmp_reclassify t
				ON CONFLICT DO NOTHING`;
		});

		// Obsolètes : désactivés en dernier, par lots pour ne pas construire une
		// clause IN de 18 000 éléments.
		let deactivated = 0;
		for (let i = 0; i < obsolete.length; i += WRITE_BATCH) {
			const slice = obsolete.slice(i, i + WRITE_BATCH);
			const result = await sql`
				UPDATE product SET is_active = false
				 WHERE id = ANY(${slice}) AND is_active`;
			deactivated += result.count;
		}

		log.success(`${count(updated)} produits rangés, ${count(deactivated)} obsolètes désactivés.`);

		return {
			processed: updated,
			note: `${count(matched)} par règle, ${count(matchedBySupplier)} via KRAMP, ${count(unmatched)} à classer, ${count(deactivated)} désactivés`
		};
	}
};
