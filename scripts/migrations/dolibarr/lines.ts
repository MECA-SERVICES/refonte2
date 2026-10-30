/**
 * Texte d'une ligne de facture ou de devis Dolibarr (`llx_facturedet`,
 * `llx_propaldet`) : désignation et détail.
 *
 * Dolibarr range sous la désignation du produit un texte libre en HTML : n° de
 * série, garantie, caractéristiques. Il devient le détail de la ligne
 * (`description`), retours à la ligne gardés. Une ligne libre n'a souvent que
 * ce texte : sa première ligne devient la désignation, le reste le détail.
 */

const ENTITIES: Record<string, string> = {
	nbsp: ' ',
	amp: '&',
	quot: '"',
	apos: "'",
	lt: '<',
	gt: '>',
	deg: '°',
	bull: '•',
	middot: '·',
	hellip: '…',
	laquo: '«',
	raquo: '»',
	lsquo: '‘',
	rsquo: '’',
	ldquo: '“',
	rdquo: '”',
	ndash: '–',
	mdash: '—',
	euro: '€',
	sup2: '²',
	sup3: '³',
	times: '×',
	plusmn: '±',
	ge: '≥',
	le: '≤',
	ordm: 'º',
	acute: '´',
	oslash: 'ø',
	Oslash: 'Ø',
	trade: '™',
	reg: '®',
	copy: '©',
	oelig: 'œ',
	OElig: 'Œ'
};

/** Lettres accentuées : `&eacute;` → é, `&Agrave;` → À… */
const ACCENTS: Record<string, string> = {
	acute: '́',
	grave: '̀',
	circ: '̂',
	uml: '̈',
	cedil: '̧',
	tilde: '̃'
};

function decodeEntity(name: string): string | null {
	if (name in ENTITIES) return ENTITIES[name];
	const numeric = /^#(x?)([0-9a-f]+)$/i.exec(name);
	if (numeric) return String.fromCodePoint(parseInt(numeric[2], numeric[1] ? 16 : 10));
	const accented = /^([a-z])(acute|grave|circ|uml|cedil|tilde)$/i.exec(name);
	if (accented) return (accented[1] + ACCENTS[accented[2]]).normalize('NFC');
	return null;
}

/**
 * Texte d'un champ Dolibarr, retours à la ligne gardés (lignes vides réduites).
 * En HTML, seules les balises font les retours ; un texte brut garde les siens.
 */
export function htmlLines(html: string | null): string {
	const source = html ?? '';
	const isHtml = /<(br|p|div|h\d|li)\b/i.test(source);
	return (isHtml ? source.replace(/\s+/g, ' ') : source)
		.replace(/<br\s*\/?>|<\/(p|div|h\d|li|tr)>/gi, '\n')
		.replace(/<[^>]+>/g, '')
		.replace(/&([#a-z0-9]+);/gi, (entity, name: string) => decodeEntity(name) ?? entity)
		.split(/\r?\n/)
		.map((line) => line.replace(/\s+/g, ' ').trim())
		.join('\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}

/** Désignation (200 caractères au plus) et détail d'une ligne Dolibarr. */
export function lineText(l: {
	label: string | null;
	product_label: string | null;
	description: string | null;
}): { label: string; description: string | null } {
	const detail = htmlLines(l.description);
	const label = htmlLines(l.label) || htmlLines(l.product_label);
	if (label)
		return { label: label.slice(0, 200), description: detail && detail !== label ? detail : null };
	const [first, ...rest] = detail.split('\n');
	return { label: first.slice(0, 200) || 'Ligne', description: rest.join('\n').trim() || null };
}
