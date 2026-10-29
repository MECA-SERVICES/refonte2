/**
 * Interlocuteurs d'un client pro ou d'un fournisseur (voir `contact.schema.ts`) :
 * lecture, ajout, modification, suppression depuis leur fiche.
 */
import { fail, type Action } from '@sveltejs/kit';
import { and, asc, desc, eq, type SQL } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { contact } from '$lib/server/db/contact.schema';
import { formFields, type ParseResult } from '$lib/server/forms';

/** Fiche à laquelle le contact appartient. */
export type ContactOwner = { customerId: number } | { supplierId: number };

const ownedBy = (owner: ContactOwner): SQL =>
	'customerId' in owner
		? eq(contact.customerId, owner.customerId)
		: eq(contact.supplierId, owner.supplierId);

export type ContactInput = {
	firstName: string | null;
	lastName: string;
	role: string | null;
	email: string | null;
	phone: string | null;
	mobile: string | null;
	note: string | null;
};

export function parseContactForm(form: FormData): ParseResult<ContactInput> {
	const { str } = formFields(form);
	const lastName = str('lastName');
	if (!lastName) return { ok: false, error: 'Indiquez le nom du contact.' };
	return {
		ok: true,
		values: {
			firstName: str('firstName'),
			lastName,
			role: str('role'),
			email: str('email')?.toLowerCase() ?? null,
			phone: str('phone'),
			mobile: str('mobile'),
			note: str('note')
		}
	};
}

/** Contacts de la fiche, les actifs d'abord. */
export function listContacts(owner: ContactOwner) {
	return db
		.select()
		.from(contact)
		.where(ownedBy(owner))
		.orderBy(desc(contact.isActive), asc(contact.lastName));
}

export async function addContact(owner: ContactOwner, input: ContactInput) {
	await db.insert(contact).values({ ...input, ...owner });
}

/** Modifie un contact de cette fiche (jamais celui d'une autre). */
export async function updateContact(owner: ContactOwner, id: number, input: ContactInput) {
	await db
		.update(contact)
		.set({ ...input, updatedAt: new Date() })
		.where(and(eq(contact.id, id), ownedBy(owner)));
}

export async function deleteContact(owner: ContactOwner, id: number) {
	await db.delete(contact).where(and(eq(contact.id, id), ownedBy(owner)));
}

/**
 * Actions `addContact`, `updateContact`, `deleteContact` d'une fiche client ou
 * fournisseur (`ContactsCard.svelte`), pour la fiche que désigne `ownerOf`.
 */
export function contactActions(
	ownerOf: (params: { id: string }) => ContactOwner
): Record<'addContact' | 'updateContact' | 'deleteContact', Action<{ id: string }>> {
	return {
		addContact: async ({ request, params }) => {
			const parsed = parseContactForm(await request.formData());
			if (!parsed.ok) return fail(400, { message: parsed.error });
			await addContact(ownerOf(params), parsed.values);
			return { success: true };
		},
		updateContact: async ({ request, params }) => {
			const form = await request.formData();
			const parsed = parseContactForm(form);
			if (!parsed.ok) return fail(400, { message: parsed.error });
			await updateContact(ownerOf(params), Number(form.get('contactId')), parsed.values);
			return { success: true };
		},
		deleteContact: async ({ request, params }) => {
			const id = Number((await request.formData()).get('contactId'));
			await deleteContact(ownerOf(params), id);
			return { success: true };
		}
	};
}
