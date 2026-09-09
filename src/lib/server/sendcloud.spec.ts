import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Le module lit `$env/dynamic/private` à l'appel : on le remplace par un objet
 * mutable pour éprouver le verrou dans les deux positions.
 */
const env: Record<string, string | undefined> = {};
vi.mock('$env/dynamic/private', () => ({ env }));

const { createShipment, realLabelsAllowed, TestModeError, TEST_SHIPPING_OPTION_CODE } =
	await import('./sendcloud');

const sender = {
	name: 'MS Shop',
	companyName: 'Mecaservices',
	addressLine1: '4 La Merrerie',
	houseNumber: '4',
	postalCode: '50570',
	city: 'Carantilly',
	countryCode: 'FR',
	email: 'contact@example.com',
	phone: '+33950922336'
};

const shipment = (shippingOptionCode: string) => ({
	orderReference: 'MS-TEST-1',
	shippingOptionCode,
	fromAddress: sender,
	name: 'Jean Dupont',
	addressLine1: '10 Rue de Rivoli',
	postalCode: '75001',
	city: 'Paris',
	countryCode: 'FR',
	weightKg: 2.5
});

describe('verrou de mode test', () => {
	beforeEach(() => {
		for (const key of Object.keys(env)) delete env[key];
		env.SENDCLOUD_API_KEY_PUBLIC = 'public';
		env.SENDCLOUD_API_KEY_SECRET = 'secret';
		vi.restoreAllMocks();
	});

	it('est actif par défaut : une variable absente ne doit jamais ouvrir les envois réels', () => {
		expect(realLabelsAllowed()).toBe(false);
	});

	it("n'est levé que par la valeur exacte « true »", () => {
		env.SENDCLOUD_ALLOW_REAL_LABELS = 'false';
		expect(realLabelsAllowed()).toBe(false);
		env.SENDCLOUD_ALLOW_REAL_LABELS = '1';
		expect(realLabelsAllowed()).toBe(false);
		env.SENDCLOUD_ALLOW_REAL_LABELS = 'true';
		expect(realLabelsAllowed()).toBe(true);
	});

	it('refuse une offre réelle sans jamais appeler Sendcloud', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch');

		await expect(createShipment(shipment('colissimo:home/fr'))).rejects.toThrow(TestModeError);
		// Le point décisif : la requête ne part pas, donc rien n'est facturé.
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it("nomme l'offre refusée dans le message, pour que l'opérateur comprenne", async () => {
		await expect(createShipment(shipment('mondial_relay:service_point,dualapi/size=l,c2c'))).rejects.toThrow(
			/mondial_relay/
		);
	});

	it("laisse passer l'offre de test", async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response(JSON.stringify({ data: { id: 'shp', parcels: [{ id: 1 }] } }), { status: 201 })
		);

		await createShipment(shipment(TEST_SHIPPING_OPTION_CODE));
		expect(fetchSpy).toHaveBeenCalledOnce();
	});

	it('autorise une offre réelle une fois le verrou levé', async () => {
		env.SENDCLOUD_ALLOW_REAL_LABELS = 'true';
		const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response(JSON.stringify({ data: { id: 'shp', parcels: [{ id: 1 }] } }), { status: 201 })
		);

		await createShipment(shipment('colissimo:home/fr'));
		expect(fetchSpy).toHaveBeenCalledOnce();
	});
});
