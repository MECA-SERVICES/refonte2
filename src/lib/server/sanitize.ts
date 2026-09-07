/**
 * Assainissement des descriptions HTML reprises de PrestaShop.
 *
 * Ces textes sont saisis en back-office et contiennent de la mise en forme
 * légitime (listes, tableaux de caractéristiques, gras). Ils sont donc rendus
 * via `{@html}`, ce qui impose de les nettoyer avant affichage : on ne garde
 * qu'une liste blanche de balises et d'attributs, et on retire tout ce qui peut
 * exécuter du script.
 */

/** Balises de mise en forme conservées. */
const ALLOWED_TAGS = new Set([
	'p',
	'br',
	'strong',
	'b',
	'em',
	'i',
	'u',
	'ul',
	'ol',
	'li',
	'h2',
	'h3',
	'h4',
	'h5',
	'h6',
	'table',
	'thead',
	'tbody',
	'tr',
	'th',
	'td',
	'a',
	'span',
	'div',
	'small',
	'sub',
	'sup',
	'hr'
]);

/** Attributs conservés, par balise. */
const ALLOWED_ATTRS: Record<string, Set<string>> = {
	a: new Set(['href', 'title', 'target', 'rel'])
};

/** Protocoles autorisés dans un href. */
const SAFE_HREF = /^(https?:|mailto:|tel:|\/|#)/i;

/** Blocs entiers supprimés avec leur contenu. */
const DANGEROUS_BLOCKS = /<(script|style|iframe|object|embed|noscript)\b[\s\S]*?<\/\1\s*>/gi;

/** Balise ouvrante ou fermante, avec ses attributs éventuels. */
const TAG = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g;

/** Paires attribut="valeur" (guillemets simples, doubles, ou sans). */
const ATTR = /([a-zA-Z_:][-\w:.]*)\s*=\s*("[^"]*"|'[^']*'|[^\s"'>]+)/g;

function cleanAttributes(tag: string, raw: string): string {
	const allowed = ALLOWED_ATTRS[tag];
	if (!allowed) return '';

	const kept: string[] = [];
	for (const match of raw.matchAll(ATTR)) {
		const name = match[1].toLowerCase();
		if (!allowed.has(name)) continue;

		const value = match[2].replace(/^["']|["']$/g, '');
		if (name === 'href' && !SAFE_HREF.test(value.trim())) continue;

		kept.push(`${name}="${value.replace(/"/g, '&quot;')}"`);
	}

	// Un lien externe ne doit pas donner la main sur l'onglet d'origine.
	if (tag === 'a' && kept.some((a) => a.startsWith('target='))) {
		if (!kept.some((a) => a.startsWith('rel='))) kept.push('rel="noopener noreferrer"');
	}

	return kept.length > 0 ? ` ${kept.join(' ')}` : '';
}

/**
 * Retourne le HTML nettoyé, prêt à être rendu via `{@html}`.
 * Les balises non autorisées sont retirées, leur contenu textuel conservé.
 */
export function sanitizeHtml(input: string | null | undefined): string | null {
	if (!input) return null;

	const html = input.replace(DANGEROUS_BLOCKS, '');

	const clean = html.replace(TAG, (full, rawTag: string, attrs: string) => {
		const tag = rawTag.toLowerCase();
		if (!ALLOWED_TAGS.has(tag)) return '';
		if (full.startsWith('</')) return `</${tag}>`;

		const selfClosing = /\/\s*>$/.test(full);
		return `<${tag}${cleanAttributes(tag, attrs)}${selfClosing ? ' /' : ''}>`;
	});

	return clean.trim() || null;
}
