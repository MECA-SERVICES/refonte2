import { describe, expect, it } from 'vitest';
import {
	acknowledgement,
	buildPaymentForm,
	buildRequestSealString,
	buildReturnSealString,
	formatAmount,
	formatOrderDate,
	MoneticoError,
	seal,
	sealMatches,
	usableKey,
	verifyReturn,
	type MoneticoConfig
} from './monetico';

/**
 * Contrat fictif repris de l'exemple de la documentation technique (§1.3.2.3).
 *
 * La clé est celle donnée en exemple au §1.2 ; elle ne correspond à aucun
 * contrat réel.
 */
const config: MoneticoConfig = {
	tpe: '1234567',
	societe: 'monSite1',
	key: '0123456789ABCDEF0123456789ABCDEF01234567',
	url: 'https://paiement.creditmutuel.fr/test/paiement.cgi'
};

describe('usableKey', () => {
	it('convertit les 40 caractères hexadécimaux en 20 octets (§1.2)', () => {
		expect(usableKey(config.key)).toHaveLength(20);
	});

	it('tolère les espaces autour de la clé', () => {
		expect(usableKey(`  ${config.key}  `)).toHaveLength(20);
	});

	it('refuse une clé de longueur ou de format invalide', () => {
		expect(() => usableKey('trop court')).toThrow(MoneticoError);
		expect(() => usableKey('Z'.repeat(40))).toThrow(MoneticoError);
		// 39 caractères : une troncature silencieuse produirait un sceau faux.
		expect(() => usableKey(config.key.slice(0, 39))).toThrow(MoneticoError);
	});
});

describe('formatAmount', () => {
	it('emploie le point décimal et le code ISO 4217 (§1.3.2)', () => {
		expect(formatAmount(62.73)).toBe('62.73EUR');
		expect(formatAmount(1024, 'USD')).toBe('1024.00USD');
	});

	it('refuse un montant nul, négatif ou non fini', () => {
		expect(() => formatAmount(0)).toThrow(MoneticoError);
		expect(() => formatAmount(-5)).toThrow(MoneticoError);
		expect(() => formatAmount(Number.NaN)).toThrow(MoneticoError);
	});
});

describe('formatOrderDate', () => {
	it('produit le format JJ/MM/AAAA:HH:MM:SS (§1.3.2)', () => {
		// Construite en heure locale : la banque attend l'heure du commerçant.
		expect(formatOrderDate(new Date(2006, 11, 5, 11, 55, 23))).toBe('05/12/2006:11:55:23');
	});

	it('complète les composantes à deux chiffres', () => {
		expect(formatOrderDate(new Date(2026, 0, 3, 7, 4, 9))).toBe('03/01/2026:07:04:09');
	});
});

describe('buildRequestSealString', () => {
	/*
	 * Vecteur de référence de la documentation (§1.4.1) :
	 *
	 *   1234567*05/12/2006:11:55:23*62.73EUR*ABERTYP00145*ExempleTexteLibre
	 *   *3.0*FR*monSite1*internaute@sonemail.fr**********
	 *
	 * Les dix séparateurs finaux correspondent aux champs d'échéance et aux
	 * options, vides en paiement comptant.
	 */
	it('reproduit le vecteur de la documentation', () => {
		const out = buildRequestSealString(config, {
			date: '05/12/2006:11:55:23',
			amount: '62.73EUR',
			reference: 'ABERTYP00145',
			freeText: 'ExempleTexteLibre',
			language: 'FR',
			email: 'internaute@sonemail.fr'
		});

		expect(out).toBe(
			'1234567*05/12/2006:11:55:23*62.73EUR*ABERTYP00145*ExempleTexteLibre*3.0*FR*monSite1*internaute@sonemail.fr**********'
		);
	});

	it('conserve les séparateurs des échéances vides', () => {
		const out = buildRequestSealString(config, {
			date: '05/12/2006:11:55:23',
			amount: '62.73EUR',
			reference: 'REF',
			freeText: '',
			language: 'FR',
			email: 'a@b.fr'
		});

		// 19 segments, comme le vecteur de la documentation : TPE, date,
		// montant, référence, texte libre, version, langue, société, mail,
		// nbrech, huit champs d'échéance et les options.
		expect(out.split('*')).toHaveLength(19);
	});
});

describe('seal', () => {
	it('produit un sceau de 40 caractères hexadécimaux majuscules', () => {
		const out = seal('donnée', config.key);
		expect(out).toMatch(/^[0-9A-F]{40}$/);
	});

	it('change dès que la donnée change d’un caractère', () => {
		expect(seal('62.73EUR', config.key)).not.toBe(seal('62.74EUR', config.key));
	});

	it('change dès que la clé change', () => {
		const other = 'FEDCBA9876543210FEDCBA9876543210FEDCBA98';
		expect(seal('donnée', config.key)).not.toBe(seal('donnée', other));
	});
});

describe('sealMatches', () => {
	it('ignore la casse et les espaces du sceau reçu', () => {
		const s = seal('donnée', config.key);
		expect(sealMatches(s, s.toLowerCase())).toBe(true);
		expect(sealMatches(s, ` ${s} `)).toBe(true);
	});

	it('rejette un sceau différent, vide ou absent', () => {
		const s = seal('donnée', config.key);
		expect(sealMatches(s, 'A'.repeat(40))).toBe(false);
		expect(sealMatches(s, '')).toBe(false);
		expect(sealMatches(s, undefined as unknown as string)).toBe(false);
	});
});

describe('buildPaymentForm', () => {
	const form = buildPaymentForm(config, {
		reference: 'ABERTYP00145',
		amount: 62.73,
		email: 'internaute@sonemail.fr',
		freeText: 'ExempleTexteLibre',
		date: new Date(2006, 11, 5, 11, 55, 23)
	});

	it('cible l’URL du contrat, jamais une URL codée en dur', () => {
		expect(form.url).toBe(config.url);
	});

	it('porte les champs attendus par le serveur de paiement (§1.3.2.3)', () => {
		expect(form.fields).toMatchObject({
			version: '3.0',
			TPE: '1234567',
			date: '05/12/2006:11:55:23',
			montant: '62.73EUR',
			reference: 'ABERTYP00145',
			lgue: 'FR',
			societe: 'monSite1',
			mail: 'internaute@sonemail.fr',
			'texte-libre': 'ExempleTexteLibre'
		});
		expect(form.fields.MAC).toMatch(/^[0-9A-F]{40}$/);
	});

	it('n’émet les URLs de retour que si elles sont fournies', () => {
		// Le TPE porte des valeurs par défaut : une chaîne vide les écraserait.
		expect(form.fields.url_retour_ok).toBeUndefined();

		const withUrls = buildPaymentForm(config, {
			reference: 'REF',
			amount: 10,
			email: 'a@b.fr',
			successUrl: 'https://ex.fr/ok',
			errorUrl: 'https://ex.fr/ko'
		});
		expect(withUrls.fields.url_retour_ok).toBe('https://ex.fr/ok');
		expect(withUrls.fields.url_retour_err).toBe('https://ex.fr/ko');
	});

	it('scelle exactement les valeurs postées', () => {
		// Le sceau doit correspondre aux champs tels qu'ils partent : toute
		// retouche après coup l'invaliderait.
		const expected = seal(
			buildRequestSealString(config, {
				date: form.fields.date,
				amount: form.fields.montant,
				reference: form.fields.reference,
				freeText: form.fields['texte-libre'],
				language: form.fields.lgue,
				email: form.fields.mail
			}),
			config.key
		);
		expect(form.fields.MAC).toBe(expected);
	});
});

describe('buildReturnSealString', () => {
	/*
	 * Vecteur de la documentation (§1.5.1), module prévention fraude et
	 * 3-D Secure activés :
	 *
	 *   1234567*05/12/2006_a_11:55:23*62.75EUR*ABERTYP00145*LeTexteLibre*3.0
	 *   *paiement*oui*1208*VI*1*010101**FRA*010101*74E9…*127.0.0.1*FRA*Y*Y*
	 */
	it('reproduit le vecteur de la documentation', () => {
		const out = buildReturnSealString(config, {
			date: '05/12/2006_a_11:55:23',
			montant: '62.75EUR',
			reference: 'ABERTYP00145',
			'texte-libre': 'LeTexteLibre',
			'code-retour': 'paiement',
			cvx: 'oui',
			vld: '1208',
			brand: 'VI',
			status3ds: '1',
			numauto: '010101',
			motifrefus: '',
			originecb: 'FRA',
			bincb: '010101',
			hpancb: '74E94B03C22D786E0F2C2CADBFC1C00B004B7C45',
			ipclient: '127.0.0.1',
			originetr: 'FRA',
			veres: 'Y',
			pares: 'Y'
		});

		expect(out).toBe(
			'1234567*05/12/2006_a_11:55:23*62.75EUR*ABERTYP00145*LeTexteLibre*3.0*paiement*oui*1208*VI*1*010101**FRA*010101*74E94B03C22D786E0F2C2CADBFC1C00B004B7C45*127.0.0.1*FRA*Y*Y*'
		);
	});

	it('traite un champ absent comme vide et termine par un séparateur', () => {
		const out = buildReturnSealString(config, { reference: 'REF' });
		expect(out.endsWith('*')).toBe(true);
		expect(out.startsWith('1234567**')).toBe(true);
	});
});

describe('verifyReturn', () => {
	/** Forge un retour correctement scellé, comme le ferait la banque. */
	function signedReturn(overrides: Record<string, string> = {}) {
		const params: Record<string, string> = {
			date: '05/12/2006_a_11:55:23',
			montant: '62.75EUR',
			reference: 'ABERTYP00145',
			'texte-libre': '',
			'code-retour': 'paiement',
			numauto: '010101',
			...overrides
		};
		params.MAC = seal(buildReturnSealString(config, params), config.key);
		return params;
	}

	it('accepte un paiement correctement scellé', () => {
		const v = verifyReturn(config, signedReturn());
		expect(v).toMatchObject({
			valid: true,
			accepted: true,
			reference: 'ABERTYP00145',
			returnCode: 'paiement',
			authNumber: '010101',
			isTest: false
		});
	});

	it('reconnaît un paiement de l’environnement de test', () => {
		const v = verifyReturn(config, signedReturn({ 'code-retour': 'payetest' }));
		expect(v).toMatchObject({ valid: true, accepted: true, isTest: true });
	});

	it('signale un refus tout en validant le sceau', () => {
		const v = verifyReturn(
			config,
			signedReturn({ 'code-retour': 'Annulation', motifrefus: 'refus', numauto: '' })
		);
		// Sceau valide mais paiement refusé : la distinction commande l'accusé
		// de réception, qui ne dépend que du sceau (§1.5.2).
		expect(v).toMatchObject({ valid: true, accepted: false, refusalReason: 'refus' });
	});

	it('rejette un message dont le montant a été modifié', () => {
		const forged = { ...signedReturn(), montant: '1.00EUR' };
		const v = verifyReturn(config, forged);
		expect(v.valid).toBe(false);
		expect(v.accepted).toBe(false);
	});

	it('rejette un message sans sceau', () => {
		const params = signedReturn();
		delete params.MAC;
		expect(verifyReturn(config, params).valid).toBe(false);
	});

	it('rejette un message scellé avec une autre clé', () => {
		const params = signedReturn();
		const other: MoneticoConfig = { ...config, key: 'FEDCBA9876543210FEDCBA9876543210FEDCBA98' };
		expect(verifyReturn(other, params).valid).toBe(false);
	});
});

describe('acknowledgement', () => {
	it('confirme un sceau valide par cdr=0 (§1.5.2)', () => {
		expect(acknowledgement(true)).toBe('version=2\ncdr=0\n');
	});

	it('signale un sceau invalide par cdr=1', () => {
		expect(acknowledgement(false)).toBe('version=2\ncdr=1\n');
	});
});
