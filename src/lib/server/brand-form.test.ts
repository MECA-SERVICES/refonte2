import { describe, it, expect } from 'vitest';
import { parseBrandForm } from './catalog';

describe('parseBrandForm — page de marque', () => {
	it('retient les champs éditoriaux', () => {
		const f = new FormData();
		f.set('name', 'Husqvarna');
		f.set('heroImageUrl', '  /img/hero.jpg  ');
		f.set('tagline', 'Agréé depuis 1985');
		f.set('pageContent', '<p>Bonjour</p>');
		f.set('metaTitle', 'Pièces Husqvarna');
		const r = parseBrandForm(f) as { values: Record<string, unknown> };
		expect(r.values.heroImageUrl).toBe('/img/hero.jpg');
		expect(r.values.tagline).toBe('Agréé depuis 1985');
		expect(r.values.pageContent).toBe('<p>Bonjour</p>');
		expect(r.values.metaTitle).toBe('Pièces Husqvarna');
		expect(r.values.metaDescription).toBeNull();
	});

	it('vide les champs non renseignés', () => {
		const f = new FormData();
		f.set('name', 'Stiga');
		f.set('tagline', '   ');
		const r = parseBrandForm(f) as { values: Record<string, unknown> };
		expect(r.values.tagline).toBeNull();
		expect(r.values.pageContent).toBeNull();
		expect(r.values.heroImageUrl).toBeNull();
	});
});
