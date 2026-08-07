/**
 * Helpers de transformation source → cible, communs à tous les imports.
 *
 * `slugify` réplique volontairement `src/lib/server/slug.ts` : les scripts
 * tournent hors SvelteKit et ne peuvent pas résoudre l'alias `$lib`. Toute
 * évolution de la règle de slug doit être reportée dans les deux fichiers.
 */

/** Transforme un texte en slug URL-friendly (minuscules, tirets, sans accents). */
export function slugify(input: string): string {
	return (input || '')
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '') // diacritiques combinants
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 200);
}

/** Rend un slug unique au sein d'un `Set` (suffixes -2, -3… en cas de collision). */
export function uniqueSlug(base: string, used: Set<string>): string {
	const seed = base || 'item';
	if (!used.has(seed)) {
		used.add(seed);
		return seed;
	}

	let i = 2;
	while (used.has(`${seed}-${i}`)) i++;

	const result = `${seed}-${i}`;
	used.add(result);
	return result;
}

/** Convertit une valeur source en décimal Postgres, ou `fallback` si invalide. */
export function money(value: unknown, fallback: string | null = '0'): string | null {
	if (value === null || value === undefined || value === '') return fallback;
	const n = Number(value);
	return Number.isFinite(n) ? String(n) : fallback;
}

/** Normalise un booléen MySQL (`0`/`1`, `'0'`/`'1'`, buffer) en booléen JS. */
export function bool(value: unknown): boolean {
	if (typeof value === 'boolean') return value;
	if (typeof value === 'number') return value === 1;
	if (typeof value === 'string') return value === '1' || value.toLowerCase() === 'true';
	if (Buffer.isBuffer(value)) return value[0] === 1;
	return false;
}

/** Texte nettoyé, ou `null` si vide — évite les chaînes vides en base. */
export function text(value: unknown): string | null {
	if (value === null || value === undefined) return null;
	const s = String(value).trim();
	return s === '' ? null : s;
}

/** Date valide, ou `fallback`. PrestaShop stocke des `0000-00-00` illégaux. */
export function date(value: unknown, fallback: Date = new Date()): Date {
	if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
	if (typeof value === 'string') {
		const d = new Date(value);
		if (!Number.isNaN(d.getTime()) && d.getFullYear() > 1970) return d;
	}
	return fallback;
}

/** Tronque une chaîne à `max` caractères (colonnes contraintes, ex. ean13). */
export function truncate(value: unknown, max: number): string | null {
	const s = text(value);
	return s === null ? null : s.slice(0, max);
}
