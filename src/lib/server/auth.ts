import { env } from '$env/dynamic/private';
import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { admin } from 'better-auth/plugins';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import { db } from '$lib/server/db';

export const auth = betterAuth({
	baseURL: env.ORIGIN,
	secret: env.BETTER_AUTH_SECRET,
	database: drizzleAdapter(db, { provider: 'pg' }),
	emailAndPassword: { enabled: true },
	plugins: [
		// Rôles : les nouveaux inscrits sont "customer", le personnel est "admin".
		// Seuls les rôles admin accèdent au back-office. Des rôles plus fins
		// (ex. "employee" avec permissions dédiées) pourront être ajoutés plus
		// tard via un access-control (ac/roles) au moment de construire le back-office.
		admin({
			defaultRole: 'customer'
		}),
		sveltekitCookies(getRequestEvent) // make sure this is the last plugin in the array
	]
});
