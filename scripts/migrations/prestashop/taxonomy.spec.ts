/**
 * La taxonomie décide du rangement de ~1 M de produits. Une erreur y est
 * silencieuse : rien ne plante, les produits atterrissent juste au mauvais
 * endroit — et il faut tout rejouer pour s'en apercevoir.
 *
 * Ces tests verrouillent les trois propriétés dont dépend le classement :
 * unicité des mots-clés, normalisation du premier mot, et mapping FR/EN.
 */
import { describe, it, expect } from 'vitest';
import {
	PIECE_TAXONOMY,
	NOISE_WORDS,
	OBSOLETE_PREFIXES,
	assertNoDuplicateKeywords,
	buildKeywordIndex,
	firstWord
} from './taxonomy.ts';

describe('taxonomie', () => {
	it("n'a aucun mot-clé en doublon", () => {
		// Un doublon rendrait le rangement dépendant de l'ordre de parcours,
		// donc instable d'une exécution à l'autre.
		expect(() => assertNoDuplicateKeywords()).not.toThrow();
	});

	it('signale un doublon introduit par erreur', () => {
		const broken = [
			{
				name: 'A',
				children: [{ name: 'A1', children: [{ name: 'A1a', keywords: ['VIS'] }] }]
			},
			{
				name: 'B',
				children: [{ name: 'B1', children: [{ name: 'B1a', keywords: ['VIS'] }] }]
			}
		];
		expect(() => assertNoDuplicateKeywords(broken)).toThrow(/VIS/);
	});

	it('respecte la profondeur validée : famille > sous-famille > type', () => {
		for (const family of PIECE_TAXONOMY) {
			expect(family.children.length).toBeGreaterThan(0);
			for (const sub of family.children) {
				expect(sub.children.length).toBeGreaterThan(0);
				for (const type of sub.children) {
					expect(type.keywords.length).toBeGreaterThan(0);
				}
			}
		}
	});

	it("n'utilise aucun mot de bruit comme signal de classement", () => {
		// `HIGH`, `PLUS`, `(C)`… sont des préfixes d'import : les laisser dans
		// les règles rangerait des milliers de produits au hasard.
		const index = buildKeywordIndex();
		for (const noise of NOISE_WORDS) {
			expect(index.has(noise), `« ${noise} » est à la fois bruit et mot-clé`).toBe(false);
		}
	});
});

describe('firstWord', () => {
	it('met en majuscules et retire les espaces', () => {
		expect(firstWord('  courroie crantee ')).toBe('COURROIE');
	});

	it('retire la ponctuation finale des noms tronqués', () => {
		// L'import PrestaShop tronque à ~30 caractères et laisse des virgules :
		// `HOSE,` (1 623) et `PLATE,` (1 284) doivent rejoindre `HOSE` et `PLATE`.
		expect(firstWord('HOSE, HYDRAULIC 3/8')).toBe('HOSE');
		expect(firstWord('PLATE,')).toBe('PLATE');
		expect(firstWord('DECAL, WARNING')).toBe('DECAL');
	});

	it('gère les noms vides ou absents sans lever', () => {
		expect(firstWord('')).toBe('');
		expect(firstWord('   ')).toBe('');
	});

	it('conserve le premier mot seul, jamais la suite', () => {
		// Les noms sont tronqués : on ne doit jamais se fier à la fin (§5.2).
		expect(firstWord('VIS M8x40 INOX A4')).toBe('VIS');
	});
});

describe('classement', () => {
	const index = buildKeywordIndex();

	it('range le français et l’anglais dans la même famille', () => {
		// Les fournisseurs étrangers livrent en anglais : sans ce mapping, les
		// familles se scindent en deux (§5.2 piège n°1).
		const pairs: [string, string][] = [
			['VIS', 'SCREW'],
			['RESSORT', 'SPRING'],
			['ROULEMENT', 'BEARING'],
			['JOINT', 'GASKET'],
			['COURROIE', 'TIMING']
		];

		for (const [fr, en] of pairs) {
			const a = index.get(fr);
			const b = index.get(en);
			expect(a, `« ${fr} » absent des règles`).toBeDefined();
			expect(b, `« ${en} » absent des règles`).toBeDefined();
			expect(a!.family, `${fr} / ${en} dans des familles différentes`).toBe(b!.family);
		}
	});

	it('reconnaît les produits obsolètes', () => {
		for (const name of ['REMPLACÉ PAR 703961 | AL-KO', 'REMPLACE PAR 191G51-7']) {
			const word = firstWord(name);
			expect(OBSOLETE_PREFIXES.some((p) => word.startsWith(p))).toBe(true);
		}
	});

	it('ne classe pas un produit dont le premier mot est inconnu', () => {
		expect(index.get('ZZZINCONNU')).toBeUndefined();
	});

	it('couvre les premiers mots les plus fréquents du catalogue', () => {
		// Volumes relevés à l'étape 1 : ces mots représentent à eux seuls
		// plusieurs centaines de milliers de produits.
		const topWords = [
			'VIS',
			'JOINT',
			'SUPPORT',
			'RONDELLE',
			'ROULEMENT',
			'RESSORT',
			'FILTRE',
			'CABLE',
			'COURROIE',
			'BOULON',
			'ECROU',
			'AXE',
			'CARTER',
			'TUBE',
			'RACCORD'
		];

		for (const word of topWords) {
			expect(index.get(word), `« ${word} » n'est rangé nulle part`).toBeDefined();
		}
	});
});
