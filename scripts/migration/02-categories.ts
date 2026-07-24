/**
 * Migration des catégories (source.categories → target.category).
 *
 * legacy_ps_id = categories.id_category (l'id PrestaShop, cible des id_parent).
 * Deux passes : 1) insérer sans parent, 2) relier les parents via le mapping.
 */
import { source, target, slugify, uniqueSlug, progress, closeAll } from './_shared';

const rows = await source`
	SELECT id_category, id_parent, nom, level_depth, actif
	FROM categories
	ORDER BY level_depth, id_category`;

console.log(`Catégories source : ${rows.length}`);

const existing = await target`SELECT slug, legacy_ps_id FROM category`;
const usedSlugs = new Set<string>(existing.map((r) => r.slug as string));
const alreadyImported = new Set<number>(
	existing.filter((r) => r.legacy_ps_id != null).map((r) => Number(r.legacy_ps_id))
);

// --- Passe 1 : insérer les catégories (sans parent) ---
const p1 = progress('categories (insert)');
const toInsert = rows
	.filter((r) => !alreadyImported.has(Number(r.id_category)))
	.map((r, i) => ({
		name: r.nom || `Catégorie ${r.id_category}`,
		slug: uniqueSlug(slugify(r.nom || `categorie-${r.id_category}`), usedSlugs),
		is_active: r.actif === 1 || r.actif === true,
		position: i,
		legacy_ps_id: Number(r.id_category)
	}));

let count = 0;
for (let i = 0; i < toInsert.length; i += 500) {
	const batch = toInsert.slice(i, i + 500);
	if (batch.length) await target`INSERT INTO category ${target(batch)}`;
	count += batch.length;
	p1.tick(count, toInsert.length);
}
p1.done(count);

// --- Mapping legacy_ps_id → nouvel id ---
const mapRows = await target`SELECT id, legacy_ps_id FROM category WHERE legacy_ps_id IS NOT NULL`;
const idByLegacy = new Map<number, number>(
	mapRows.map((r) => [Number(r.legacy_ps_id), Number(r.id)])
);

// --- Passe 2 : relier les parents (UPDATE bulk par lots) ---
const pairs: { child: number; parent: number }[] = [];
for (const r of rows) {
	if (!r.id_parent || Number(r.id_parent) === 0) continue;
	const child = idByLegacy.get(Number(r.id_category));
	const parent = idByLegacy.get(Number(r.id_parent));
	if (child && parent) pairs.push({ child, parent });
}

const p2 = progress('categories (parents)');
let linked = 0;
for (let i = 0; i < pairs.length; i += 1000) {
	const batch = pairs.slice(i, i + 1000);
	const values = batch.map((pr) => `(${pr.child}, ${pr.parent})`).join(',');
	await target.unsafe(
		`UPDATE category AS c SET parent_id = v.parent
		 FROM (VALUES ${values}) AS v(child, parent) WHERE c.id = v.child`
	);
	linked += batch.length;
	p2.tick(linked, pairs.length);
}
p2.done(linked);

console.log(`  (${rows.length - toInsert.length} déjà importées)`);
await closeAll();
