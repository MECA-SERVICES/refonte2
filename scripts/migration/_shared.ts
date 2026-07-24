/**
 * Utilitaires partagés pour la migration PrestaShop → nouvelle stack.
 *
 * Deux connexions :
 *  - SOURCE : ancienne base (metro) en lecture seule
 *  - TARGET : base du projet (DATABASE_URL)
 *
 * Idempotence : chaque domaine utilise `legacy_ps_id` (ou l'id source) pour
 * détecter ce qui est déjà importé et éviter les doublons si on relance.
 */
import postgres from 'postgres';

const SOURCE_URL =
	'postgresql://postgres:YFTzdgqnDecexDOuyNZCOlpEOFylASVM@metro.proxy.rlwy.net:57921/railway';

const TARGET_URL = process.env.DATABASE_URL;
if (!TARGET_URL) throw new Error('DATABASE_URL manquant (base cible)');

export const source = postgres(SOURCE_URL, { ssl: 'require', max: 4 });
export const target = postgres(TARGET_URL, { ssl: 'require', max: 4 });

/** Slug URL-friendly, sans accents. */
export function slugify(input: string): string {
	return (input || '')
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 200);
}

/** Rend un slug unique dans un Set (suffixe -2, -3… en cas de collision). */
export function uniqueSlug(base: string, used: Set<string>): string {
	let slug = base || 'item';
	if (!used.has(slug)) {
		used.add(slug);
		return slug;
	}
	let i = 2;
	while (used.has(`${slug}-${i}`)) i++;
	const result = `${slug}-${i}`;
	used.add(result);
	return result;
}

/** Convertit une valeur numérique source en chaîne décimale ou fallback. */
export function money(v: unknown, fallback = '0'): string {
	if (v === null || v === undefined) return fallback;
	const n = Number(v);
	return Number.isFinite(n) ? String(n) : fallback;
}

/** Timer + log de progression. */
export function progress(label: string) {
	const start = Date.now();
	return {
		tick(done: number, total: number) {
			const pct = ((done / total) * 100).toFixed(1);
			const secs = ((Date.now() - start) / 1000).toFixed(0);
			process.stdout.write(`\r  ${label}: ${done}/${total} (${pct}%) — ${secs}s   `);
		},
		done(count: number) {
			const secs = ((Date.now() - start) / 1000).toFixed(0);
			console.log(`\r  ✓ ${label}: ${count} lignes en ${secs}s              `);
		}
	};
}

export async function closeAll() {
	await Promise.all([source.end(), target.end()]);
}
