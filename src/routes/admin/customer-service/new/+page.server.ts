import { error, fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { customer, order } from '$lib/server/db/schema';
import { createStaffThread, listSupportCategories, SupportError } from '$lib/server/support';

/**
 * Nouvelle conversation à l'initiative de l'équipe (CDC 27 §8.4).
 *
 * Préremplie depuis une fiche client (`?customer=`) ou une commande
 * (`?order=`), pour ne pas ressaisir ce que l'écran d'origine connaît déjà.
 */
export const load: PageServerLoad = async ({ url }) => {
	const customerId = Number(url.searchParams.get('customer')) || null;
	const orderId = Number(url.searchParams.get('order')) || null;

	let email = '';
	let orderReference = '';

	if (orderId) {
		const [o] = await db
			.select({ reference: order.reference, email: customer.email })
			.from(order)
			.leftJoin(customer, eq(customer.id, order.customerId))
			.where(eq(order.id, orderId))
			.limit(1);
		if (o) {
			orderReference = o.reference;
			email = o.email ?? '';
		}
	} else if (customerId) {
		const [c] = await db
			.select({ email: customer.email })
			.from(customer)
			.where(eq(customer.id, customerId))
			.limit(1);
		email = c?.email ?? '';
	}

	const categories = await listSupportCategories({ activeOnly: true });
	return {
		email,
		orderReference,
		categories: categories.map((c) => ({ id: c.id, label: c.label }))
	};
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		if (!locals.user) error(401);
		const form = await request.formData();
		try {
			const id = await createStaffThread(form, locals.user.id);
			redirect(303, `/admin/customer-service/${id}`);
		} catch (cause) {
			if (cause instanceof SupportError) {
				return fail(400, {
					message: cause.message,
					values: Object.fromEntries(
						['email', 'orderReference', 'subject', 'categoryId', 'priority', 'content'].map((k) => [
							k,
							form.get(k)?.toString() ?? ''
						])
					)
				});
			}
			throw cause;
		}
	}
};
