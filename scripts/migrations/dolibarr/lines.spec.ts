import { describe, expect, it } from 'vitest';
import { htmlLines, lineText } from './lines.ts';

describe('texte des lignes Dolibarr', () => {
	it('garde les retours à la ligne et décode les entités', () => {
		expect(
			htmlLines(
				'<h4><strong>&bull; Type moteur : 2 temps</strong><br />\r\n<strong>&bull; Cylindr&eacute;e : 22,2 cm3&nbsp;</strong></h4>\r\nN&deg; serie : 7K30-000050<br />\r\nGARANTIE 2 ANS'
			)
		).toBe(
			'• Type moteur : 2 temps\n• Cylindrée : 22,2 cm3\nN° serie : 7K30-000050\nGARANTIE 2 ANS'
		);
		expect(htmlLines('d&#39;entretien &Agrave; l&rsquo;atelier')).toBe("d'entretien À l’atelier");
		expect(htmlLines('&Oslash; 20 mm &plusmn; 1 &ge; 5&trade;')).toBe('Ø 20 mm ± 1 ≥ 5™');
		expect(htmlLines(null)).toBe('');
	});

	it('met le texte d’une ligne produit en détail', () => {
		expect(
			lineText({
				label: null,
				product_label: 'Tronçonneuse PS420SC38',
				description: 'N&deg; SERIE : 083865 Y<br />\r\nGarantie 12 mois'
			})
		).toEqual({
			label: 'Tronçonneuse PS420SC38',
			description: 'N° SERIE : 083865 Y\nGarantie 12 mois'
		});
		expect(
			lineText({ label: null, product_label: 'Courroie', description: 'Courroie' }).description
		).toBeNull();
	});

	it('tire la désignation d’une ligne libre de sa première ligne', () => {
		expect(
			lineText({ label: null, product_label: null, description: 'ROUE AVANT&nbsp;547412801' })
		).toEqual({ label: 'ROUE AVANT 547412801', description: null });
		expect(
			lineText({ label: null, product_label: null, description: 'Réparation<br />Pignon changé' })
		).toEqual({ label: 'Réparation', description: 'Pignon changé' });
		expect(lineText({ label: null, product_label: null, description: null }).label).toBe('Ligne');
	});
});
