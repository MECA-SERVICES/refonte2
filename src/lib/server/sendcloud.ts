/**
 * Client Sendcloud — CDC section 21.
 *
 * Sendcloud fournit le référentiel transporteurs, les tarifs, les points relais
 * et les étiquettes. La boutique n'administre aucun transporteur : elle
 * interroge Sendcloud et applique ses propres contraintes métier par-dessus.
 *
 * Le compte MS Shop ayant été créé après le 13 avril 2026, l'API **v3** est
 * seule utilisable : la v2 est fermée aux nouveaux comptes. Tous les appels
 * passent donc par `panel.sendcloud.sc/api/v3`.
 *
 * Sendcloud n'offre aucun environnement de test : les clés portent sur le
 * compte réel. Toutes les lectures (options, tarifs, points relais) sont sans
 * effet et gratuites ; seule la création d'étiquette engage des frais, sauf via
 * l'option `sendcloud:letter`, prévue pour cela.
 */

import { env } from '$env/dynamic/private';

const PANEL_API = 'https://panel.sendcloud.sc/api';

/** Au-delà, on considère Sendcloud indisponible et on bascule sur le repli (R19). */
const TIMEOUT_MS = 6000;

/** Adresse minimale nécessaire au calcul d'une offre. */
export type ShippingAddress = {
	countryCode: string;
	postalCode: string;
	city?: string;
	addressLine1?: string;
};

/** Offre de livraison présentée au client. */
export type ShippingOption = {
	/** Code Sendcloud, stocké tel quel sur la commande (`carrier_code`). */
	code: string;
	name: string;
	carrierCode: string;
	carrierName: string;
	/** `home_delivery`, `service_point`, `locker`… — décide de la règle R4. */
	lastMile: string | null;
	/** Un point relais doit être choisi avant de valider (R11). */
	requiresServicePoint: boolean;
	/** Tarif hors taxes, `null` tant qu'aucun contrat transporteur n'est actif. */
	priceHt: number | null;
	currency: string | null;
	/** Vrai lorsque l'offre provient de la grille de repli et non de Sendcloud. */
	fallback?: boolean;
};

/** Créneau d'ouverture d'un point relais, pour un jour donné. */
export type OpeningSlot = { start_time: string; end_time: string };

/** Point relais retourné par Sendcloud. */
export type ServicePoint = {
	id: number;
	name: string;
	street: string;
	houseNumber: string;
	postalCode: string;
	city: string;
	country: string;
	latitude: number | null;
	longitude: number | null;
	carrierCode: string;
	carrierName: string;
	/** `locker`, `shop`… — permet de distinguer consigne et commerce. */
	shopType: string | null;
	/** Distance en mètres, renseignée seulement si des coordonnées sont fournies. */
	distance: number | null;
	openingTimes: Record<string, OpeningSlot[]> | null;
};

/** Une expédition prête à être annoncée au transporteur. */
export type ParcelInput = {
	orderReference: string;
	shippingOptionCode: string;
	name: string;
	companyName?: string | null;
	addressLine1: string;
	addressLine2?: string | null;
	postalCode: string;
	city: string;
	countryCode: string;
	email?: string | null;
	phone?: string | null;
	weightKg: number;
	dimensionsCm?: { length: number; width: number; height: number };
	houseNumber?: string | null;
	servicePointId?: number | null;
};

/** Adresse de l'atelier, expéditeur de tous les colis. */
export type SenderAddress = {
	name: string;
	companyName: string;
	addressLine1: string;
	houseNumber: string;
	postalCode: string;
	city: string;
	countryCode: string;
	email: string;
	phone: string;
};

export class SendcloudError extends Error {
	constructor(
		message: string,
		readonly status: number | null,
		readonly payload: unknown
	) {
		super(message);
		this.name = 'SendcloudError';
	}
}

/** Vrai lorsque les clés sont configurées ; sinon on reste en mode repli. */
export function isSendcloudConfigured(): boolean {
	return Boolean(env.SENDCLOUD_API_KEY_PUBLIC && env.SENDCLOUD_API_KEY_SECRET);
}

function authHeader(): string {
	const pair = `${env.SENDCLOUD_API_KEY_PUBLIC}:${env.SENDCLOUD_API_KEY_SECRET}`;
	return `Basic ${Buffer.from(pair).toString('base64')}`;
}

/**
 * Appel HTTP à Sendcloud, borné dans le temps.
 *
 * Les échecs sont journalisés avec leur charge utile (R21) : c'est ce journal
 * qui permet de rejouer un appel après incident.
 */
async function call<T>(url: string, init: RequestInit = {}, body?: unknown): Promise<T> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

	try {
		const response = await fetch(url, {
			...init,
			signal: controller.signal,
			headers: {
				Authorization: authHeader(),
				'Content-Type': 'application/json',
				...init.headers
			},
			body: body === undefined ? undefined : JSON.stringify(body)
		});

		const text = await response.text();
		// `response.ok` couvre 200 comme 201 : l'annonce d'expédition répond 201.
		if (!response.ok) {
			console.error('[sendcloud] échec', { url, status: response.status, body, response: text });
			throw new SendcloudError(`Sendcloud ${response.status}`, response.status, text);
		}

		return text ? (JSON.parse(text) as T) : ({} as T);
	} catch (cause) {
		if (cause instanceof SendcloudError) throw cause;
		console.error('[sendcloud] injoignable', { url, body, cause });
		throw new SendcloudError('Sendcloud injoignable', null, cause);
	} finally {
		clearTimeout(timer);
	}
}

type RawOption = {
	code: string;
	name: string;
	carrier?: { code?: string; name?: string };
	functionalities?: { last_mile?: string };
	requirements?: { is_service_point_required?: boolean };
	quotes?: { price?: { total?: { value?: string; currency?: string } } }[];
};

/**
 * Offres applicables à une destination, tarifs compris.
 *
 * Plus l'adresse est précise, plus le tarif l'est aussi : Sendcloud applique
 * les zones et les surcharges de zone éloignée à partir du code postal et de la
 * ville.
 */
export async function fetchShippingOptions(params: {
	from: ShippingAddress;
	to: ShippingAddress;
	weightKg: number;
	dimensionsCm?: { length: number; width: number; height: number };
}): Promise<ShippingOption[]> {
	const payload: Record<string, unknown> = {
		from_address: {
			country_code: params.from.countryCode,
			postal_code: params.from.postalCode,
			city: params.from.city,
			address_line_1: params.from.addressLine1
		},
		to_address: {
			country_code: params.to.countryCode,
			postal_code: params.to.postalCode,
			city: params.to.city,
			address_line_1: params.to.addressLine1
		},
		weight: { value: params.weightKg.toFixed(3), unit: 'kg' },
		calculate_quotes: true
	};

	if (params.dimensionsCm) {
		payload.dimensions = {
			length: String(params.dimensionsCm.length),
			width: String(params.dimensionsCm.width),
			height: String(params.dimensionsCm.height),
			unit: 'cm'
		};
	}

	const data = await call<{ data?: RawOption[] }>(
		`${PANEL_API}/v3/fetch-shipping-options`,
		{ method: 'POST' },
		payload
	);

	return (data.data ?? []).map((option) => {
		const total = option.quotes?.[0]?.price?.total;
		return {
			code: option.code,
			name: option.name,
			carrierCode: option.carrier?.code ?? '',
			carrierName: option.carrier?.name ?? '',
			lastMile: option.functionalities?.last_mile ?? null,
			requiresServicePoint: option.requirements?.is_service_point_required ?? false,
			priceHt: total?.value ? Number(total.value) : null,
			currency: total?.currency ?? null
		};
	});
}

type RawServicePoint = {
	id: number;
	name: string;
	carrier?: { code?: string; name?: string };
	general_shop_type?: string;
	address?: {
		street?: string;
		house_number?: string;
		postal_code?: string;
		city?: string;
		country_code?: string;
	};
	position?: { latitude?: number; longitude?: number };
	opening_times?: Record<string, OpeningSlot[]>;
	distance?: number | null;
};

/**
 * Points relais à proximité, pour un transporteur donné.
 *
 * Les coordonnées sont déterminantes : sans elles, l'API ne tient pas compte du
 * code postal et retourne des points à l'autre bout du pays. L'appelant doit
 * donc géocoder l'adresse de livraison avant d'appeler cette fonction.
 */
export async function fetchServicePoints(params: {
	countryCode: string;
	postalCode: string;
	/** Coordonnées du point de livraison — sans elles, pas de tri par proximité. */
	latitude?: number;
	longitude?: number;
	carrierCode?: string;
	/** Rayon de recherche en mètres. */
	radius?: number;
}): Promise<ServicePoint[]> {
	const query = new URLSearchParams({
		country_code: params.countryCode,
		postal_code: params.postalCode,
		radius: String(params.radius ?? 5000)
	});
	if (params.carrierCode) query.set('carrier_code', params.carrierCode);
	if (params.latitude !== undefined && params.longitude !== undefined) {
		query.set('latitude', String(params.latitude));
		query.set('longitude', String(params.longitude));
	}

	const data = await call<{ data?: { results?: RawServicePoint[] } }>(
		`${PANEL_API}/v3/service-points?${query}`
	);

	return (data.data?.results ?? []).map((row) => ({
		id: row.id,
		name: row.name,
		street: row.address?.street ?? '',
		houseNumber: row.address?.house_number ?? '',
		postalCode: row.address?.postal_code ?? '',
		city: row.address?.city ?? '',
		country: row.address?.country_code ?? '',
		latitude: row.position?.latitude ?? null,
		longitude: row.position?.longitude ?? null,
		carrierCode: row.carrier?.code ?? '',
		carrierName: row.carrier?.name ?? '',
		shopType: row.general_shop_type ?? null,
		distance: row.distance ?? null,
		openingTimes: row.opening_times ?? null
	}));
}

/**
 * Crée et annonce une expédition, puis renvoie l'étiquette (R12, R13).
 *
 * En v3 et pour un colis unique, l'annonce est synchrone : l'étiquette revient
 * dans la réponse, sans second appel.
 *
 * ⚠️ Cet appel engage des frais réels, sauf avec `sendcloud:letter`, l'option
 * de test prévue par Sendcloud.
 */
export async function createShipment(input: ParcelInput & { fromAddress: SenderAddress }) {
	const payload = {
		label_details: { mime_type: 'application/pdf', dpi: 72 },
		order_number: input.orderReference,
		from_address: {
			name: input.fromAddress.name,
			company_name: input.fromAddress.companyName,
			address_line_1: input.fromAddress.addressLine1,
			house_number: input.fromAddress.houseNumber,
			postal_code: input.fromAddress.postalCode,
			city: input.fromAddress.city,
			country_code: input.fromAddress.countryCode,
			email: input.fromAddress.email,
			phone_number: input.fromAddress.phone
		},
		to_address: {
			name: input.name,
			company_name: input.companyName ?? undefined,
			address_line_1: input.addressLine1,
			address_line_2: input.addressLine2 ?? undefined,
			house_number: input.houseNumber ?? undefined,
			postal_code: input.postalCode,
			city: input.city,
			country_code: input.countryCode,
			email: input.email ?? undefined,
			phone_number: input.phone ?? undefined
		},
		ship_with: {
			type: 'shipping_option_code',
			properties: {
				shipping_option_code: input.shippingOptionCode,
				// Le point relais se déclare ici, avec l'offre, et non sur l'adresse.
				...(input.servicePointId ? { service_point_id: input.servicePointId } : {})
			}
		},
		parcels: [
			{
				weight: { value: input.weightKg.toFixed(3), unit: 'kg' },
				...(input.dimensionsCm
					? {
							dimensions: {
								length: input.dimensionsCm.length.toFixed(2),
								width: input.dimensionsCm.width.toFixed(2),
								height: input.dimensionsCm.height.toFixed(2),
								unit: 'cm'
							}
						}
					: {})
			}
		]
	};

	const data = await call<{
		data?: {
			id?: string;
			parcels?: {
				id?: number;
				tracking_number?: string;
				tracking_url?: string;
				// L'étiquette est portée par le colis, pas par l'expédition.
				documents?: { type?: string; link?: string }[];
			}[];
		};
	}>(`${PANEL_API}/v3/shipments/announce`, { method: 'POST' }, payload);

	const parcel = data.data?.parcels?.[0];
	const label = parcel?.documents?.find((d) => d.type === 'label');

	return {
		shipmentId: data.data?.id ?? null,
		parcelId: parcel?.id ?? null,
		trackingNumber: parcel?.tracking_number ?? null,
		trackingUrl: parcel?.tracking_url ?? null,
		labelUrl: label?.link ?? null
	};
}

/**
 * Télécharge l'étiquette d'un colis au format PDF.
 *
 * Le lien renvoyé à la création exige la même authentification que le reste de
 * l'API : il ne peut pas être transmis tel quel au navigateur de l'opérateur.
 */
export async function fetchLabelPdf(parcelId: number): Promise<ArrayBuffer> {
	const response = await fetch(`${PANEL_API}/v3/parcels/${parcelId}/documents/label`, {
		headers: { Authorization: authHeader() }
	});

	if (!response.ok) {
		const text = await response.text();
		console.error('[sendcloud] étiquette indisponible', { parcelId, status: response.status, text });
		throw new SendcloudError('Étiquette indisponible', response.status, text);
	}

	return response.arrayBuffer();
}

/**
 * Annule une expédition auprès du transporteur.
 *
 * L'annulation est mise en file (réponse `202`) : le statut définitif n'est pas
 * connu immédiatement. Tous les transporteurs ne l'acceptent pas.
 */
export async function cancelShipment(shipmentId: string): Promise<{ status: string }> {
	const data = await call<{ data?: { status?: string } }>(
		`${PANEL_API}/v3/shipments/${shipmentId}/cancel`,
		{ method: 'POST' }
	);
	return { status: data.data?.status ?? 'unknown' };
}

/**
 * Option d'expédition sans frais, prévue par Sendcloud pour les tests.
 *
 * Sendcloud n'offre aucun environnement de bac à sable : les clés portent sur
 * le compte réel. Créer une étiquette avec ce code est le seul moyen documenté
 * de vérifier le cycle complet sans être facturé.
 */
export const TEST_SHIPPING_OPTION_CODE = 'sendcloud:letter';
