/**
 * Actions de formulaire communes aux documents du comptoir (factures, devis) :
 * édition des lignes (`DocumentLines.svelte`) et client de passage
 * (`CustomerPicker.svelte`).
 */
import { fail, type Action } from '@sveltejs/kit';
import { createCustomerWithoutAccount } from '$lib/server/customers';
import type { ParseResult } from '$lib/server/forms';

/** Nombre décimal saisi à la française (« 1,5 »). */
export const num = (form: FormData, key: string, fallback = 0) => {
	const n = Number(String(form.get(key) ?? '').replace(',', '.'));
	return Number.isFinite(n) ? n : fallback;
};

/**
 * Exécute une opération et traduit les refus métier (`isRefusal`) en message ;
 * toute autre erreur remonte.
 */
export async function runOrFail(
	task: () => Promise<unknown>,
	isRefusal: (err: unknown) => boolean
) {
	try {
		await task();
		return { success: true as const };
	} catch (err) {
		if (isRefusal(err)) return fail(400, { message: (err as Error).message });
		throw err;
	}
}

type LineOps = {
	addProductLine: (docId: number, productId: number, quantity: number) => Promise<void>;
	addFreeLine: (
		docId: number,
		input: { label: string; quantity: number; priceTtc: number; taxRate: number }
	) => Promise<void>;
	updateLine: (
		docId: number,
		lineId: number,
		input: {
			label: string;
			quantity: number;
			priceTtc: number;
			discountPercent: number;
			taxRate: number;
		}
	) => Promise<void>;
	deleteLine: (docId: number, lineId: number) => Promise<void>;
};

/** Actions `addProduct`, `addFree`, `updateLine`, `deleteLine` d'une page document. */
export function lineActions(
	ops: LineOps,
	isRefusal: (err: unknown) => boolean
): Record<'addProduct' | 'addFree' | 'updateLine' | 'deleteLine', Action<{ id: string }>> {
	return {
		addProduct: async ({ request, params }) => {
			const form = await request.formData();
			return runOrFail(
				() =>
					ops.addProductLine(
						Number(params.id),
						Number(form.get('productId')),
						num(form, 'quantity', 1) || 1
					),
				isRefusal
			);
		},
		addFree: async ({ request, params }) => {
			const form = await request.formData();
			return runOrFail(
				() =>
					ops.addFreeLine(Number(params.id), {
						label: form.get('label')?.toString() ?? '',
						quantity: num(form, 'quantity', 1) || 1,
						priceTtc: num(form, 'priceTtc'),
						taxRate: num(form, 'taxRate', 20)
					}),
				isRefusal
			);
		},
		updateLine: async ({ request, params }) => {
			const form = await request.formData();
			return runOrFail(
				() =>
					ops.updateLine(Number(params.id), Number(form.get('lineId')), {
						label: form.get('label')?.toString() ?? '',
						quantity: num(form, 'quantity', 1),
						priceTtc: num(form, 'priceTtc'),
						discountPercent: num(form, 'discountPercent'),
						taxRate: num(form, 'taxRate', 20)
					}),
				isRefusal
			);
		},
		deleteLine: async ({ request, params }) => {
			const form = await request.formData();
			return runOrFail(
				() => ops.deleteLine(Number(params.id), Number(form.get('lineId'))),
				isRefusal
			);
		}
	};
}

/** Client de passage saisi au comptoir, créé sans compte web (e-mail facultatif). */
export async function createWalkInCustomer(form: FormData): Promise<ParseResult<{ id: number }>> {
	const str = (k: string) => form.get(k)?.toString().trim() || null;
	const firstName = str('firstName');
	const lastName = str('lastName');
	const companyName = str('companyName');
	if (!lastName && !companyName) {
		return { ok: false, error: 'Indiquez au moins le nom du client ou sa société.' };
	}
	const created = await createCustomerWithoutAccount({
		firstName: firstName ?? '',
		lastName: lastName ?? companyName ?? '',
		companyName,
		email: str('email'),
		phone: str('phone'),
		type: companyName ? 'pro' : 'particulier',
		status: 'validated',
		source: 'comptoir'
	});
	return created.ok ? { ok: true, values: { id: created.customer.id } } : created;
}
