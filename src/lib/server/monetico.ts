/**
 * Paiement par carte bancaire — Monetico Paiement (CDC section 20).
 *
 * Conforme à la « Documentation Technique » v1.0 de septembre 2015 (Euro
 * Information), interface 3.0.
 *
 * ## Principe
 *
 * Le paiement se fait par redirection : un formulaire scellé part vers le
 * serveur de la banque, qui encaisse puis notifie le site par **deux canaux
 * distincts** :
 *
 * - le **retour client** (navigateur), simple affichage — jamais probant, le
 *   client peut fermer sa fenêtre ou forger l'appel ;
 * - le **retour serveur** (webhook), seul canal qui fait foi et qui met la
 *   commande à jour.
 *
 * ## Sur le sceau
 *
 * Chaque message est certifié par un HMAC-SHA1 (RFC 2104) calculé sur une
 * concaténation de champs séparés par `*`, dans un ordre imposé. L'ordre, la
 * présence des séparateurs vides et le format des montants et des dates sont
 * tous significatifs : une virgule au lieu d'un point, et le sceau est refusé.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '$env/dynamic/private';

/** Version de l'interface, portée dans le formulaire et dans le sceau. */
export const MONETICO_VERSION = '3.0';

/**
 * URL du serveur de paiement de test (Crédit Mutuel).
 *
 * Le mode ne tient qu'au segment `/test/` : à TPE, société et clé identiques,
 * c'est l'URL — et elle seule — qui décide si la transaction est réelle. Le
 * défaut pointe donc vers le test : une variable oubliée n'encaisse rien.
 */
export const MONETICO_TEST_URL = 'https://paiement.creditmutuel.fr/test/paiement.cgi';

/** URL de production, à poser explicitement dans l'environnement. */
export const MONETICO_PRODUCTION_URL = 'https://paiement.creditmutuel.fr/paiement.cgi';

/**
 * Erreur métier du paiement, distinguée des pannes techniques.
 *
 * Son message est destiné aux journaux, jamais au client : il peut nommer un
 * défaut de sceau, information à ne pas exposer.
 */
export class MoneticoError extends Error {}

/**
 * Convertit la clé de sécurité en sa forme opérationnelle.
 *
 * La documentation (§1.2) la décrit « représentée de façon externe par 40
 * caractères hexadécimaux », à convertir « en une chaîne de 20 octets
 * (représentation opérationnelle) avant utilisation » — soit un simple
 * décodage hexadécimal.
 *
 * Note : les versions antérieures de l'interface CM-CIC imposaient une
 * transformation supplémentaire sur les derniers caractères. Elle ne
 * s'applique pas à l'interface 3.0 décrite ici.
 */
export function usableKey(hexKey: string): Buffer {
	const clean = hexKey.trim();

	if (!/^[0-9a-fA-F]{40}$/.test(clean)) {
		throw new MoneticoError('La clé MAC doit comporter exactement 40 caractères hexadécimaux.');
	}
	return Buffer.from(clean, 'hex');
}

/** Calcule le sceau d'une chaîne déjà assemblée. */
export function seal(data: string, hexKey: string): string {
	return createHmac('sha1', usableKey(hexKey)).update(data, 'utf8').digest('hex').toUpperCase();
}

/**
 * Compare deux sceaux sans fuite de temps.
 *
 * Une comparaison naïve s'arrête au premier caractère différent : mesurer ce
 * délai permettrait de reconstituer un sceau valide octet par octet.
 */
export function sealMatches(expected: string, received: string): boolean {
	const a = Buffer.from(expected.toUpperCase(), 'utf8');
	const b = Buffer.from((received ?? '').trim().toUpperCase(), 'utf8');
	return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Formate un montant selon la documentation (§1.3.2).
 *
 * « Un nombre entier, un point décimal optionnel, un nombre entier de n
 * chiffres » suivi du code ISO 4217 — par exemple `62.73EUR`. Le séparateur
 * est un point : une locale française produirait une virgule, et le sceau
 * serait rejeté.
 */
export function formatAmount(amount: number, currency = 'EUR'): string {
	if (!Number.isFinite(amount) || amount <= 0) {
		throw new MoneticoError('Montant de paiement invalide.');
	}
	return `${amount.toFixed(2)}${currency}`;
}

/**
 * Formate une date de commande au format `JJ/MM/AAAA:HH:MM:SS` (§1.3.2).
 *
 * Les composantes sont lues en heure locale : le serveur de la banque attend
 * l'heure du commerçant, non UTC.
 */
export function formatOrderDate(date: Date): string {
	const p = (n: number) => String(n).padStart(2, '0');
	return (
		`${p(date.getDate())}/${p(date.getMonth() + 1)}/${date.getFullYear()}` +
		`:${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}`
	);
}

/** Configuration du contrat, lue depuis l'environnement. */
export type MoneticoConfig = {
	/** Numéro de TPE, 7 caractères. */
	tpe: string;
	/** Code société, fourni avec le contrat. */
	societe: string;
	/** Clé MAC, 40 caractères hexadécimaux. */
	key: string;
	/**
	 * URL du serveur de paiement.
	 *
	 * Le mode test et le mode production ne se distinguent **que** par cette
	 * URL : `.../test/paiement.cgi` contre `.../paiement.cgi`, à identifiants
	 * identiques. Elle vient donc de l'environnement, jamais d'une condition
	 * dans le code — c'est ce qui garantit qu'un déploiement de recette ne
	 * puisse pas encaisser réellement, ni l'inverse.
	 */
	url: string;
};

/** Vrai lorsque le contrat est renseigné ; sinon la carte reste indisponible. */
export function isMoneticoConfigured(): boolean {
	return Boolean(env.MONETICO_TPE && env.MONETICO_SOCIETE && env.MONETICO_CLE_MAC);
}

/**
 * Configuration du contrat, lue depuis l'environnement.
 *
 * L'URL n'est jamais déduite d'un `if` dans le code : la production et la
 * recette portent chacune la leur. À défaut de variable, c'est l'URL de test
 * qui s'applique — une erreur de configuration doit échouer du côté sûr.
 */
export function moneticoConfig(): MoneticoConfig {
	if (!isMoneticoConfigured()) {
		throw new MoneticoError('Le contrat Monetico n’est pas configuré.');
	}

	return {
		tpe: env.MONETICO_TPE!,
		societe: env.MONETICO_SOCIETE!,
		key: env.MONETICO_CLE_MAC!,
		url: env.MONETICO_URL?.trim() || MONETICO_TEST_URL
	};
}

/** Vrai si les transactions partent vers l'environnement de production. */
export function isProductionEndpoint(config: MoneticoConfig): boolean {
	return !config.url.includes('/test/');
}

/** Champs du formulaire de paiement (phase « aller »). */
export type PaymentRequest = {
	reference: string;
	amount: number;
	currency?: string;
	email: string;
	/** Date de la commande ; l'instant courant par défaut. */
	date?: Date;
	/** Langue de l'interface de paiement. */
	language?: string;
	/** Texte libre renvoyé tel quel par la banque (§1.3.2). */
	freeText?: string;
	/** URLs de retour navigateur, si elles diffèrent du paramétrage du TPE. */
	successUrl?: string;
	errorUrl?: string;
};

/**
 * Assemble la chaîne à certifier pour l'aller (§1.4.1).
 *
 * Ordre imposé :
 * `TPE*date*montant*reference*texte-libre*version*lgue*societe*mail*
 *  nbrech*dateech1*montantech1*…*montantech4*options`
 *
 * Le paiement comptant laisse les huit champs d'échéance vides : les
 * séparateurs restent présents, et leur absence invaliderait le sceau.
 */
export function buildRequestSealString(
	config: MoneticoConfig,
	fields: {
		date: string;
		amount: string;
		reference: string;
		freeText: string;
		language: string;
		email: string;
	}
): string {
	return [
		config.tpe,
		fields.date,
		fields.amount,
		fields.reference,
		fields.freeText,
		MONETICO_VERSION,
		fields.language,
		config.societe,
		fields.email,
		// nbrech, puis quatre couples date/montant d'échéance : vides en comptant.
		'',
		'',
		'',
		'',
		'',
		'',
		'',
		'',
		'',
		// options
		''
	].join('*');
}

/**
 * Prépare le formulaire de redirection vers la banque.
 *
 * Retourne l'URL cible et les champs à poster tels quels : le sceau porte sur
 * ces valeurs exactes, toute retouche ultérieure l'invaliderait.
 */
export function buildPaymentForm(config: MoneticoConfig, request: PaymentRequest) {
	const date = formatOrderDate(request.date ?? new Date());
	const amount = formatAmount(request.amount, request.currency);
	const language = request.language ?? 'FR';
	const freeText = request.freeText ?? '';

	const sealString = buildRequestSealString(config, {
		date,
		amount,
		reference: request.reference,
		freeText,
		language,
		email: request.email
	});

	const fields: Record<string, string> = {
		version: MONETICO_VERSION,
		TPE: config.tpe,
		date,
		montant: amount,
		reference: request.reference,
		MAC: seal(sealString, config.key),
		lgue: language,
		societe: config.societe,
		mail: request.email,
		'texte-libre': freeText
	};

	// Le TPE porte des URLs de retour par défaut : ne les surcharger que si
	// l'appelant en fournit, pour ne pas les écraser par une chaîne vide.
	if (request.successUrl) fields.url_retour_ok = request.successUrl;
	if (request.errorUrl) fields.url_retour_err = request.errorUrl;

	return { url: config.url, fields };
}

/**
 * Codes-retour du serveur de paiement (§1.4.2).
 *
 * `payetest` n'apparaît que sur l'environnement de test ; le recevoir en
 * production est, selon la documentation, « une anomalie ».
 */
export const MONETICO_ACCEPTED = ['paiement', 'payetest'] as const;
export const MONETICO_REFUSED = ['Annulation'] as const;

/** Champs du retour serveur, dans l'ordre exact du sceau (§1.5.1). */
const RETURN_SEAL_FIELDS = [
	'code-retour',
	'cvx',
	'vld',
	'brand',
	'status3ds',
	'numauto',
	'motifrefus',
	'originecb',
	'bincb',
	'hpancb',
	'ipclient',
	'originetr',
	'veres',
	'pares'
] as const;

/**
 * Assemble la chaîne à certifier pour le retour (§1.5.1).
 *
 * `TPE*date*montant*reference*texte-libre*3.0*code-retour*cvx*vld*brand*
 *  status3ds*numauto*motifrefus*originecb*bincb*hpancb*ipclient*originetr*
 *  veres*pares*`
 *
 * La chaîne se termine par un séparateur, et les champs absents comptent pour
 * une valeur vide : le sceau est calculé sur la forme, pas sur le contenu.
 */
export function buildReturnSealString(
	config: MoneticoConfig,
	params: Record<string, string | undefined>
): string {
	const parts = [
		config.tpe,
		params.date ?? '',
		params.montant ?? '',
		params.reference ?? '',
		params['texte-libre'] ?? '',
		MONETICO_VERSION,
		...RETURN_SEAL_FIELDS.map((f) => params[f] ?? '')
	];

	// Le séparateur final fait partie de la chaîne certifiée.
	return `${parts.join('*')}*`;
}

/** Résultat de l'examen d'un retour de paiement. */
export type ReturnVerdict = {
	/** Sceau conforme : seul cas où le message peut être pris en compte. */
	valid: boolean;
	/** Paiement accepté par la banque. */
	accepted: boolean;
	reference: string;
	amount: string;
	returnCode: string;
	/** Numéro d'autorisation, à conserver comme preuve d'encaissement. */
	authNumber: string | null;
	/** Motif du refus, le cas échéant. */
	refusalReason: string | null;
	/** Le paiement vient de l'environnement de test. */
	isTest: boolean;
};

/**
 * Vérifie un retour de paiement et en extrait le verdict.
 *
 * L'authenticité tient au seul sceau : tant qu'il n'est pas vérifié, aucune
 * valeur du message ne doit être considérée comme fiable.
 */
export function verifyReturn(
	config: MoneticoConfig,
	params: Record<string, string | undefined>
): ReturnVerdict {
	const expected = seal(buildReturnSealString(config, params), config.key);
	const valid = sealMatches(expected, params.MAC ?? '');
	const returnCode = params['code-retour'] ?? '';

	return {
		valid,
		accepted: valid && (MONETICO_ACCEPTED as readonly string[]).includes(returnCode),
		reference: params.reference ?? '',
		amount: params.montant ?? '',
		returnCode,
		authNumber: params.numauto || null,
		refusalReason: params.motifrefus || null,
		isTest: returnCode === 'payetest'
	};
}

/**
 * Accusé de réception attendu par le serveur de la banque (§1.5.2).
 *
 * Il dépend **uniquement** de la validité du sceau, jamais du code-retour :
 * un paiement refusé mais correctement scellé reçoit `cdr=0`. Sans cet accusé,
 * la banque alerte par courriel et rejoue la notification.
 */
export function acknowledgement(sealValid: boolean): string {
	return `version=2\ncdr=${sealValid ? 0 : 1}\n`;
}
