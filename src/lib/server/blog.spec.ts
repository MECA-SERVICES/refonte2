import { describe, expect, it } from 'vitest';
import { parseArticleForm, parseCategoryForm } from './blog';

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
