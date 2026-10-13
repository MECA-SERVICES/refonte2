/**
 * Suggestions de recherche : les saisies « toutes faites » proposées pendant
 * la frappe (« sav » → « savon à main », « savon dreumex »…).
 *
 * Tant qu'aucune recherche client n'est enregistrée, elles sont tirées du
 * catalogue : la plupart des désignations commencent par la nature du produit
 * (« Filtre à huile moteur », « Nettoyant pour mains SF7850 »). On en retient
 * les expressions de tête, seules ou suivies de la marque, et on les classe
 * par nombre de produits et par ventes.
 *
 * Module partagé avec les scripts : imports relatifs uniquement.
 */
import type postgres from 'postgres';
import { FRENCH_STOP_WORDS } from './settings.ts';
import type { IndexContext } from './documents.ts';

type Sql = postgres.Sql;

export type SuggestionDocument = {
	id: string;
	/** Saisie proposée, telle qu'affichée : « filtre à huile ». */
	text: string;
	/** Produits dont la désignation commence par cette expression. */
	products: number;
	/** Score de classement : produits et ventes, cf. `popularity`. */
	popularity: number;
};

/** Mots de contenu retenus au plus par expression : au-delà, plus personne ne tape. */
const MAX_WORDS = 3;

/** Produits nécessaires pour qu'une expression devienne une suggestion. */
const MIN_PRODUCTS = 5;

/**
 * Part des produits au-delà de laquelle une expression n'est qu'une version
 * tronquée de sa suite : « nettoyeur haute » (112 produits) disparaît derrière
 * « nettoyeur haute pression » (111).
 */
const TRUNCATED_SHARE = 0.9;

/** Suggestions conservées au plus, les plus populaires. */
const MAX_SUGGESTIONS = 60_000;

/**
 * Premiers mots des désignations livrées en anglais ou en allemand par les
 * fournisseurs (Kramp, Husqvarna, Optibelt…). Les synonymes les rendent
 * trouvables ; on ne les propose pas pour autant à un client francophone.
 */
const FOREIGN_HEADS = new Set([
	'adapter',
	'arm',
	'assy',
	'axle',
	'ball',
	'bar',
	'bearing',
	'belt',
	'belts',
	'blade',
	'bolt',
	'bracket',
	'brake',
	'bush',
	'bushing',
	'cap',
	'carburetor',
	'chain',
	'clamp',
	'clutch',
	'connector',
	'control',
	'cover',
	'cylinder',
	'decal',
	'disc',
	'drive',
	'endless',
	'engine',
	'fan',
	'filter',
	'fitting',
	'flange',
	'frame',
	'front',
	'fuel',
	'gasket',
	'gear',
	'guard',
	'handle',
	'harness',
	'head',
	'high',
	'holder',
	'hood',
	'hose',
	'housing',
	'hub',
	'hydraulic',
	'kraftbands',
	'label',
	'left',
	'lever',
	'link',
	'lock',
	'manico',
	'manufactured',
	'mount',
	'muffler',
	'nut',
	'oil',
	'panel',
	'pin',
	'pipe',
	'plancia',
	'plate',
	'plug',
	'power',
	'pulley',
	'pump',
	'rear',
	'right',
	'ring',
	'rod',
	'roller',
	'schraube',
	'screw',
	'seal',
	'sechskantschraube',
	'set',
	'shaft',
	'sheet',
	'shield',
	'shim',
	'spacer',
	'spring',
	'starter',
	'steckverbindung',
	'switch',
	'tank',
	'timing',
	'v-belt',
	'valve',
	'washer',
	'wedge',
	'wheel',
	'wire'
]);

/** Marques génériques de la reprise : « courroie non original » n'aide personne. */
const PLACEHOLDER_BRANDS = new Set([
	'autre marque',
	'customer specific',
	'non original',
	'sans marque',
	'unbranded'
]);

const STOP_WORDS = new Set(FRENCH_STOP_WORDS);

/** Forme de comparaison : minuscules, sans accent, apostrophes et tirets en espaces. */
function fold(value: string): string {
	return value
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[’'-]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

/** Clé d'une expression : forme de comparaison sans mots vides. */
export function suggestionKey(text: string): string {
	return fold(text)
		.split(' ')
		.filter((word) => word && !STOP_WORDS.has(word))
		.join(' ');
}

/**
 * Deux libellés désignent-ils la même chose ? Comparaison sans accent, mot
 * vide ni marque du pluriel : « Robots de tonte » ≡ « robot tonte ».
 */
export function sameSuggestion(a: string, b: string): boolean {
	return singularKey(a) === singularKey(b);
}

/**
 * Clé sans marque du pluriel : « nettoyeurs haute pression » et « nettoyeur
 * haute pression » ne font qu'une suggestion.
 */
function singularKey(text: string): string {
	return suggestionKey(text)
		.split(' ')
		.map((word) => word.replace(/[sx]$/, ''))
		.join(' ');
}

/** Mot de contenu : des lettres (tirets et apostrophes compris), pas de chiffre. */
const WORD = /^[\p{L}][\p{L}'’-]*$/u;

/**
 * Mots de liaison : admis à l'intérieur d'une expression, jamais à sa fin.
 * « sans » n'est pas un mot vide (« perceuse sans fil » ≠ « perceuse fil »),
 * mais « meuleuse sans » n'est pas une suggestion.
 */
const LINKS = new Set([...FRENCH_STOP_WORDS, 'sans']);

/**
 * Expressions de tête d'une désignation : « Filtre à huile moteur 4T | KUBOTA »
 * → « filtre », « filtre à huile », « filtre à huile moteur ».
 *
 * La lecture s'arrête au premier élément qui n'est plus un mot (cote,
 * référence, parenthèse) : « Courroie 13x560 » ne donne que « courroie ».
 * Une expression ne finit jamais sur un mot de liaison.
 */
export function headPhrases(name: string): string[] {
	const designation = name.split('|')[0].toLowerCase().replace(/’/g, "'");
	const tokens = designation.split(/[\s,;:]+/).filter(Boolean);

	const phrases: string[] = [];
	const kept: string[] = [];
	let contentWords = 0;

	for (const token of tokens) {
		if (!WORD.test(token)) break;
		kept.push(token);
		if (LINKS.has(fold(token))) continue;
		if (contentWords === 0 && (token.length < 3 || FOREIGN_HEADS.has(fold(token)))) break;
		contentWords++;
		phrases.push(kept.join(' '));
		if (contentWords === MAX_WORDS) break;
	}
	return phrases;
}

/**
 * Libellé de marque pour une suggestion : « EGO POWER + » → « ego power »,
 * « HITACHI - HIKOKI » → « hitachi hikoki ». `null` pour les marques
 * génériques de la reprise.
 */
export function brandLabel(brand: string | null): string | null {
	if (!brand) return null;
	const label = brand
		.toLowerCase()
		.replace(/\s+[-–]\s+/g, ' ')
		.replace(/[+®™*]/g, '')
		.replace(/\s+/g, ' ')
		.trim();
	return label && !PLACEHOLDER_BRANDS.has(fold(label)) ? label : null;
}

/**
 * Score de classement. Logarithmes : 3 000 vis ne doivent pas écraser
 * 30 savons, et les ventes pèsent plus que l'abondance du catalogue — un
 * produit commandé vaut mieux qu'une longue série de références dormantes.
 */
export function popularity(products: number, sales: number): number {
	return Math.round(Math.log10(1 + products) * 100 + Math.log10(1 + sales) * 150);
}

/** Identifiant Meilisearch : caractères alphanumériques, tirets et soulignés. */
function suggestionId(key: string): string {
	return key.replace(/[^a-z0-9]+/g, '-').slice(0, 200);
}

type Tally = {
	products: number;
	sales: number;
	/** Graphies rencontrées (expressions de tête) : la plus fréquente est affichée. */
	displays: Map<string, number>;
	/** Pour une combinaison expression + marque : ses deux composantes. */
	phraseKey?: string;
	brand?: string;
};

function tally(map: Map<string, Tally>, key: string, sales: number, init: () => Tally) {
	const entry = map.get(key) ?? init();
	entry.products++;
	entry.sales += sales;
	map.set(key, entry);
	return entry;
}

/** Graphie la plus fréquente : « filtre à huile » plutôt que « filtre a huile ». */
function bestDisplay(entry: Tally): string {
	return [...entry.displays].sort((a, b) => b[1] - a[1])[0][0];
}

/** Lot de désignations lues par requête. */
const BATCH = 20_000;

/**
 * Suggestions tirées du catalogue actif.
 *
 * Parcourt toutes les désignations (une lecture légère, sans jointure
 * coûteuse), compte les expressions de tête — seules puis suivies de la
 * marque — et garde celles qui mènent à assez de produits. Chaque produit
 * compte une fois par suggestion : « Savon Dreumex … | DREUMEX » nourrit
 * « savon dreumex » par sa désignation comme par sa marque, mais une seule fois.
 */
export async function buildSuggestions(sql: Sql, ctx: IndexContext): Promise<SuggestionDocument[]> {
	const tallies = new Map<string, Tally>();
	let afterId = 0;

	for (;;) {
		const rows = await sql<{ id: number; name: string; brand: string | null }[]>`
			SELECT p.id, p.name, b.name AS brand
			  FROM product p
			  LEFT JOIN brand b ON b.id = p.brand_id
			 WHERE p.is_active AND p.id > ${afterId}
			 ORDER BY p.id
			 LIMIT ${BATCH}
		`;
		if (rows.length === 0) break;

		for (const row of rows) {
			const sales = ctx.sales.get(row.id) ?? 0;
			const brand = brandLabel(row.brand);
			const brandKey = brand ? singularKey(brand) : '';
			const counted = new Set<string>();

			const phrases = headPhrases(row.name);
			for (const phrase of phrases) {
				const key = singularKey(phrase);
				if (!key || counted.has(key)) continue;
				counted.add(key);
				const entry = tally(tallies, key, sales, () => ({
					products: 0,
					sales: 0,
					displays: new Map()
				}));
				entry.displays.set(phrase, (entry.displays.get(phrase) ?? 0) + 1);
			}

			// « courroie husqvarna », « filtre à huile kubota » : les deux
			// premières expressions seulement, au-delà la saisie devient rare.
			if (!brand) continue;
			for (const phrase of phrases.slice(0, 2)) {
				const phraseKey = singularKey(phrase);
				if (!phraseKey || phraseKey.includes(brandKey)) continue;
				const key = `${phraseKey} ${brandKey}`;
				if (counted.has(key)) continue;
				counted.add(key);
				tally(tallies, key, sales, () => ({
					products: 0,
					sales: 0,
					displays: new Map(),
					phraseKey,
					brand
				}));
			}
		}
		afterId = rows[rows.length - 1].id;
	}

	// Expressions tronquées : une suite reprend presque tous leurs produits.
	const truncated = new Set<string>();
	for (const [key, entry] of tallies) {
		if (entry.displays.size === 0) continue;
		const parentKey = key.split(' ').slice(0, -1).join(' ');
		const parent = parentKey ? tallies.get(parentKey) : undefined;
		if (parent && parent.displays.size > 0 && entry.products >= parent.products * TRUNCATED_SHARE) {
			truncated.add(parentKey);
		}
	}

	const documents: SuggestionDocument[] = [];
	for (const [key, entry] of tallies) {
		if (entry.products < MIN_PRODUCTS) continue;
		if (truncated.has(key) || (entry.phraseKey && truncated.has(entry.phraseKey))) continue;
		// Une combinaison s'affiche avec la graphie de son expression :
		// « filtre à huile iseki », même si les fiches Iseki écrivent « a ».
		const phrase = entry.phraseKey ? tallies.get(entry.phraseKey) : undefined;
		const text =
			entry.displays.size > 0
				? bestDisplay(entry)
				: phrase
					? `${bestDisplay(phrase)} ${entry.brand}`
					: null;
		if (!text) continue;
		documents.push({
			id: suggestionId(key),
			text,
			products: entry.products,
			popularity: popularity(entry.products, entry.sales)
		});
	}

	documents.sort((a, b) => b.popularity - a.popularity);
	// Deux clés peuvent donner le même identifiant (« b&s » / « b s ») : on
	// garde la plus populaire.
	const seen = new Set<string>();
	return documents.filter((doc) => !seen.has(doc.id) && seen.add(doc.id)).slice(0, MAX_SUGGESTIONS);
}
