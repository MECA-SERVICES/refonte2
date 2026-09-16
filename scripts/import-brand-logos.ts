/**
 * Récupère les logos de marque depuis l'ancienne boutique PrestaShop.
 *
 * PrestaShop expose les logos à l'adresse `/img/m/<id>.jpg`, où l'identifiant
 * est celui conservé dans `brand.legacy_ps_id`. Chaque adresse est vérifiée
 * avant d'être enregistrée : un identifiant sans logo renvoie une page HTML, et
 * non une image.
 *
 * Usage :
 *   bun run brands:logos              # vérifie et enregistre
 *   bun run brands:logos -- --dry-run # vérifie seulement
 */

import postgres from 'postgres';
import { loadEnv } from './lib/env.ts';

loadEnv();

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL manquant');

const dryRun = process.argv.includes('--dry-run');
const sql = postgres(url, { ssl: 'require' });

const BASE = 'https://www.mecaservicesshop.fr/img/m';

/** Requêtes simultanées : assez pour aller vite, sans saturer l'ancien site. */
const CONCURRENCY = 12;

/**
 * Vérifie qu'une adresse sert bien une image.
 *
 * PrestaShop répond 200 avec une page d'erreur HTML lorsqu'un logo n'existe
 * pas : le code de statut ne suffit donc pas, il faut lire le type de contenu.
 */
async function isImage(target: string): Promise<boolean> {
	try {
		const response = await fetch(target, { method: 'HEAD', signal: AbortSignal.timeout(10_000) });
		if (!response.ok) return false;
		return (response.headers.get('content-type') ?? '').startsWith('image/');
	} catch {
		return false;
	}
}

const brands = await sql<{ id: number; name: string; legacy_ps_id: number }[]>`
	SELECT id, name, legacy_ps_id FROM brand
	WHERE legacy_ps_id IS NOT NULL AND (logo_url IS NULL OR logo_url = '')
	ORDER BY id
`;

console.log(`\n=== Logos de marque ${dryRun ? '(vérification seule)' : ''} ===\n`);
console.log(`${brands.length.toLocaleString('fr-FR')} marques à traiter\n`);

let found = 0;
let missing = 0;

for (let i = 0; i < brands.length; i += CONCURRENCY) {
	const batch = brands.slice(i, i + CONCURRENCY);

	const results = await Promise.all(
		batch.map(async (brand) => {
			const logo = `${BASE}/${brand.legacy_ps_id}.jpg`;
			return { brand, logo, ok: await isImage(logo) };
		})
	);

	const valid = results.filter((r) => r.ok);
	found += valid.length;
	missing += results.length - valid.length;

	if (!dryRun && valid.length > 0) {
		// Une mise à jour par lot : un aller-retour au lieu de douze.
		await sql`
			UPDATE brand SET logo_url = v.logo, updated_at = now()
			FROM (VALUES ${sql(valid.map((r) => [r.brand.id, r.logo]))}) AS v(id, logo)
			WHERE brand.id = v.id::int
		`;
	}

	process.stdout.write(
		`\r  ${Math.min(i + CONCURRENCY, brands.length)} / ${brands.length} · ${found} logo(s) trouvé(s)`
	);
}

console.log('\n');
console.log(`logos trouvés    : ${found.toLocaleString('fr-FR')}`);
console.log(`sans logo        : ${missing.toLocaleString('fr-FR')}\n`);

await sql.end();
