/**
 * Carnet d'adresses côté client — CDC section 09.
 *
 * Distinct de `customers.ts`, qui sert le back-office : ici, chaque opération
 * est bornée au client propriétaire (R1). Le `customerId` n'est jamais accepté
 * depuis le formulaire, il est toujours résolu depuis la session.
 */

import { and, asc, desc, eq, ne } from 'drizzle-orm';
import { db } from './db';
import { address } from './db/customer.schema';

/** Champs saisissables par le client. */
export type AddressInput = {
	label: string | null;
	firstName: string;
	lastName: string;
	company: string | null;
	line1: string;
	line2: string | null;
	postalCode: string;
	city: string;
	country: string;
	phone: string | null;
	isDefaultShipping: boolean;
	isDefaultBilling: boolean;
};

/** Adresses du client, les adresses par défaut en tête. */
export async function listCustomerAddresses(customerId: number) {
	return db
		.select()
		.from(address)
		.where(eq(address.customerId, customerId))
		.orderBy(desc(address.isDefaultShipping), desc(address.isDefaultBilling), asc(address.id));
}

/**
 * Adresse du carnet, si elle appartient bien au client (R1).
 *
 * Retourne `undefined` plutôt que de lever : l'appelant décide du code HTTP.
 */
export async function getCustomerAddress(customerId: number, addressId: number) {
	const [row] = await db
		.select()
		.from(address)
		.where(and(eq(address.id, addressId), eq(address.customerId, customerId)))
		.limit(1);
	return row;
}

/**
 * Retire le statut « par défaut » aux autres adresses du client (R2).
 *
 * Une seule adresse de livraison et une seule de facturation peuvent le porter ;
 * les deux indicateurs sont indépendants, une même adresse pouvant cumuler les
 * deux rôles.
 */
async function clearDefaults(customerId: number, keepId: number, input: AddressInput) {
	if (input.isDefaultShipping) {
		await db
			.update(address)
			.set({ isDefaultShipping: false })
			.where(and(eq(address.customerId, customerId), ne(address.id, keepId)));
	}
	if (input.isDefaultBilling) {
		await db
			.update(address)
			.set({ isDefaultBilling: false })
			.where(and(eq(address.customerId, customerId), ne(address.id, keepId)));
	}
}

/**
 * Ajoute une adresse au carnet.
 *
 * La première adresse enregistrée devient d'office l'adresse par défaut : sans
 * cela, un client n'ayant jamais coché la case n'en aurait aucune, et le tunnel
 * de commande n'aurait rien à présélectionner.
 */
export async function createCustomerAddress(customerId: number, input: AddressInput) {
	const existing = await listCustomerAddresses(customerId);
	const isFirst = existing.length === 0;

	const [row] = await db
		.insert(address)
		.values({
			...input,
			customerId,
			isDefaultShipping: input.isDefaultShipping || isFirst,
			isDefaultBilling: input.isDefaultBilling || isFirst
		})
		.returning();

	await clearDefaults(customerId, row.id, input);
	return row;
}

/** Met à jour une adresse du client. Retourne `undefined` si elle ne lui appartient pas (R1). */
export async function updateCustomerAddress(
	customerId: number,
	addressId: number,
	input: AddressInput
) {
	const owned = await getCustomerAddress(customerId, addressId);
	if (!owned) return undefined;

	const [row] = await db
		.update(address)
		.set({ ...input, updatedAt: new Date() })
		.where(and(eq(address.id, addressId), eq(address.customerId, customerId)))
		.returning();

	await clearDefaults(customerId, addressId, input);
	return row;
}

/**
 * Supprime une adresse du carnet.
 *
 * Aucune vérification d'usage : une commande passée conserve une copie figée de
 * l'adresse (R3), la suppression ne l'altère donc jamais.
 */
export async function deleteCustomerAddress(customerId: number, addressId: number) {
	const owned = await getCustomerAddress(customerId, addressId);
	if (!owned) return false;

	await db.delete(address).where(and(eq(address.id, addressId), eq(address.customerId, customerId)));

	// Le carnet ne doit pas rester sans adresse par défaut : on promeut la plus
	// ancienne restante, celle que le client utilise vraisemblablement le plus.
	if (owned.isDefaultShipping || owned.isDefaultBilling) {
		const [next] = await db
			.select()
			.from(address)
			.where(eq(address.customerId, customerId))
			.orderBy(asc(address.id))
			.limit(1);

		if (next) {
			await db
				.update(address)
				.set({
					isDefaultShipping: next.isDefaultShipping || owned.isDefaultShipping,
					isDefaultBilling: next.isDefaultBilling || owned.isDefaultBilling
				})
				.where(eq(address.id, next.id));
		}
	}

	return true;
}

/** Champs obligatoires manquants, sous forme de messages prêts à afficher. */
export function parseAddressForm(form: FormData):
	| { error: string }
	| { values: AddressInput } {
	const str = (key: string) => form.get(key)?.toString().trim() || null;

	const firstName = str('firstName');
	const lastName = str('lastName');
	const line1 = str('line1');
	const postalCode = str('postalCode');
	const city = str('city');

	if (!firstName || !lastName || !line1 || !postalCode || !city) {
		return { error: 'Nom, prénom, adresse, code postal et ville sont obligatoires.' };
	}

	return {
		values: {
			label: str('label'),
			firstName,
			lastName,
			company: str('company'),
			line1,
			line2: str('line2'),
			postalCode,
			city,
			// Le pays reste sur deux lettres : c'est lui qui décidera du
			// transporteur applicable dans le tunnel de commande.
			country: (str('country') ?? 'FR').toUpperCase().slice(0, 2),
			phone: str('phone'),
			isDefaultShipping: form.get('isDefaultShipping') != null,
			isDefaultBilling: form.get('isDefaultBilling') != null
		}
	};
}
