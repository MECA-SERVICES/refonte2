import { sequence } from '@sveltejs/kit/hooks';
import { building } from '$app/environment';
import { auth } from '$lib/server/auth';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import type { Handle } from '@sveltejs/kit';
import { getTextDirection } from '$lib/paraglide/runtime';
import { paraglideMiddleware } from '$lib/paraglide/server';
import { isLockEnabled, isUnlocked, LOCK_PATH } from '$lib/server/site-lock';

const handleParaglide: Handle = ({ event, resolve }) =>
	paraglideMiddleware(event.request, ({ request, locale }) => {
		event.request = request;

		return resolve(event, {
			transformPageChunk: ({ html }) =>
				html
					.replace('%paraglide.lang%', locale)
					.replace('%paraglide.dir%', getTextDirection(locale))
		});
	});

/**
 * Verrou de préproduction : tant que `SITE_PASSWORD` est défini, aucune route
 * n'est accessible sans avoir saisi le mot de passe. Placé en tête de chaîne,
 * il protège aussi le back-office et l'API.
 */
const handleSiteLock: Handle = async ({ event, resolve }) => {
	if (!isLockEnabled() || isUnlocked(event.cookies)) return resolve(event);

	// La page de déverrouillage et ses ressources restent joignables.
	if (event.url.pathname === LOCK_PATH) return resolve(event);

	// Une navigation est redirigée ; tout le reste reçoit un refus sec.
	if (
		event.request.method === 'GET' &&
		event.request.headers.get('accept')?.includes('text/html')
	) {
		return new Response(null, { status: 303, headers: { location: LOCK_PATH } });
	}

	return new Response('Site en préparation.', { status: 401 });
};

const handleBetterAuth: Handle = async ({ event, resolve }) => {
	const session = await auth.api.getSession({ headers: event.request.headers });

	if (session) {
		event.locals.session = session.session;
		event.locals.user = session.user;
	}

	return svelteKitHandler({ event, resolve, auth, building });
};

export const handle: Handle = sequence(handleSiteLock, handleParaglide, handleBetterAuth);
