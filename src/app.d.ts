import type { User, Session } from 'better-auth';

// Le plugin admin ajoute `role` / `banned` sur l'utilisateur.
type AuthUser = User & {
	role?: string | null;
	banned?: boolean | null;
};

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		interface Locals {
			user?: AuthUser;
			session?: Session;
		}

		// interface Error {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
