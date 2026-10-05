import { fail, redirect } from '@sveltejs/kit';
import { and, desc, eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { requireCustomer } from '../../guard';
import { db } from '$lib/server/db';
import { order, product } from '$lib/server/db/schema';
import { createCustomerThread, listSupportCategories, SupportError } from '$lib/server/support';

/**
 * Nouveau message au service client (CDC 27 §8.1).
 *
 * Préremplissage selon l'origine : une fiche produit (`?produit=`) propose un
 * objet citant la pièce, une commande (`?commande=`) la présélectionne.
 */
export const load: PageServerLoad = async ({ locals, url }) => {
	// Le contexte est conservé à travers la connexion.
	const profile = await requireCustomer(locals, url.pathname + url.search);

	const productId = Number(url.searchParams.get('produit')) || null;
	const orderId = Number(url.searchParams.get('commande')) || null;

	const [orders, categories, [prod]] = await Promise.all([
		db
			.select({ id: order.id, reference: order.reference, createdAt: order.createdAt })
			.from(order)
			.where(eq(order.customerId, profile.id))
			.orderBy(desc(order.createdAt))
			.limit(30),
		listSupportCategories({ activeOnly: true }),
		productId
			? db
					.select({ name: product.name, reference: product.reference })
					.from(product)
					.where(and(eq(product.id, productId), eq(product.isActive, true)))
					.limit(1)
			: Promise.resolve([])
	]);

	const preselectedOrder = orders.find((o) => o.id === orderId);

	return {
		orders,
		categories: categories.map((c) => ({ id: c.id, code: c.code, label: c.label })),
		defaults: {
			subject: prod
				? `Question sur ${prod.name} (réf. ${prod.reference})`
				: preselectedOrder
					? `Commande ${preselectedOrder.reference}`
					: '',
			orderId: preselectedOrder ? String(preselectedOrder.id) : '',
			categoryCode: preselectedOrder ? 'order_tracking' : ''
		}
	};
};

export const actions: Actions = {
	default: async ({ locals, request, url }) => {
		const profile = await requireCustomer(locals, url.pathname);
		const form = await request.formData();
		try {
			const id = await createCustomerThread(profile.id, form);
			redirect(303, `/compte/messages/${id}`);
		} catch (cause) {
			if (cause instanceof SupportError) {
				return fail(400, {
					message: cause.message,
					values: {
						subject: form.get('subject')?.toString() ?? '',
						categoryId: form.get('categoryId')?.toString() ?? '',
						orderId: form.get('orderId')?.toString() ?? '',
						content: form.get('content')?.toString() ?? ''
					}
				});
			}
			throw cause;
		}
	}
};
