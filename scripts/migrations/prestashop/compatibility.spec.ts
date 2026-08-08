/**
 * Tests des heuristiques d'extraction de compatibilité (`11-compatibility.ts`).
 *
 * Ces deux fonctions décident ce qui devient un modèle de machine et sur quelle
 * plage d'années. Une erreur ici produit des milliers de faux modèles dans le
 * sélecteur « Ma machine » — d'où ces cas verrouillés.
 */
import { describe, it, expect } from 'vitest';
import { parseYears, isStructural } from './tasks/11-compatibility.ts';

describe('parseYears — les années sont dans le libellé', () => {
	it('lit une année seule', () => {
		expect(parseYears('2003')).toEqual({ from: 2003, to: null });
	});

	it('lit une plage', () => {
		expect(parseYears('2003-2008')).toEqual({ from: 2003, to: 2008 });
		expect(parseYears('DE 2003 A 2008')).toEqual({ from: 2003, to: 2008 });
	});

	it('ignore un libellé sans année', () => {
		expect(parseYears('TONDEUSES')).toEqual({ from: null, to: null });
	});

	it('ne confond pas une cylindrée ou une référence avec une année', () => {
		// `46CM` (largeur de coupe) et `6202520` (référence ISEKI) ne doivent
		// jamais être lus comme des millésimes.
		expect(parseYears('46CM')).toEqual({ from: null, to: null });
		expect(parseYears('ISE-6202520')).toEqual({ from: null, to: null });
	});

	it('borne les millésimes plausibles', () => {
		expect(parseYears('1949')).toEqual({ from: null, to: null });
		expect(parseYears('1950')).toEqual({ from: 1950, to: null });
	});

	it('tolère un libellé vide', () => {
		expect(parseYears('')).toEqual({ from: null, to: null });
	});
});

describe('isStructural — les nœuds qui ne sont pas des modèles', () => {
	it('écarte les nœuds répétés sous chaque marque', () => {
		// Sans ce filtre, `Options` ×30 et `Accessoires` deviendraient autant de
		// « modèles de machine » distincts.
		for (const name of ['Options', 'OPTIONS', 'Divers', 'Accessoires', 'Autres']) {
			expect(isStructural(name), `« ${name} » devrait être écarté`).toBe(true);
		}
	});

	it('ignore accents et casse', () => {
		expect(isStructural('Pièces détachées')).toBe(true);
		expect(isStructural('  divers  ')).toBe(true);
	});

	it('conserve les vrais modèles', () => {
		for (const name of ['SF224', 'TS 60', '46CM', 'TONDEUSES']) {
			expect(isStructural(name), `« ${name} » devrait être conservé`).toBe(false);
		}
	});
});
