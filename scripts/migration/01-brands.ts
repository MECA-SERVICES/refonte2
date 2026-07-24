/**
 * Migration des marques (source.marques → target.brand).
 * legacy_ps_id = marques.id source (pour relier les produits ensuite).
 */
import { source, target, slugify, uniqueSlug, progress, closeAll } from './_shared';

const rows = await source`
	SELECT id, nom, actif, image_url
	FROM marques
	ORDER BY id`;

console.log(`Marques source : ${rows.length}`);

// Slugs déjà utilisés côté cible (reprise possible) + à créer.
const existing = await target`SELECT slug, legacy_ps_id FROM brand`;
const usedSlugs = new Set<string>(existing.map((r) => r.slug as string));
const alreadyImported = new Set<number>(
	existing.filter((r) => r.legacy_ps_id != null).map((r) => Number(r.legacy_ps_id))
);

const p = progress('brands');
let count = 0;

const toInsert = rows
	.filter((r) => !alreadyImported.has(Number(r.id)))
	.map((r) => ({
		name: r.nom || `Marque ${r.id}`,
		slug: uniqueSlug(slugify(r.nom || `marque-${r.id}`), usedSlugs),
		logo_url: r.image_url || null,
		is_active: r.actif === 1 || r.actif === true,
		legacy_ps_id: Number(r.id)
	}));

// Insertion par lots de 500.
for (let i = 0; i < toInsert.length; i += 500) {
	const batch = toInsert.slice(i, i + 500);
	if (batch.length) await target`INSERT INTO brand ${target(batch)}`;
	count += batch.length;
	p.tick(count, toInsert.length);
}

p.done(count);
console.log(`  (${rows.length - toInsert.length} déjà importées, ignorées)`);
await closeAll();
