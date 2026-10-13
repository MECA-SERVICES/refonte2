/**
 * Définition des index Meilisearch de la boutique.
 *
 * Module partagé entre l'application et les scripts (`scripts/search-index.ts`) :
 * imports relatifs uniquement, aucun alias `$lib`.
 *
 * Meilisearch classe, Postgres affiche : les documents ne portent que ce qui
 * sert à chercher, filtrer, trier ou classer. Prix TTC, vignette et stock
 * affiché sont relus en base au moment de l'affichage — un changement d'image
 * ou de taux de TVA n'oblige donc à aucune réindexation.
 */
import type { Settings } from 'meilisearch';
import { SYNONYMS } from './synonyms.ts';

export const PRODUCTS_INDEX = 'products';
export const CATEGORIES_INDEX = 'categories';
export const BRANDS_INDEX = 'brands';
export const SUGGESTIONS_INDEX = 'suggestions';

/** Index reconstruit à côté du vrai, puis basculé d'un bloc (`swapIndexes`). */
export const PRODUCTS_REBUILD_INDEX = 'products_rebuild';

/**
 * Mots vides du français : « à », « de », « pour »…
 *
 * Ni retirés de la saisie, ni déclarés à l'index (`stopWords: []`). Ils
 * comptent dans l'ordre des mots : « Liquide de refroidissement » doit passer
 * devant « Filtre liquide refroidissement » quand le client tape « liquide de
 * refroidissement ». Deux réglages évitent qu'ils ne nuisent :
 * - la recherche abandonne d'abord les mots les plus fréquents quand il
 *   manque des résultats (`matchingStrategy: 'frequency'`) — « de » avant
 *   « refroidissement » ;
 * - les synonymes sont déclinés avec les mots de liaison (`joinerVariants`).
 *
 * Servent aussi à découper les suggestions (`./suggestions.ts`). « sans » n'en
 * fait pas partie : « perceuse sans fil » ne doit pas devenir « perceuse fil ».
 */
export const FRENCH_STOP_WORDS = [
	'a',
	'à',
	'au',
	'aux',
	'avec',
	'ce',
	'ces',
	'd',
	'dans',
	'de',
	'des',
	'du',
	'en',
	'et',
	'l',
	'la',
	'le',
	'les',
	'ou',
	'par',
	'pour',
	'sur',
	'un',
	'une'
];

/** Article élidé en tête de mot : « d'air », « l’huile ». */
const ELISION = /\b[dl]['’]/gi;

/**
 * Mots importants de la saisie : sans mots vides ni articles élidés.
 * « plaquette de frein » → « plaquette frein ».
 *
 * Sert à délimiter les résultats, pas à les classer : un produit compte s'il
 * contient tous les mots importants (`$lib/server/meili`). Le classement, lui,
 * se fait sur la saisie complète, pour que « Liquide de refroidissement »
 * passe devant « Filtre liquide refroidissement ».
 */
export function significantQuery(raw: string): string {
	const words = raw.replace(ELISION, '').split(/\s+/).filter(Boolean);
	const kept = words.filter(
		(word) =>
			!FRENCH_STOP_WORDS.includes(
				word
					.normalize('NFD')
					.replace(/[\u0300-\u036f]/g, '')
					.toLowerCase()
			)
	);
	return (kept.length > 0 ? kept : words).join(' ');
}

/**
 * Index produits.
 *
 * - L'ordre de `searchableAttributes` est la priorité des champs (CDC 08-R3) :
 *   une correspondance sur la désignation prime sur la description.
 * - `typeRank` départage les résultats dont le texte correspond aussi bien :
 *   les machines avant les pièces (« karcher » montre ses nettoyeurs haute
 *   pression avant ses rondelles). Placé avant `wordPosition`, sans quoi
 *   « Rondelle | KÄRCHER », où la marque vient plus tôt, passerait devant ;
 * - `sales` puis `inStock` départagent la fin : le savon vendu chaque mois passe
 *   devant le garde-main jamais commandé.
 * - Références et EAN ne tolèrent aucune faute : « 5874207 » proche de
 *   « 5874208 » serait une autre pièce.
 */
export const PRODUCTS_SETTINGS: Settings = {
	searchableAttributes: [
		'name',
		'reference',
		'supplierReference',
		'referenceCompact',
		'ean13',
		'brand',
		'categories',
		'supplierCategory',
		'description'
	],
	filterableAttributes: ['type', 'brandId', 'inStock', 'specs'],
	sortableAttributes: ['priceHt', 'createdAt', 'name'],
	rankingRules: [
		'words',
		'attributeRank',
		'typo',
		'proximity',
		'sort',
		'typeRank:desc',
		'wordPosition',
		'exactness',
		'sales:desc',
		'inStock:desc'
	],
	stopWords: [],
	synonyms: SYNONYMS,
	typoTolerance: {
		disableOnAttributes: ['reference', 'supplierReference', 'referenceCompact', 'ean13'],
		disableOnNumbers: true
	},
	localizedAttributes: [
		{
			attributePatterns: ['name', 'categories', 'supplierCategory', 'description'],
			locales: ['fra']
		}
	],
	// Les facettes de caractéristiques se lisent par fréquence, comme le faisait
	// l'agrégation SQL : les valeurs les plus courantes d'abord.
	faceting: { maxValuesPerFacet: 300, sortFacetValuesBy: { '*': 'count' } },
	pagination: { maxTotalHits: 2000 }
};

/** Rayons proposés dans l'aperçu (« robot tondeuse » → « Robots de tonte »). */
export const CATEGORIES_SETTINGS: Settings = {
	searchableAttributes: ['name', 'parents'],
	rankingRules: ['words', 'typo', 'proximity', 'attributeRank', 'exactness', 'products:desc'],
	stopWords: [],
	synonyms: SYNONYMS,
	localizedAttributes: [{ attributePatterns: ['name', 'parents'], locales: ['fra'] }]
};

/** Marques proposées dans l'aperçu. */
export const BRANDS_SETTINGS: Settings = {
	searchableAttributes: ['name'],
	rankingRules: ['words', 'typo', 'proximity', 'exactness', 'products:desc']
};

/**
 * Suggestions de saisie (`./suggestions.ts`). À pertinence égale — toutes les
 * expressions qui commencent par « sav » — la plus populaire d'abord ; une
 * suggestion identique à la saisie passe devant (`exactness`).
 */
export const SUGGESTIONS_SETTINGS: Settings = {
	searchableAttributes: ['text'],
	rankingRules: ['words', 'typo', 'proximity', 'wordPosition', 'exactness', 'popularity:desc'],
	stopWords: [],
	synonyms: SYNONYMS,
	localizedAttributes: [{ attributePatterns: ['text'], locales: ['fra'] }]
};
