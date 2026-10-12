import { describe, expect, it } from 'vitest';
import { categoryLineage, cleanEan, compactReferences, htmlToText } from './documents';
import { SYNONYM_GROUPS, SYNONYMS } from './synonyms';
import { cleanSearchQuery, FRENCH_STOP_WORDS } from './settings';

describe('htmlToText', () => {
	it('retire les balises et resserre les espaces', () => {
		expect(htmlToText('<p>Savon <b>doux</b></p>\n<p>11 l</p>')).toBe('Savon doux 11 l');
	});

	it('décode les entités courantes', () => {
		expect(htmlToText('Pâte&nbsp;lavante &amp; gel')).toBe('Pâte lavante & gel');
	});

	it('ignore le contenu des scripts et styles', () => {
		expect(htmlToText('<style>p{color:red}</style>Texte<script>alert(1)</script>')).toBe('Texte');
	});

	it('tronque au-delà de la longueur demandée', () => {
		expect(htmlToText('a'.repeat(50), 10)).toBe('a'.repeat(10));
	});

	it('renvoie une chaîne vide sans description', () => {
		expect(htmlToText(null)).toBe('');
	});
});

describe('compactReferences', () => {
	it('retire espaces, tirets, points et barres', () => {
		expect(compactReferences('587 42 07-01')).toEqual(['587420701']);
		expect(compactReferences('ISE-1729.733/210_30')).toEqual(['ise172973321030']);
	});

	it('dédoublonne et ignore les références absentes ou trop courtes', () => {
		expect(compactReferences('AB-12', null, 'ab12', '1-2')).toEqual(['ab12']);
	});
});

describe('cleanEan', () => {
	it('garde un EAN numérique plausible', () => {
		expect(cleanEan(' 3570523059320 ')).toBe('3570523059320');
	});

	it('écarte les valeurs de la reprise sans signification', () => {
		expect(cleanEan('0')).toBeNull();
		expect(cleanEan('0000000000000')).toBeNull();
		expect(cleanEan('ABC123')).toBeNull();
		expect(cleanEan(null)).toBeNull();
	});
});

describe('categoryLineage', () => {
	const node = (id: number, name: string, parentId: number | null, isActive = true, slug = name) =>
		[id, { id, name, slug, parentId, isActive }] as const;
	const categories = new Map([
		node(1, 'Pièces détachées', null),
		node(2, 'Hygiène', 1),
		node(3, 'Savons', 2),
		node(4, 'Ancien rayon', 2, false),
		node(5, 'À classer', 1, true, 'a-classer'),
		node(6, 'Orphelin', 4)
	]);

	it('remonte jusqu’à la racine, sans elle', () => {
		expect(categoryLineage(categories, 3)).toEqual(['Savons', 'Hygiène']);
	});

	it('saute les rayons inactifs et le fourre-tout « À classer »', () => {
		expect(categoryLineage(categories, 6)).toEqual(['Orphelin', 'Hygiène']);
		expect(categoryLineage(categories, 5)).toEqual([]);
	});

	it('renvoie une liste vide sans rayon', () => {
		expect(categoryLineage(categories, null)).toEqual([]);
	});
});

describe('SYNONYMS', () => {
	it('rend chaque groupe réciproque', () => {
		expect(SYNONYMS['nettoyant mains']).toContain('savon main');
		expect(SYNONYMS['savon main']).toContain('nettoyant mains');
		expect(SYNONYMS['savon main']).not.toContain('savon main');
	});

	it('ne range aucune expression dans deux groupes', () => {
		// Un doublon écraserait silencieusement le premier groupe.
		const terms = SYNONYM_GROUPS.flat();
		expect(terms.filter((term, i) => terms.indexOf(term) !== i)).toEqual([]);
	});

	it('écrit les expressions sans accent ni majuscule', () => {
		const invalid = SYNONYM_GROUPS.flat().filter(
			(term) => term !== term.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
		);
		expect(invalid).toEqual([]);
	});

	it('garde dans chaque groupe une expression saisissable sans mot vide', () => {
		// La saisie du client est débarrassée de ses mots vides : un groupe dont
		// toutes les expressions en contiennent ne se déclencherait jamais.
		const unreachable = SYNONYM_GROUPS.filter((group) =>
			group.every((term) => term.split(' ').some((word) => FRENCH_STOP_WORDS.includes(word)))
		);
		expect(unreachable).toEqual([]);
	});
});

describe('cleanSearchQuery', () => {
	it('retire les mots vides, accentués ou non', () => {
		expect(cleanSearchQuery('savon à main')).toBe('savon main');
		expect(cleanSearchQuery('Savon a Main')).toBe('Savon Main');
		expect(cleanSearchQuery('pantalon pour la tronçonneuse')).toBe('pantalon tronçonneuse');
	});

	it("retire les articles élidés : « d' », « l' »", () => {
		expect(cleanSearchQuery("filtre d'air")).toBe('filtre air');
		expect(cleanSearchQuery('huile de l’embrayage')).toBe('huile embrayage');
	});

	it('laisse intactes les références', () => {
		expect(cleanSearchQuery('A-123 de')).toBe('A-123');
		expect(cleanSearchQuery('587 42 07-01')).toBe('587 42 07-01');
	});

	it('garde la saisie si elle ne contient que des mots vides', () => {
		expect(cleanSearchQuery('le a')).toBe('le a');
	});
});
