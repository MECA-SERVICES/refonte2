import { describe, expect, it } from 'vitest';
import { ancestorsOf, descendantIds, parseArticleForm, parseCategoryForm } from './blog';

/** Construit un FormData à partir d'un objet, en ignorant les valeurs nulles. */
function form(fields: Record<string, string | null>) {
	const data = new FormData();
	for (const [key, value] of Object.entries(fields)) {
		if (value !== null) data.set(key, value);
	}
	return data;
}

describe('parseArticleForm', () => {
	it('exige un titre', () => {
		expect(parseArticleForm(form({ title: '' }))).toMatchObject({ ok: false });
	});

	it('exige une adresse pour un article vidéo (R7)', () => {
		const out = parseArticleForm(form({ title: 'Tuto', contentType: 'video' }));
		expect(out).toMatchObject({ ok: false });
		expect(!out.ok && out.error).toMatch(/vidéo/);
	});

	it('exige une adresse pour un lien externe (R7)', () => {
		const out = parseArticleForm(form({ title: 'Lien', contentType: 'external_link' }));
		expect(!out.ok && out.error).toMatch(/destination/);
	});

	it('accepte un article vidéo pourvu de son adresse', () => {
		const out = parseArticleForm(
			form({ title: 'Tuto', contentType: 'video', videoUrl: 'https://exemple.fr/v' })
		);
		expect(out).toMatchObject({ ok: true });
	});

	it('exige un extrait avant publication (R8)', () => {
		const out = parseArticleForm(
			form({ title: 'Article', status: 'published', blogCategoryId: '1' })
		);
		expect(!out.ok && out.error).toMatch(/extrait/i);
	});

	it('exige une catégorie avant publication (R8)', () => {
		const out = parseArticleForm(
			form({ title: 'Article', status: 'published', excerpt: 'Résumé' })
		);
		expect(!out.ok && out.error).toMatch(/catégorie/i);
	});

	it("n'impose ni extrait ni catégorie à un brouillon", () => {
		// Un brouillon est un travail en cours : le contraindre empêcherait de
		// l'enregistrer avant de l'avoir terminé.
		expect(parseArticleForm(form({ title: 'Brouillon' }))).toMatchObject({ ok: true });
	});

	it('publie un article complet', () => {
		const out = parseArticleForm(
			form({
				title: 'Bien choisir sa tondeuse',
				status: 'published',
				excerpt: 'Nos conseils',
				blogCategoryId: '3',
				content: '<p>texte</p>'
			})
		);
		expect(out).toMatchObject({ ok: true });
		if (out.ok) {
			expect(out.values.status).toBe('published');
			expect(out.values.blogCategoryId).toBe(3);
		}
	});
});

describe('parseCategoryForm', () => {
	it('exige un libellé', () => {
		expect(parseCategoryForm(form({ name: '' }))).toMatchObject({ ok: false });
	});

	it('retient la position et la visibilité', () => {
		const out = parseCategoryForm(form({ name: 'Conseils', sortOrder: '5', isActive: 'on' }));
		expect(out.ok && out.values.sortOrder).toBe(5);
		expect(out.ok && out.values.isActive).toBe(true);
	});

	it('considère une catégorie masquée quand la case est absente', () => {
		const out = parseCategoryForm(form({ name: 'Archives' }));
		expect(out.ok && out.values.isActive).toBe(false);
	});
});

/*
 * Arborescence de référence :
 *   1 Entretien
 *     2 Vidange
 *       4 Huile
 *     3 Filtres
 *   5 Moteur (racine sans enfant)
 */
const tree = [
	{ id: 1, parentId: null },
	{ id: 2, parentId: 1 },
	{ id: 3, parentId: 1 },
	{ id: 4, parentId: 2 },
	{ id: 5, parentId: null }
];

describe('descendantIds', () => {
	it('rassemble la catégorie et toute sa descendance', () => {
		expect(descendantIds(tree, 1).sort()).toEqual([1, 2, 3, 4]);
	});

	it('se limite à elle-même pour une feuille', () => {
		expect(descendantIds(tree, 4)).toEqual([4]);
	});

	it("s'arrête sur un cycle plutôt que de boucler", () => {
		// Donnée incohérente : 1 → 2 → 1. Le parcours doit rendre la main.
		const cyclic = [
			{ id: 1, parentId: 2 },
			{ id: 2, parentId: 1 }
		];
		expect(descendantIds(cyclic, 1).sort()).toEqual([1, 2]);
	});
});

describe('ancestorsOf', () => {
	it('remonte de la racine vers la catégorie', () => {
		const leaf = tree.find((c) => c.id === 4)!;
		expect(ancestorsOf(tree, leaf).map((c) => c.id)).toEqual([1, 2, 4]);
	});

	it('rend la catégorie seule quand elle est à la racine', () => {
		const root = tree.find((c) => c.id === 5)!;
		expect(ancestorsOf(tree, root).map((c) => c.id)).toEqual([5]);
	});

	it('borne la remontée sur un cycle', () => {
		const cyclic = [
			{ id: 1, parentId: 2 },
			{ id: 2, parentId: 1 }
		];
		// Sans borne, la remontée ne s'arrêterait jamais.
		expect(ancestorsOf(cyclic, cyclic[0]).length).toBeLessThanOrEqual(3);
	});
});

describe('parseCategoryForm — rattachement', () => {
	it('retient la catégorie parente choisie', () => {
		const out = parseCategoryForm(form({ name: 'Vidange', parentId: '7' }));
		expect(out).toMatchObject({ ok: true, values: { parentId: 7 } });
	});

	it('traite une valeur vide comme une catégorie principale', () => {
		const out = parseCategoryForm(form({ name: 'Entretien', parentId: '' }));
		expect(out).toMatchObject({ ok: true, values: { parentId: null } });
	});

	it('écarte un identifiant de parent aberrant', () => {
		const out = parseCategoryForm(form({ name: 'Entretien', parentId: 'abc' }));
		expect(out).toMatchObject({ ok: true, values: { parentId: null } });
	});
});
