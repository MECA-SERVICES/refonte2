import { createAuthClient } from 'better-auth/svelte';
import { adminClient } from 'better-auth/client/plugins';

/**
 * Client d'authentification better-auth (navigateur).
 * Le plugin admin expose les actions de gestion des rôles/bannissement.
 */
export const authClient = createAuthClient({
	plugins: [adminClient()]
});

export const { signIn, signOut, signUp, useSession } = authClient;
