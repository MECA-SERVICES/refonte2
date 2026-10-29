/**
 * Identité de l'entreprise imprimée en pied de facture.
 *
 * Valeurs reprises des factures PrestaShop en circulation. À déplacer vers le
 * paramétrage entreprise (CDC 41) quand il existera — d'où le regroupement ici
 * plutôt qu'une dispersion dans le gabarit.
 */
export const COMPANY = {
	name: 'MECA SERVICES',
	legalName: 'Meca-Services',
	addressLine: '4, La Merrerie',
	postalCode: '50570',
	city: 'CARANTILLY',
	country: 'France Métropolitaine',
	phone: '0950-922-336',
	rcs: 'R.C.S Coutances',
	siren: '878691294',
	vatNumber: 'FR 51 878 691 294'
} as const;
