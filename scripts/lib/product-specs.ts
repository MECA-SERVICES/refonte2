/**
 * Extraction des caractéristiques techniques depuis les descriptions HTML.
 *
 * Les descriptions reprises de PrestaShop contiennent, pour une grande part du
 * catalogue, un tableau HTML de couples « libellé / valeur » :
 *
 *     <tr><td><b>Diamètre intérieur</b></td><td>21,5 mm</td></tr>
 *
 * Ce module transforme ces tableaux en données exploitables, pour permettre le
 * filtrage du catalogue. Il est isolé du script d'import afin d'être testable
 * indépendamment de la base.
 */

/** Une caractéristique extraite d'une description. */
export type ProductSpec = {
	/** Libellé normalisé, tel qu'il servira de clé de regroupement. */
	name: string;
	/** Valeur affichée, nettoyée de son HTML. */
	value: string;
	/** Valeur numérique lorsqu'elle a pu être isolée — permet les plages. */
	valueNum: number | null;
	/** Unité accompagnant la valeur numérique (« mm », « kg », « V »…). */
	unit: string | null;
};

/**
 * Proportion minimale de lignes à deux cellules pour qu'un tableau soit
 * considéré comme un tableau de caractéristiques.
 *
 * Le catalogue contient aussi des tableaux de compatibilité — des dizaines de
 * références machine réparties sur quinze colonnes. Les traiter comme des
 * couples produirait des milliers de fausses caractéristiques.
 */
const PAIR_RATIO = 0.8;

/** Au-delà, la valeur est un paragraphe : ce n'est plus une caractéristique. */
const MAX_VALUE_LENGTH = 120;

/** Libellés génériques qui n'apportent rien comme critère de filtrage. */
const IGNORED_NAMES = new Set([
	'description détaillée',
	'informations complémentaires',
	'informations techniques',
	'caractéristiques',
	// Paragraphes descriptifs, parfois des tableaux JS mal convertis (« [] »,
	// « ['- Type de construction…'] ») : jamais des critères de filtrage.
	'avantages',
	'particularités',
	'points forts',
	'technical item description',
	"domaine d'application",
	'se compose de',
	'contenu de la livraison',
	'remarque',
	'remarques',
	'note',
	'notes',
	// Libellés logistiques omniprésents dans `short_description` : ils ne
	// discriminent rien (« Vendu à/au » : 19 valeurs pour 202 447 produits) ou
	// sont déjà affichés sur la fiche (« Référence »).
	'vendu à/au',
	'référence',
	'conditionnement',
	'arrondir les quantités',
	'quantité par emballage',
	"description de l'article",
	'code gtin',
	'ean',
	'gencod'
]);

/**
 * Libellés équivalents à regrouper sous une même clé.
 *
 * Les fiches machines emploient des variantes typographiques (« LARGEUR COUPE »
 * / « LARGEUR DE COUPE », « Ø COUPE ») qui, laissées telles quelles, éclatent
 * une même caractéristique en plusieurs facettes de quelques produits chacune —
 * sous le seuil d'affichage, donc invisibles.
 */
const NAME_ALIASES = new Map([
	['largeur coupe', 'Largeur de coupe'],
	['ø coupe', 'Largeur de coupe'],
	['diamètre de coupe', 'Largeur de coupe'],
	['largeur de travail', 'Largeur de travail'],
	['longueur de coupe', 'Longueur de coupe'],
	['poids à vide', 'Poids'],
	['poids brut de l\'article', 'Poids'],
	['cylindree', 'Cylindrée'],
	['puissance moteur', 'Puissance'],
	['tension batterie', 'Tension'],
	['capacité réservoir', 'Réservoir'],
	['contenance du réservoir', 'Réservoir']
]);

/**
 * Rétablit une casse lisible pour les libellés écrits tout en majuscules.
 *
 * Les fiches machines arrivent en capitales (« LARGEUR DE COUPE »). Conservées
 * telles quelles, elles créeraient un doublon de facette face au même libellé
 * en minuscules issu d'un autre fournisseur, en plus d'être criardes à
 * l'affichage. Les sigles courts (« RPM », « CC ») restent intacts.
 */
function fixCase(name: string): string {
	if (name !== name.toUpperCase() || !/[A-ZÀ-Ý]/.test(name)) return name;
	if (name.length <= 4) return name;
	return name
		.toLocaleLowerCase('fr')
		.replace(/^(.)/, (c) => c.toLocaleUpperCase('fr'));
}

/** Retire les balises et normalise les espaces d'un fragment HTML. */
function stripHtml(html: string): string {
	return html
		.replace(/<[^>]+>/g, ' ')
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#0?39;|&apos;/g, "'")
		.replace(/\s+/g, ' ')
		.trim();
}

/**
 * Normalise un libellé pour que les variantes se regroupent : casse, espaces,
 * apostrophes typographiques et deux-points finaux.
 */
export function normalizeName(raw: string): string {
	const cleaned = fixCase(
		stripHtml(raw)
			.replace(/[’‛]/g, "'")
			.replace(/\s*:\s*$/, '')
			.trim()
	);
	return NAME_ALIASES.get(cleaned.toLowerCase()) ?? cleaned;
}

/**
 * Isole la valeur numérique et son unité.
 *
 * Gère la virgule décimale française et les unités collées ou séparées. Une
 * valeur composite (« 6.3x32 ») n'est volontairement pas décomposée : elle
 * reste exploitable en filtre exact, pas en plage.
 */
export function parseNumeric(value: string): { num: number | null; unit: string | null } {
	const match = value.match(/^([<>~≈]?\s*)(-?\d+(?:[.,]\d+)?)\s*([^\d\s].*)?$/);
	if (!match) return { num: null, unit: null };

	const num = Number(match[2].replace(',', '.'));
	if (!Number.isFinite(num)) return { num: null, unit: null };

	const unit = match[3]?.trim() ?? '';
	// Une « unité » trop longue trahit un texte libre commençant par un chiffre.
	if (unit.length > 12) return { num: null, unit: null };

	// Au-delà, ce n'est plus une grandeur mais une référence constructeur
	// (« 42057062903 ») : la comparer numériquement n'aurait aucun sens, et la
	// colonne `numeric(14,4)` déborderait. Elle reste filtrable en valeur exacte.
	if (Math.abs(num) >= 1e9) return { num: null, unit: null };

	return { num, unit: unit || null };
}


/**
 * Nombre minimal de couples pour qu'un texte soit tenu pour une fiche technique.
 *
 * Une phrase rédigée contient parfois un « mot : valeur » isolé (« Garantie : 3
 * ans »). Exiger plusieurs couples évite de prendre une prose commerciale pour
 * un tableau de caractéristiques.
 */
const MIN_TEXT_PAIRS = 3;

/** Un libellé de caractéristique est court : au-delà, c'est une phrase. */
const MAX_NAME_WORDS = 5;

/**
 * Extrait les couples d'un texte dépourvu de tableau.
 *
 * Une partie des fiches machines (Etesia, Anova…) énumère les caractéristiques
 * en paragraphes séparés par des `<br>`, sans la moindre balise de tableau :
 *
 *     <p>Cylindrée : 389 cc<br />Largeur de coupe : 80 cm<br />Poids : 230 kg</p>
 *
 * Ces fiches sont invisibles pour l'analyse des tableaux, alors qu'elles portent
 * précisément les critères sur lesquels un client choisit une machine.
 */
function extractTextPairs(html: string): { name: string; value: string }[] {
	const text = html
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<\/(p|li|div|tr|h[1-6])>/gi, '\n')
		.replace(/<[^>]+>/g, ' ')
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&quot;/g, '"')
		.replace(/&#0?39;|&apos;/g, "'");

	const pairs: { name: string; value: string }[] = [];

	for (const line of text.split('\n')) {
		// On coupe au premier « : » seulement : la valeur peut elle-même en
		// contenir un (« Hauteur de coupe : Réglage 6 positions : 44-102 mm »).
		const at = line.indexOf(':');
		if (at < 1) continue;

		const name = normalizeName(line.slice(0, at));
		const value = line
			.slice(at + 1)
			.replace(/\s+/g, ' ')
			.trim();

		if (!name || !value) continue;
		// Un libellé long est en réalité une phrase se terminant par « : ».
		if (name.split(/\s+/).length > MAX_NAME_WORDS) continue;

		pairs.push({ name, value });
	}

	return pairs.length >= MIN_TEXT_PAIRS ? pairs : [];
}

/**
 * Extrait les caractéristiques d'une description HTML.
 * Retourne un tableau vide si aucune structure exploitable n'est reconnue.
 */
export function extractSpecs(...sources: (string | null)[]): ProductSpec[] {
	// Les tableaux se répartissent sur deux champs : `description` pour les
	// machines reprises de PrestaShop, `short_description` pour les flux
	// fournisseurs (l'essentiel du catalogue). On lit les deux, le premier
	// renseigné faisant foi en cas de libellé identique.
	const present = sources.filter((s): s is string => Boolean(s));
	if (present.length === 0) return [];

	const html = present.filter((s) => s.includes('<tr')).join('\n');

	const specs: ProductSpec[] = [];
	const seen = new Set<string>();

	const push = (rawName: string, rawValue: string) => {
		const name = normalizeName(rawName);
		const value = rawValue.trim();

		if (!name || !value) return;
		if (value.length > MAX_VALUE_LENGTH) return;
		if (IGNORED_NAMES.has(name.toLowerCase())) return;

		// Une même caractéristique peut apparaître deux fois : on garde la première.
		const key = name.toLowerCase();
		if (seen.has(key)) return;
		seen.add(key);

		const { num, unit } = parseNumeric(value);
		specs.push({ name, value, valueNum: num, unit });
	};

	for (const table of html.match(/<table[\s\S]*?<\/table>/gi) ?? []) {
		const rows = table.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
		if (rows.length === 0) continue;

		// Un tableau de compatibilité aligne beaucoup de cellules par ligne :
		// on ne garde que les tableaux majoritairement en couples.
		const pairRows = rows.filter((row) => (row.match(/<t[dh]/gi) ?? []).length === 2);
		if (pairRows.length / rows.length < PAIR_RATIO) continue;

		for (const row of pairRows) {
			const cells = [...row.matchAll(/<t[dh][\s\S]*?>([\s\S]*?)<\/t[dh]>/gi)].map((m) =>
				stripHtml(m[1])
			);
			if (cells.length !== 2) continue;

			push(cells[0], cells[1]);
		}
	}

	// Repli : aucun tableau exploitable, mais le texte peut énumérer des
	// couples. Tenté en dernier recours seulement — un tableau reste toujours
	// plus fiable qu'une heuristique sur du texte libre.
	if (specs.length === 0) {
		for (const pair of extractTextPairs(present.join('\n'))) push(pair.name, pair.value);
	}

	return specs;
}
