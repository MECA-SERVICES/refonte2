/**
 * Extraction des caractéristiques techniques des produits.
 *
 * Parcourt les descriptions contenant un tableau HTML, en extrait les couples
 * « libellé / valeur » et les écrit dans `product_spec`, afin de rendre le
 * catalogue filtrable sur ses caractéristiques réelles.
 *
 * Le mode `--dry-run` n'écrit rien : il produit le rapport des libellés
 * rencontrés, de leur fréquence et de leur taux de valeurs numériques. C'est
 * ce rapport qui sert à décider des facettes à exposer au client.
 *
 * Usage :
 *   bun run specs:analyze              # rapport, aucune écriture
 *   bun run specs:extract              # écriture en base
 *   bun run specs:extract -- --limit=5000
 */

import postgres from 'postgres';
import { loadEnv } from './lib/env.ts';
import { extractSpecs } from './lib/product-specs.ts';

loadEnv();

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL manquant');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const limitArg = args.find((a) => a.startsWith('--limit='));
const limit = limitArg ? Number(limitArg.split('=')[1]) : null;

/** Produits traités par lot : compromis entre mémoire et allers-retours SQL. */
const BATCH = 2000;

/** Lignes insérées par requête, sous la limite de 65 534 paramètres de Postgres. */
const INSERT_CHUNK = 5000;

// Le parcours dure plusieurs dizaines de minutes : sans garde-fou, une coupure
// réseau (`ETIMEDOUT`) interrompt le script à mi-course, laissant une extraction
// partielle qu'un simple code de sortie ne permet pas de distinguer d'un succès.
const sql = postgres(url, {
	ssl: 'require',
	idle_timeout: 0,
	connect_timeout: 60,
	max_lifetime: 0
});

/** Rejoue une requête interrompue par une coupure réseau passagère. */
async function withRetry<T>(label: string, run: () => Promise<T>, attempts = 5): Promise<T> {
	for (let attempt = 1; ; attempt++) {
		try {
			return await run();
		} catch (error) {
			if (attempt >= attempts) throw error;
			console.warn(`\n  ${label} — reprise ${attempt}/${attempts} (${(error as Error).message})`);
			await new Promise((r) => setTimeout(r, 2000 * attempt));
		}
	}
}

type NameStat = { total: number; numeric: number; samples: Set<string> };
const stats = new Map<string, NameStat>();

let scanned = 0;
let withSpecs = 0;
let specCount = 0;
let written = 0;

console.log(`\n=== Extraction des caractéristiques ${dryRun ? '(analyse seule)' : ''} ===\n`);

const [{ total }] = await sql<{ total: number }[]>`
	SELECT count(*)::int AS total FROM product
	WHERE is_active AND (
			description ILIKE '%<tr%' OR short_description ILIKE '%<tr%'
			-- Fiches machines sans tableau : couples « Libellé : Valeur » en texte.
			OR description LIKE '%:%' OR short_description LIKE '%:%'
		)
`;
const target = limit ? Math.min(limit, total) : total;
console.log(`${target.toLocaleString('fr-FR')} produits à examiner\n`);

for (let offset = 0; offset < target; offset += BATCH) {
	const rows = await withRetry(
		`lecture offset ${offset}`,
		() => sql<{ id: number; description: string; short_description: string }[]>`
		SELECT id, description, short_description FROM product
		WHERE is_active AND (
			description ILIKE '%<tr%' OR short_description ILIKE '%<tr%'
			-- Fiches machines sans tableau : couples « Libellé : Valeur » en texte.
			OR description LIKE '%:%' OR short_description LIKE '%:%'
		)
		ORDER BY id
		LIMIT ${Math.min(BATCH, target - offset)} OFFSET ${offset}
	`
	);
	if (rows.length === 0) break;

	const pending: {
		productId: number;
		name: string;
		value: string;
		num: number | null;
		unit: string | null;
	}[] = [];

	for (const row of rows) {
		scanned++;
		const specs = extractSpecs(row.description, row.short_description);
		if (specs.length === 0) continue;

		withSpecs++;
		specCount += specs.length;

		for (const spec of specs) {
			const stat = stats.get(spec.name) ?? { total: 0, numeric: 0, samples: new Set<string>() };
			stat.total++;
			if (spec.valueNum !== null) stat.numeric++;
			if (stat.samples.size < 4) stat.samples.add(spec.value);
			stats.set(spec.name, stat);

			pending.push({
				productId: row.id,
				name: spec.name,
				value: spec.value,
				num: spec.valueNum,
				unit: spec.unit
			});
		}
	}

	if (!dryRun && pending.length > 0) {
		// Postgres plafonne à 65 534 paramètres par requête ; à 5 colonnes par
		// ligne, on insère donc par tranches largement en deçà de cette limite.
		for (let i = 0; i < pending.length; i += INSERT_CHUNK) {
			const chunk = pending.slice(i, i + INSERT_CHUNK);

			// `ON CONFLICT` rend le script rejouable : une seconde exécution met à
			// jour les valeurs au lieu de dupliquer les lignes.
			await withRetry(
				`écriture offset ${offset}`,
				() => sql`
				INSERT INTO product_spec ${sql(
					chunk.map((p) => ({
						product_id: p.productId,
						name: p.name,
						value: p.value,
						value_num: p.num,
						unit: p.unit
					}))
				)}
				ON CONFLICT (product_id, name) DO UPDATE
				SET value = EXCLUDED.value, value_num = EXCLUDED.value_num, unit = EXCLUDED.unit
			`
			);
			written += chunk.length;
		}
	}

	process.stdout.write(
		`\r  ${scanned.toLocaleString('fr-FR')} / ${target.toLocaleString('fr-FR')}`
	);
}

console.log('\n');
console.log(`produits examinés          : ${scanned.toLocaleString('fr-FR')}`);
console.log(`dont exploitables          : ${withSpecs.toLocaleString('fr-FR')}`);
console.log(`caractéristiques extraites : ${specCount.toLocaleString('fr-FR')}`);
if (!dryRun) console.log(`lignes écrites             : ${written.toLocaleString('fr-FR')}`);
console.log(`libellés distincts         : ${stats.size.toLocaleString('fr-FR')}\n`);

console.log('--- Caractéristiques les plus fréquentes ---\n');
console.log('  produits   %num  libellé / exemples');
for (const [name, stat] of [...stats].sort((a, b) => b[1].total - a[1].total).slice(0, 40)) {
	const pct = Math.round((stat.numeric / stat.total) * 100);
	const samples = [...stat.samples].slice(0, 3).join(' · ').slice(0, 60);
	console.log(
		`  ${String(stat.total).padStart(8)}  ${String(pct).padStart(4)}%  ${name.slice(0, 40).padEnd(42)}${samples}`
	);
}
console.log();

await sql.end();
