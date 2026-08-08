/**
 * Verrouille la règle n°1 du cahier des charges (§4.1) :
 * **une marque n'est pas une catégorie.**
 *
 * Le défaut du 2026-08-08 (§6.6) était silencieux : `10-product-taxonomy`, qui
 * porte tout le filtrage des nœuds-marques, n'était pas branchée dans `index.ts`.
 * Le code était correct, il ne tournait simplement jamais — et `EGO POWER+`
 * serait revenu en catégorie sans qu'aucun test ne bronche.
 *
 * Ces tests couvrent donc autant les données (`brand-nodes.ts`) que le **câblage**
 * du pipeline, qui est ce qui avait lâché.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { BRAND_NODES, BRAND_NODE_IDS, PIECES_NODE_IDS } from './brand-nodes.ts';

const read = (relative: string) =>
	readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

describe('nœuds-marques — données', () => {
	it('déclare EGO POWER+, la marque citée par le client', () => {
		const ego = BRAND_NODES.find((n) => n.name === 'EGO POWER+');
		expect(ego, 'EGO POWER+ doit être écarté de l’arbre').toBeDefined();
		// Ses produits remontent au parent : le vrai nœud « Tondeuses » existe déjà.
		expect(ego?.redirect).toBe('parent');
	});

	it('n’a aucun identifiant en double', () => {
		expect(BRAND_NODE_IDS.size).toBe(BRAND_NODES.length);
	});

	it('ne redirige vers « pieces » que des nœuds effectivement peuplés', () => {
		for (const node of BRAND_NODES) {
			if (node.redirect === 'pieces') expect(node.products).toBeGreaterThan(0);
		}
		expect(PIECES_NODE_IDS.size).toBeGreaterThan(0);
	});

	it('justifie chaque nœud écarté', () => {
		for (const node of BRAND_NODES) {
			expect(node.reason.trim().length, `« ${node.name} » sans justification`).toBeGreaterThan(0);
		}
	});

	it('ne redistribue de produits que depuis des nœuds non vides', () => {
		for (const node of BRAND_NODES) {
			if (node.products === 0) expect(node.redirect).toBe('drop');
		}
	});
});

describe('câblage du pipeline — c’est ce qui avait lâché', () => {
	const index = read('./index.ts');

	it('branche bien product-taxonomy : sans elle, aucune marque n’est écartée', () => {
		expect(index).toContain('productTaxonomyTask');
		// Présente dans la liste exécutée, pas seulement importée.
		const list = index.slice(index.indexOf('const tasks = ['));
		expect(list).toContain('productTaxonomyTask');
	});

	it('n’importe plus l’arbre source verbatim dans la migration complète', () => {
		const list = index.slice(index.indexOf('const tasks = ['), index.indexOf('const guarded'));
		// `categoriesTask` réimporterait EGO POWER+ & les 93 % de nœuds vides.
		expect(list).not.toMatch(/^\s*categoriesTask,/m);
	});

	it('range les produits finis avant de reclasser les pièces', () => {
		const list = index.slice(index.indexOf('const tasks = ['));
		const taxonomy = list.indexOf('taxonomyTask,');
		const productTaxonomy = list.indexOf('productTaxonomyTask,');
		const reclassify = list.indexOf('reclassifyTask,');

		expect(taxonomy).toBeGreaterThan(-1);
		expect(productTaxonomy).toBeGreaterThan(taxonomy);
		// Sinon une tondeuse finit dans « Coupe & usure » sur son premier mot.
		expect(reclassify).toBeGreaterThan(productTaxonomy);
	});

	it('résout les liaisons N-N après avoir construit l’arbre propre', () => {
		const list = index.slice(index.indexOf('const tasks = ['));
		expect(list.indexOf('productCategoriesTask,')).toBeGreaterThan(
			list.indexOf('productTaxonomyTask,')
		);
	});
});

describe('reclassify — le compteur qui plantait', () => {
	const reclassify = read('./tasks/09-reclassify.ts');

	it('déclare `skipped` avant de l’incrémenter', () => {
		// Le défaut d’origine : `skipped++` sans déclaration → ReferenceError
		// au tout premier produit, donc tâche impossible à terminer.
		expect(reclassify).toMatch(/let skipped = 0;/);
	});
});
