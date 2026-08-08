/**
 * Tests de l'extraction « remplacé par » (`12-replacements.ts`).
 *
 * 18 803 produits sont concernés. Une extraction trop permissive créerait des
 * liaisons vers de mauvais produits — pire qu'une fiche sans remplaçant, car
 * elle enverrait le client acheter la mauvaise pièce.
 */
import { describe, it, expect } from 'vitest';
import { parseReplacement } from './tasks/12-replacements.ts';

describe('parseReplacement — formes réelles relevées en source', () => {
	it('lit les deux graphies citées au §5.2', () => {
		expect(parseReplacement('Remplacé Par 703961 | AL-KO')).toBe('703961');
		expect(parseReplacement('REMPLACE PAR 191G51-7')).toBe('191G51-7');
	});

	it('ignore accents et casse', () => {
		expect(parseReplacement('REMPLACÉ PAR 123456')).toBe('123456');
		expect(parseReplacement('remplace par 123456')).toBe('123456');
	});

	it('coupe la marque après le séparateur', () => {
		expect(parseReplacement('Remplacé Par 703961 | AL-KO')).toBe('703961');
		expect(parseReplacement('REMPLACE PAR 8888 / HUSQVARNA')).toBe('8888');
	});

	it('refuse une référence sans chiffre — ce n’est pas une référence', () => {
		// Ces libellés existent et ne désignent aucun produit précis : les lier
		// enverrait le client sur une pièce arbitraire.
		expect(parseReplacement('REMPLACE PAR VOIR FICHE')).toBeNull();
		expect(parseReplacement('REMPLACE PAR NOUVEAU MODELE')).toBeNull();
	});

	it('refuse ce qui n’est pas un produit obsolète', () => {
		expect(parseReplacement('VIS M8X40')).toBeNull();
		expect(parseReplacement('COURROIE TRAPEZOIDALE')).toBeNull();
		expect(parseReplacement('')).toBeNull();
	});

	it('refuse une phrase trop longue pour être une référence', () => {
		expect(
			parseReplacement('REMPLACE PAR LA REFERENCE 12345 DISPONIBLE CHEZ VOTRE REVENDEUR HABITUEL')
		).toBeNull();
	});

	it('ne se déclenche pas sur un simple préfixe « REMPLACE »', () => {
		// `firstWord` de la taxonomie traite `REMPLACÉ*` ; ici il faut la forme
		// complète « REMPLACE PAR », sinon on lierait des pièces de rechange
		// légitimes (« REMPLACEMENT JOINT »).
		expect(parseReplacement('REMPLACEMENT JOINT 12345')).toBeNull();
	});
});
