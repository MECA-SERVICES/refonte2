/**
 * Cache mémoire simple pour les données rarement modifiées.
 *
 * Utilisé pour :
 * - Menu des catégories (invalidé lors de changement catégorie)
 * - Liste des catégories actives
 */

interface CacheEntry<T> {
	data: T;
	expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

/**
 * Récupère une valeur du cache ou l'exécute et la met en cache
 */
export async function cached<T>(
	key: string,
	fn: () => Promise<T>,
	ttlSeconds: number = 300 // 5 minutes par défaut
): Promise<T> {
	const now = Date.now();
	const entry = cache.get(key) as CacheEntry<T> | undefined;

	// Cache valide
	if (entry && entry.expiresAt > now) {
		return entry.data;
	}

	// Cache expiré ou absent : exécuter la fonction
	const data = await fn();
	cache.set(key, {
		data,
		expiresAt: now + ttlSeconds * 1000
	});

	return data;
}

/**
 * Invalide une ou plusieurs clés du cache
 */
export function invalidate(...keys: string[]): void {
	for (const key of keys) {
		cache.delete(key);
	}
}

/**
 * Invalide toutes les clés qui matchent un pattern
 */
export function invalidatePattern(pattern: RegExp): void {
	for (const key of cache.keys()) {
		if (pattern.test(key)) {
			cache.delete(key);
		}
	}
}

/**
 * Vide complètement le cache
 */
export function clear(): void {
	cache.clear();
}

/**
 * Statistiques du cache (pour debug)
 */
export function stats() {
	return {
		size: cache.size,
		keys: Array.from(cache.keys())
	};
}
