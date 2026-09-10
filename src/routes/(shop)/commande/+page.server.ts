import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { customerForUser, taxContextForUser } from '$lib/server/account';
import { getCart } from '$lib/server/cart';
import { resolveCartOwner } from '$lib/server/cart-session';
import { listCustomerAddresses } from '$lib/server/addresses';
import { quoteShipping, type ShippableLine } from '$lib/server/shipping';
import { createOrderFromCart, CheckoutError } from '$lib/server/checkout';
import { fetchServicePoints } from '$lib/server/sendcloud';
import { db } from '$lib/server/db';
import { product } from '$lib/server/db/catalog.schema';
import { cartItem } from '$lib/server/db/order.schema';
import { and, eq } from 'drizzle-orm';

/** Adresse de l'atelier : point de départ de toute expédition. */
const SENDER = {
	countryCode: 'FR',
	postalCode: '50570',
	city: 'Carantilly',
	addressLine1: '4 La Merrerie'
};

/** Articles du panier réduits à ce qui influence le transport. */
async function shippableLines(cartId: number): Promise<ShippableLine[]> {
	const rows = await db
		.select({
			quantity: cartItem.quantity,
			weightKg: product.weightKg,
			lengthCm: product.lengthCm,
			widthCm: product.widthCm,
			heightCm: product.heightCm,
			shippingExtraFee: product.shippingExtraFee
		})
		.from(cartItem)
		.innerJoin(product, eq(cartItem.productId, product.id))
		.where(and(eq(cartItem.cartId, cartId), eq(product.isActive, true)));

	return rows.map((row) => ({
		quantity: row.quantity,
		weightKg: row.weightKg ? Number(row.weightKg) : null,
		lengthCm: row.lengthCm ? Number(row.lengthCm) : null,
		widthCm: row.widthCm ? Number(row.widthCm) : null,
		heightCm: row.heightCm ? Number(row.heightCm) : null,
		shippingExtraFee: row.shippingExtraFee ? Number(row.shippingExtraFee) : null
	}));
}

export const load: PageServerLoad = async (event) => {
	const { locals, url } = event;
	if (!locals.user) redirect(303, `/connexion?redirectTo=${encodeURIComponent(url.pathname)}`);

	const profile = await customerForUser(locals.user.id);
	if (!profile) redirect(303, '/compte');

	const owner = await resolveCartOwner(event);
	const { tax } = await event.parent();
	const cart = owner ? await getCart(owner, tax.regime) : null;

	// Un panier vide n'a rien à commander : on renvoie vers le panier plutôt que
	// d'afficher un tunnel sans objet.
	if (!cart?.id || cart.lines.length === 0) redirect(303, '/panier');

	const addresses = await listCustomerAddresses(profile.id);
	if (addresses.length === 0) {
		redirect(303, '/compte/adresses?depuis=commande');
	}

	const shipTo = addresses.find((a) => a.isDefaultShipping) ?? addresses[0];

	const quote = await quoteShipping({
		lines: await shippableLines(cart.id),
		from: SENDER,
		to: { countryCode: shipTo.country, postalCode: shipTo.postalCode, city: shipTo.city },
		cartTotalTtc: cart.totals.totalTtc
	});

	return { cart, addresses, quote };
};

export const actions: Actions = {
	/** Points relais autour d'une adresse, demandés depuis l'étape livraison. */
	relayPoints: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { message: 'Connexion requise.' });

		const form = await request.formData();
		const postalCode = form.get('postalCode')?.toString() ?? '';
		const carrierCode = form.get('carrierCode')?.toString() || undefined;
		if (!postalCode) return fail(400, { message: 'Code postal manquant.' });

		try {
			// Sendcloud ignore le code postal seul : sans coordonnées, il renvoie
			// des points à l'autre bout du pays. On géocode donc d'abord.
			const geo = await fetch(
				`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(postalCode)}&type=municipality&limit=1`
			);
			const [lon, lat] = geo.ok
				? ((await geo.json()).features?.[0]?.geometry?.coordinates ?? [])
				: [];

			const points = await fetchServicePoints({
				countryCode: 'FR',
				postalCode,
				carrierCode,
				latitude: lat,
				longitude: lon
			});

			// Les horaires du jour et le type de point décident du choix bien plus
			// qu'un visuel — que Sendcloud ne fournit d'ailleurs pas.
			const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
			const today = days[new Date().getDay()];

			return {
				relayPoints: points.slice(0, 12).map((point) => ({
					...point,
					todaySlots: (point.openingTimes?.[today] ?? []).map(
						(slot) => `${slot.start_time} – ${slot.end_time}`
					)
				}))
			};
		} catch {
			return fail(502, { message: 'Points relais indisponibles pour le moment.' });
		}
	},

	/** Validation finale : le panier devient une commande. */
	confirm: async (event) => {
		const { locals, request } = event;
		if (!locals.user) return fail(401, { message: 'Connexion requise.' });

		const profile = await customerForUser(locals.user.id);
		const owner = await resolveCartOwner(event);
		if (!profile || !owner) return fail(400, { message: 'Panier introuvable.' });

		// `parent()` n'existe pas dans une action : le régime est résolu ici.
		const tax = await taxContextForUser(locals.user.id);
		const cart = await getCart(owner, tax.regime);
		if (!cart.id || cart.lines.length === 0) return fail(400, { message: 'Le panier est vide.' });

		const form = await request.formData();
		const shippingAddressId = Number(form.get('shippingAddressId'));
		const billingAddressId = Number(form.get('billingAddressId')) || shippingAddressId;
		const optionCode = form.get('optionCode')?.toString() ?? '';

		if (!shippingAddressId || !optionCode) {
			return fail(400, { message: 'Adresse et mode de livraison sont requis.' });
		}

		// L'offre est recalculée côté serveur : le tarif affiché au client ne fait
		// jamais foi, il pourrait avoir été altéré dans le formulaire.
		const addresses = await listCustomerAddresses(profile.id);
		const shipTo = addresses.find((a) => a.id === shippingAddressId);
		if (!shipTo) return fail(400, { message: 'Adresse introuvable.' });

		const quote = await quoteShipping({
			lines: await shippableLines(cart.id),
			from: SENDER,
			to: { countryCode: shipTo.country, postalCode: shipTo.postalCode, city: shipTo.city },
			cartTotalTtc: cart.totals.totalTtc
		});

		const option = quote.options.find((o) => o.code === optionCode);
		if (!option) return fail(400, { message: 'Mode de livraison indisponible.' });

		// Un point relais est obligatoire pour ce type d'offre (R11).
		const relayPointId = form.get('relayPointId')?.toString() || null;
		if (option.requiresServicePoint && !relayPointId) {
			return fail(400, { message: 'Choisissez un point relais.' });
		}

		try {
			const created = await createOrderFromCart({
				customerId: profile.id,
				cartId: cart.id,
				shippingAddressId,
				billingAddressId,
				regime: tax.regime,
				weightKg: quote.weightKg,
				shipping: {
					optionCode: option.code,
					carrierCode: option.carrierCode,
					carrierName: option.carrierName,
					feeHt: option.priceHt ?? 0,
					usedFallback: quote.usedFallback,
					relayPointId,
					relayPointName: form.get('relayPointName')?.toString() || null,
					relayPointAddress: form.get('relayPointAddress')?.toString() || null
				}
			});

			redirect(303, `/commande/confirmation/${created.reference}`);
		} catch (error) {
			if (error instanceof CheckoutError) return fail(400, { message: error.message });
			throw error;
		}
	}
};
