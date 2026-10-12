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

/** Index reconstruit à côté du vrai, puis basculé d'un bloc (`swapIndexes`). */
export const PRODUCTS_REBUILD_INDEX = 'products_rebuild';

/**
 * Mots vides : retirés de la saisie du client avant recherche (`cleanSearchQuery`).
 *
 * C'est le premier défaut de l'ancienne recherche : dans « savon a main »,
 * le « a » était cherché comme un mot et se trouvait partout. « sans » n'en
 * fait pas partie : « perceuse sans fil » ne doit pas devenir « perceuse fil ».
 *
 * Volontairement absents des réglages d'index (`stopWords: []`) : un mot vide
 * déclaré à Meilisearch disparaît des fiches mais y garde sa place, et plus
 * aucune expression ne colle au texte — le synonyme « nettoyant pour mains »
 * n'atteignait plus « Nettoyant pour mains SF7850 ».
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
 * Saisie du client débarrassée de ses mots vides, avant envoi à Meilisearch.
 *
 * Retirés ici plutôt que déclarés à l'index : « savon à main » devient
 * « savon main », dont les mots se suivent — l'expression synonyme
 * « savon main » se déclenche, quelle que soit la formulation du client.
 */
export function cleanSearchQuery(raw: string): string {
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
 * - `sales` puis `inStock` départagent les résultats de pertinence égale :
 *   le savon vendu chaque mois passe devant le garde-main jamais commandé.
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
