/**
 * Tests du mapping KRAMP (`kramp-mapping.ts`).
 *
 * Décision client (2026-08-08) : KRAMP est une marque, son silo de 480
 * catégories est supprimé et ses catégories rejoignent l'arbre commun.
 *
 * Ces tests verrouillent le point critique : **toute cible du mapping doit
 * exister dans `taxonomy.ts`**. Une faute de frappe enverrait des milliers de
 * produits nulle part, silencieusement — le mode de défaillance exact qui a
 * causé les 81 % d'orphelins de la migration précédente.
 */
import { describe, it, expect } from 'vitest';
import {
	KRAMP_SUBFAMILY_MAP,
	KRAMP_LEAF_MAP,
	resolveKrampPath,
	splitTarget,
	assertKrampTargetsExist
} from './kramp-mapping.ts';
import { PIECE_TAXONOMY } from './taxonomy.ts';

/** Chemins `Famille > Sous-famille > Type` réellement définis dans la taxonomie. */
const knownPaths = new Set<string>();
for (const family of PIECE_TAXONOMY) {
	for (const sub of family.children) {
		for (const type of sub.children) {
			knownPaths.add(`${family.name} > ${sub.name} > ${type.name}`);
		}
	}
}

describe('cibles du mapping', () => {
	it('pointent toutes vers un chemin existant de la taxonomie', () => {
		// Le garde-fou joué au démarrage de `reclassify`.
		expect(() => assertKrampTargetsExist(knownPaths)).not.toThrow();
	});

	it('échoue bruyamment si une cible n’existe pas', () => {
		expect(() => assertKrampTargetsExist(new Set(['Rien > Du > Tout']))).toThrow(/absente/);
	});

	it('ont toutes exactement trois niveaux', () => {
		for (const path of [
			...Object.values(KRAMP_SUBFAMILY_MAP),
			...Object.values(KRAMP_LEAF_MAP)
		]) {
			expect(() => splitTarget(path), `« ${path} »`).not.toThrow();
		}
	});

	it('refuse un chemin mal formé', () => {
		expect(() => splitTarget('Trop > Court')).toThrow(/3 niveaux/);
	});
});

describe('resolveKrampPath — la feuille prime sur la sous-famille', () => {
	it('utilise la feuille quand elle est mappée, car plus précise', () => {
		// « Entraînement > Roulements » : la sous-famille dirait « Arbres »,
		// la feuille dit « Roulements ». C'est la feuille qui doit gagner.
		expect(resolveKrampPath('Entraînement', 'Roulements')).toBe(
			'Roulements & guidage > Roulements > Roulements'
		);
	});

	it('retombe sur la sous-famille quand la feuille est inconnue', () => {
		expect(resolveKrampPath('Hydraulique', 'Feuille jamais vue')).toBe(
			'Hydraulique & pneumatique > Raccords > Raccords'
		);
	});

	it('retourne null quand rien ne correspond', () => {
		// Préférable à un rangement arbitraire : le produit part en « À classer »
		// et sera traité au palier 4.
		expect(resolveKrampPath('Jouets, loisirs & livres', 'Jouets')).toBeNull();
		expect(resolveKrampPath('', '')).toBeNull();
	});

	it('tolère les espaces autour des libellés', () => {
		expect(resolveKrampPath('  Hydraulique  ', '  Coupleurs  ')).toBe(
			'Hydraulique & pneumatique > Raccords > Raccords'
		);
	});

	it('classe les gros volumes mesurés le 2026-08-08', () => {
		// Les trois plus gros reliquats non classés par le premier mot.
		expect(resolveKrampPath("Outillage et équipement d'atelier", 'Outillage à main')).toBe(
			'Outillage à main > Outillage à main > Outils à main'
		);
		expect(resolveKrampPath('Vêtements et protection (EPI)', 'Gants')).toBe(
			'Équipement de protection > EPI > Gants'
		);
		expect(resolveKrampPath('Travail du sol', 'Charrues')).toBe(
			'Coupe & usure > Dents & socs > Socs'
		);
	});
});
