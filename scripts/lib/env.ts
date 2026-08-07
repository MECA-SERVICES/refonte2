/**
 * Lecture du `.env` pour les scripts CLI.
 *
 * Les scripts ne tournent pas dans SvelteKit : `$env/dynamic/private` n'est pas
 * disponible. On lit donc `.env` à la racine du projet, sans écraser les
 * variables déjà présentes dans l'environnement (qui restent prioritaires,
 * ce qui permet de surcharger ponctuellement en ligne de commande).
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Racine du projet, déduite de l'emplacement de ce fichier (`scripts/lib/`). */
export const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

let loaded = false;

/** Charge `.env` une seule fois par process. */
export function loadEnv(): void {
	if (loaded) return;
	loaded = true;

	const path = resolve(projectRoot, '.env');
	if (!existsSync(path)) return;

	for (const line of readFileSync(path, 'utf8').split('\n')) {
		const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
		if (!match) continue;

		const [, key, rawValue] = match;
		if (process.env[key] !== undefined) continue;

		// Retire les guillemets encadrants éventuels.
		process.env[key] = rawValue.trim().replace(/^(['"])([\s\S]*)\1$/, '$2');
	}
}

/** Lit une variable obligatoire, avec un message d'erreur exploitable. */
export function requireEnv(name: string): string {
	loadEnv();
	const value = process.env[name];
	if (!value) throw new Error(`Variable d'environnement manquante : ${name} (voir .env)`);
	return value;
}

/** Lit une variable optionnelle. */
export function optionalEnv(name: string): string | undefined {
	loadEnv();
	return process.env[name] || undefined;
}

/** Masque les identifiants d'une URL de connexion, pour un affichage sûr. */
export function maskUrl(url: string): string {
	return url.replace(/(:\/\/[^:]+:)[^@]+(@)/, '$1***$2');
}
