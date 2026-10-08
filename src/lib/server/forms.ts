/**
 * Parsing de formulaires — convention unique pour tout le projet.
 *
 * Toute fonction `parse*Form` retourne un `ParseResult<T>` et se teste par
 * `if (!parsed.ok)`. Les helpers d'extraction (`str`, `num`, `int`) vivent ici :
 * avant d'en redéfinir un dans un module, vérifier qu'il n'est pas déjà là.
 */

import { round2 } from '$lib/money';

/**
 * Résultat d'une analyse de formulaire.
 *
 * Union discriminée par `ok` : un simple `'values' in out` ne suffirait pas à
 * convaincre TypeScript que la valeur est définie.
 */
export type ParseResult<T> = { ok: false; error: string } | { ok: true; values: T };

/**
 * Erreurs de saisie champ par champ, indexées par nom de champ.
 *
 * Réservé aux grands formulaires publics (inscription) où un message global ne
 * suffit pas ; partout ailleurs, `ParseResult<T>` est la convention.
 */
export type FieldErrors = Partial<Record<string, string>>;

/** Helpers d'extraction liés à un formulaire : `const { str, num } = formFields(form)`. */
export function formFields(form: FormData) {
	return {
		/** Chaîne nettoyée, ou null si vide. */
		str(key: string): string | null {
			const s = form.get(key)?.toString().trim();
			return s ? s : null;
		},
		/** Nombre décimal sous forme de chaîne (colonnes numeric SQL), ou null. */
		num(key: string): string | null {
			const s = form.get(key)?.toString().trim().replace(',', '.');
			if (!s) return null;
			return Number.isNaN(Number(s)) ? null : s;
		},
		/** Montant arrondi au centime (colonnes numeric SQL), ou null. */
		money(key: string): string | null {
			const s = form.get(key)?.toString().trim().replace(',', '.');
			if (!s) return null;
			const n = Number(s);
			return Number.isFinite(n) ? round2(n).toFixed(2) : null;
		},
		/** Entier, avec repli si la saisie n'en est pas un. */
		int(key: string, fallback = 0): number {
			const n = Number(form.get(key)?.toString().trim());
			return Number.isInteger(n) ? n : fallback;
		},
		/** Case à cocher : présente = vrai. */
		bool(key: string): boolean {
			return form.get(key) != null;
		},
		/**
		 * Date issue d'un champ `date` ou `datetime-local`, ou null.
		 *
		 * Une saisie illisible vaut « non renseigné » plutôt qu'une date
		 * invalide, qui ferait échouer l'insertion en base.
		 */
		date(key: string): Date | null {
			const raw = form.get(key)?.toString().trim();
			if (!raw) return null;
			const parsed = new Date(raw);
			return Number.isNaN(parsed.getTime()) ? null : parsed;
		}
	};
}
