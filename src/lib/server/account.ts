import { db } from '$lib/server/db';
import { customer } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Domaine « Compte client » — sections 07 et 08 du cahier des charges.
 *
 * L'identité de connexion (`user`, portée par Better Auth) est distincte de la
 * fiche commerciale (`customer`). L'inscription publique crée les deux : le
 * compte via Better Auth, puis la fiche client rattachée par `user_id`.
 */

/** Typologies de compte ouvertes à l'inscription (section 08). */
export const CUSTOMER_TYPES = ['particulier', 'pro', 'collectivite'] as const;
export type CustomerType = (typeof CUSTOMER_TYPES)[number];

/** Longueur minimale du mot de passe (règle R11 de la section 07). */
export const PASSWORD_MIN_LENGTH = 8;

/** Champs saisis à l'inscription, déjà nettoyés. */
export type RegistrationInput = {
	email: string;
	firstName: string;
	lastName: string;
	phone: string | null;
	type: CustomerType;
	companyName: string | null;
	siret: string | null;
	vatNumber: string | null;
	collectivityName: string | null;
	newsletter: boolean;
};

/** Erreurs de saisie, indexées par nom de champ. */
export type FieldErrors = Partial<Record<string, string>>;

function clean(value: FormDataEntryValue | null): string {
	return typeof value === 'string' ? value.trim() : '';
}

/**
 * Valide le formulaire d'inscription et normalise ses valeurs.
 *
 * Les contrôles officiels du SIRET et du numéro de TVA (section 08) ne sont pas
 * encore branchés : seul le format est vérifié ici.
 */
export function parseRegistration(form: FormData): {
	values: RegistrationInput;
	password: string;
	errors: FieldErrors;
} {
	const email = clean(form.get('email')).toLowerCase();
	const password = typeof form.get('password') === 'string' ? String(form.get('password')) : '';
	const firstName = clean(form.get('firstName'));
	const lastName = clean(form.get('lastName'));
	const phone = clean(form.get('phone'));
	const rawType = clean(form.get('type'));
	const companyName = clean(form.get('companyName'));
	const siret = clean(form.get('siret')).replace(/\s/g, '');
	const vatNumber = clean(form.get('vatNumber')).replace(/\s/g, '').toUpperCase();
	const collectivityName = clean(form.get('collectivityName'));

	const type = (CUSTOMER_TYPES as readonly string[]).includes(rawType)
		? (rawType as CustomerType)
		: 'particulier';

	const errors: FieldErrors = {};

	if (!email) errors.email = 'Adresse email requise.';
	else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errors.email = 'Adresse email invalide.';

	if (!password) errors.password = 'Mot de passe requis.';
	else if (password.length < PASSWORD_MIN_LENGTH)
		errors.password = `Le mot de passe doit comporter au moins ${PASSWORD_MIN_LENGTH} caractères.`;

	if (!firstName) errors.firstName = 'Prénom requis.';
	if (!lastName) errors.lastName = 'Nom requis.';

	// Champs propres aux professionnels et aux collectivités (section 08).
	if (type === 'pro') {
		if (!companyName) errors.companyName = 'Raison sociale requise.';
		if (!siret) errors.siret = 'Numéro SIRET requis.';
		else if (!/^\d{14}$/.test(siret)) errors.siret = 'Le SIRET comporte 14 chiffres.';
		if (vatNumber && !/^[A-Z]{2}[A-Z0-9]{2,13}$/.test(vatNumber))
			errors.vatNumber = 'Numéro de TVA intracommunautaire invalide.';
	}

	if (type === 'collectivite' && !collectivityName) {
		errors.collectivityName = 'Nom de la collectivité requis.';
	}

	return {
		values: {
			email,
			firstName,
			lastName,
			phone: phone || null,
			type,
			companyName: companyName || null,
			siret: siret || null,
			vatNumber: vatNumber || null,
			collectivityName: collectivityName || null,
			newsletter: form.get('newsletter') != null
		},
		password,
		errors
	};
}

/**
 * Crée la fiche client rattachée à un compte d'authentification.
 *
 * Un compte particulier est actif immédiatement ; un compte professionnel ou
 * de collectivité reste en attente de validation par l'équipe (section 08).
 */
export async function createCustomerProfile(userId: string, values: RegistrationInput) {
	const [created] = await db
		.insert(customer)
		.values({
			userId,
			firstName: values.firstName,
			lastName: values.lastName,
			email: values.email,
			phone: values.phone,
			type: values.type,
			status: values.type === 'particulier' ? 'validated' : 'pending',
			companyName: values.companyName,
			siret: values.siret,
			vatNumber: values.vatNumber,
			collectivityName: values.collectivityName,
			source: 'inscription',
			newsletterSubscribed: values.newsletter,
			newsletterSubscribedAt: values.newsletter ? new Date() : null
		})
		.returning();

	return created;
}

/** Fiche client d'un compte, si elle existe. */
export async function customerForUser(userId: string) {
	const [row] = await db.select().from(customer).where(eq(customer.userId, userId)).limit(1);
	return row;
}
