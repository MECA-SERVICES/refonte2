/**
 * Relie les parents des catégories en une seule requête bulk (rapide).
 * À lancer après 02-categories.ts (qui a inséré les catégories).
 */
import { source, target, closeAll } from './_shared';

const rows = await source`
	SELECT id_category, id_parent
	FROM categories
	WHERE id_parent IS NOT NULL AND id_parent != 0`;

// Mapping legacy_ps_id → nouvel id (cible).
const mapRows = await target`SELECT id, legacy_ps_id FROM category WHERE legacy_ps_id IS NOT NULL`;
const idByLegacy = new Map<number, number>(
	mapRows.map((r) => [Number(r.legacy_ps_id), Number(r.id)])
);

// Construit les paires (childId, parentId) résolues.
const pairs: { child: number; parent: number }[] = [];
for (const r of rows) {
	const child = idByLegacy.get(Number(r.id_category));
	const parent = idByLegacy.get(Number(r.id_parent));
	if (child && parent) pairs.push({ child, parent });
}

console.log(`Paires parent/enfant à relier : ${pairs.length}`);

// UPDATE bulk par lots via une table de valeurs.
let done = 0;
for (let i = 0; i < pairs.length; i += 1000) {
	const batch = pairs.slice(i, i + 1000);
	const values = batch.map((p) => `(${p.child}, ${p.parent})`).join(',');
	await target.unsafe(
		`UPDATE category AS c SET parent_id = v.parent
		 FROM (VALUES ${values}) AS v(child, parent)
		 WHERE c.id = v.child`
	);
	done += batch.length;
	process.stdout.write(`\r  liés: ${done}/${pairs.length}   `);
}
console.log(`\n  ✓ ${done} parents reliés`);
await closeAll();
