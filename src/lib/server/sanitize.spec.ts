import { describe, expect, it } from 'vitest';
import { sanitizeHtml } from './sanitize';

describe('sanitizeHtml', () => {
	it('conserve la mise en forme produite par l’éditeur', () => {
		const html =
			'<h2>Titre</h2><p><strong>gras</strong> et <em>italique</em></p>' +
			'<blockquote><p>citation</p></blockquote><pre><code>du code</code></pre>' +
			'<ul><li>un</li></ul>';
		const out = sanitizeHtml(html);

		for (const tag of ['h2', 'strong', 'em', 'blockquote', 'pre', 'code', 'ul', 'li']) {
			expect(out).toContain(`<${tag}>`);
		}
	});

	it('retire les scripts avec leur contenu', () => {
		const out = sanitizeHtml('<p>avant</p><script>alert(1)</script><p>après</p>');
		expect(out).not.toContain('alert');
		expect(out).toContain('avant');
		expect(out).toContain('après');
	});

	it('supprime les gestionnaires d’événements', () => {
		expect(sanitizeHtml('<p onclick="steal()">texte</p>')).not.toContain('onclick');
	});

	it('refuse un lien javascript:', () => {
		const out = sanitizeHtml('<a href="javascript:alert(1)">clic</a>');
		expect(out).not.toContain('javascript:');
		expect(out).toContain('clic');
	});

	it('refuse une image dont la source est un script', () => {
		// Sans contrôle sur `src`, cette valeur passerait comme un attribut banal.
		const out = sanitizeHtml('<img src="javascript:alert(1)" alt="x" />');
		expect(out).not.toContain('javascript:');
	});

	it('conserve une image légitime et son texte alternatif', () => {
		const out = sanitizeHtml('<img src="/media/photo.jpg" alt="Une photo" />');
		expect(out).toContain('src="/media/photo.jpg"');
		expect(out).toContain('alt="Une photo"');
	});

	it('protège l’onglet d’origine sur un lien externe', () => {
		const out = sanitizeHtml('<a href="https://exemple.fr" target="_blank">lien</a>');
		expect(out).toContain('rel="noopener noreferrer"');
	});

	it('laisse le texte intact quand aucune balise n’est autorisée', () => {
		expect(sanitizeHtml('<marquee>défile</marquee>')).toContain('défile');
	});
});
