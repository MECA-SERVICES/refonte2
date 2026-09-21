import { db } from '$lib/server/db';
import { customer } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { priceDisplayMode, resolveTaxRegime } from '$lib/tax';
import type { FieldErrors } from '$lib/server/forms';

/**
 * Domaine « Compte client » — sections 07 et 08 du cahier des charges.
 *
 * L'identité de connexion (`user`, portée par Better Auth) est distincte de la
 * fiche commerciale (`customer`). L'inscription publique crée les deux : le
 * compte via Better Auth, puis la fiche client rattachée par `user_id`.
 */

/*
 * Typologies de compte ouvertes à l'inscription (section 08).
 *
 * Le vocabulaire est défini une seule fois dans `$lib/accounts` ; il est
 * réexporté ici pour que les appelants historiques gardent leur import.
 */
export { CUSTOMER_TYPES, type CustomerType };

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

// La forme champ par champ vit dans $lib/server/forms, comme la convention
// `ParseResult` : ré-exportée ici pour les consommateurs du module compte.
export type { FieldErrors } from '$lib/server/forms';

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
 * Un compte particulier est validé d'office (R1) ; un compte professionnel ou
 * de collectivité reste en attente et **ouvre une demande de validation**
 * (R2), qui alimente la file du back-office. Les deux écritures partagent une
 * transaction : une fiche `pending` sans demande resterait invisible de
 * l'équipe, et donc jamais traitée.
 */
export async function createCustomerProfile(userId: string, values: RegistrationInput) {
	const needsReview = requiresValidation(values.type);
	const now = new Date();

	return db.transaction(async (tx) => {
		const [created] = await tx
			.insert(customer)
			.values({
				userId,
				firstName: values.firstName,
				lastName: values.lastName,
				email: values.email,
				phone: values.phone,
				type: values.type,
				status: needsReview ? 'pending' : 'validated',
				statusUpdatedAt: now,
				companyName: values.companyName,
				siret: values.siret,
				vatNumber: values.vatNumber,
				collectivityName: values.collectivityName,
				source: 'inscription',
				newsletterSubscribed: values.newsletter,
				newsletterSubscribedAt: values.newsletter ? new Date() : null
			})
			.returning();

		if (needsReview) {
			await openValidationRequest(
				created.id,
				values.type as ValidationRequestType,
				{
					companyName: values.companyName,
					siret: values.siret,
					vatNumber: values.vatNumber,
					collectivityName: values.collectivityName,
					origin: 'inscription'
				},
				tx
			);
		}

		return created;
	});
}

/** Fiche client d'un compte, si elle existe. */
export async function customerForUser(userId: string) {
	const [row] = await db.select().from(customer).where(eq(customer.userId, userId)).limit(1);
	return row;
}

/**
 * Contexte fiscal du visiteur — régime applicable et mode d'affichage.
 *
 * Résolu une fois par requête dans le layout boutique, puis transmis aux pages :
 * le régime décide du taux (R1-R3), le mode d'affichage décide de ce qu'on
 * montre (P2-P3). Un visiteur non identifié est traité comme un particulier
 * français, conformément à P3.
 */
export async function taxContextForUser(userId: string | null | undefined) {
	const profile = userId ? await customerForUser(userId) : undefined;

	return {
		regime: resolveTaxRegime(
			profile
				? {
						country: profile.billingCountry,
						type: profile.type,
						taxExemptStatus: profile.taxExemptStatus,
						status: profile.status
					}
				: null
		),
		// R8 : le HT n'est ouvert qu'à un dossier validé, pas au seul type.
		displayMode: priceDisplayMode(profile?.type, profile?.status)
	};
}
