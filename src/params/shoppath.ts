import type { ParamMatcher } from '@sveltejs/kit';

/**
 * Adresses inconnues prises en charge par la boutique.
 *
 * Le back-office et l'API ont leurs propres erreurs : une adresse
 * `/admin/…` ou `/api/…` introuvable ne doit pas s'habiller en vitrine.
 */
export const match: ParamMatcher = (param) => !/^(admin|api)(\/|$)/.test(param);
