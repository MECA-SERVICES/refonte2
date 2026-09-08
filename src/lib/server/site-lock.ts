import { env } from '$env/dynamic/private';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Cookies } from '@sveltejs/kit';

/**
 * Verrouillage du site pendant la phase de préproduction.
 *
 * Tant que la boutique n'est pas prête, l'intégralité du site — vitrine,
 * back-office et API — est protégée par un mot de passe unique. Le but n'est
 * pas de sécuriser des données, mais d'éviter qu'un visiteur ou un robot
 * n'atteigne un site inachevé et ne l'indexe.
 *
 * Le verrou s'active uniquement si `SITE_PASSWORD` est renseigné : en local,
 * la variable reste vide et rien ne change. Le jour de la mise en ligne
 * publique, il suffira de la supprimer côté Railway.
 */

/** Nom du cookie portant l'autorisation d'accès. */
export const LOCK_COOKIE = 'ms_preview';

/** Durée de l'autorisation : une semaine, pour ne pas ressaisir à chaque visite. */
const MAX_AGE = 60 * 60 * 24 * 7;

/** Chemin de la page de déverrouillage. */
export const LOCK_PATH = '/acces';

/** Le verrou n'existe que si un mot de passe est configuré. */
export function isLockEnabled(): boolean {
	return Boolean(env.SITE_PASSWORD);
}

/**
 * Jeton déposé en cookie : une signature du mot de passe, jamais le mot de
 * passe lui-même. Changer `SITE_PASSWORD` invalide donc tous les accès.
 */
function expectedToken(): string {
	const secret = env.BETTER_AUTH_SECRET ?? env.SITE_PASSWORD ?? '';
	return createHmac('sha256', secret).update(String(env.SITE_PASSWORD)).digest('hex');
}

/** Comparaison à durée constante : ne renseigne pas sur le nombre de caractères justes. */
function safeEqual(a: string, b: string): boolean {
	const left = Buffer.from(a);
	const right = Buffer.from(b);
	return left.length === right.length && timingSafeEqual(left, right);
}

/** Le visiteur a-t-il déjà saisi le bon mot de passe ? */
export function isUnlocked(cookies: Cookies): boolean {
	const token = cookies.get(LOCK_COOKIE);
	return Boolean(token) && safeEqual(token!, expectedToken());
}

/** Vérifie le mot de passe saisi et, s'il est correct, dépose l'autorisation. */
export function unlock(cookies: Cookies, password: string): boolean {
	if (!safeEqual(password, String(env.SITE_PASSWORD))) return false;

	cookies.set(LOCK_COOKIE, expectedToken(), {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: process.env.NODE_ENV === 'production',
		maxAge: MAX_AGE
	});
	return true;
}
