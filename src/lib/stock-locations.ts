/**
 * Arborescence des emplacements de stock, reprise de Dolibarr (`llx_entrepot`) :
 * MAGASIN › PARTIE DROITE › ÉTAGÈRE 41. Sans accès base : fonctions pures,
 * partagées entre le serveur et ses tests.
 */

export type LocationNode = {
	id: number;
	name: string;
	parentId: number | null;
	position: number;
};

export type FlatLocation<T extends LocationNode> = T & {
	/** Profondeur dans l'arbre, 0 pour un emplacement racine. */
	depth: number;
	/** Chemin complet, ex. « MAGASIN PIECES DETACHEES › PARTIE DROITE › ETAGERE 41 ». */
	path: string;
	/** Parents, de la racine au parent direct. */
	ancestorIds: number[];
};

/**
 * Aplatit l'arbre dans l'ordre de lecture : chaque parent suivi de ses
 * enfants, triés par position puis par nom. Un emplacement dont le parent est
 * introuvable est traité comme une racine plutôt que perdu.
 */
export function flattenLocations<T extends LocationNode>(locations: T[]): FlatLocation<T>[] {
	const ids = new Set(locations.map((l) => l.id));
	const children = new Map<number | null, T[]>();
	for (const location of locations) {
		const parent =
			location.parentId !== null && ids.has(location.parentId) ? location.parentId : null;
		children.set(parent, [...(children.get(parent) ?? []), location]);
	}
	const byOrder = (a: T, b: T) => a.position - b.position || a.name.localeCompare(b.name, 'fr');

	const out: FlatLocation<T>[] = [];
	const visit = (parentId: number | null, prefix: string, ancestorIds: number[]) => {
		for (const location of (children.get(parentId) ?? []).sort(byOrder)) {
			const path = prefix ? `${prefix} › ${location.name}` : location.name;
			out.push({ ...location, depth: ancestorIds.length, path, ancestorIds });
			visit(location.id, path, [...ancestorIds, location.id]);
		}
	};
	visit(null, '', []);
	return out;
}

/** L'emplacement et tous ceux rangés dessous. */
export function subtreeIds(locations: FlatLocation<LocationNode>[], id: number): number[] {
	return locations.filter((l) => l.id === id || l.ancestorIds.includes(id)).map((l) => l.id);
}

/** Quantité de chaque emplacement, sous-emplacements compris. */
export function subtreeQuantities(
	locations: FlatLocation<LocationNode & { quantity: number }>[]
): Map<number, number> {
	const totals = new Map<number, number>();
	for (const l of locations) {
		for (const id of [l.id, ...l.ancestorIds]) totals.set(id, (totals.get(id) ?? 0) + l.quantity);
	}
	return totals;
}

/** Minuscules sans accents, pour comparer « Étagère » et « ETAGERE ». */
export function normalizeSearch(text: string): string {
	return text
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase();
}

/**
 * Pertinence d'un emplacement pour une recherche, ou null s'il ne correspond
 * pas. Le code saisi tel quel passe devant (« 4372 » : partie 4, étagère 43,
 * rangée 7, boîte 2, comme sur les étiquettes Dolibarr), puis le début de code,
 * puis les mots du chemin : « droite 43 r7 » trouve « … PARTIE DROITE ›
 * ETAGERE 43 › RANGEE 7 », « r7 » se lisant « rangée 7 ».
 */
export function locationScore(
	query: string,
	location: { path: string; code: string | null }
): number | null {
	const words = normalizeSearch(query).split(/\s+/).filter(Boolean);
	if (!words.length) return 2;
	const code = normalizeSearch(location.code ?? '');
	if (words.length === 1 && code) {
		if (code === words[0]) return 0;
		if (code.startsWith(words[0])) return 1;
	}
	const path = normalizeSearch(location.path);
	return words.every((w) => path.includes(w) || abbreviationMatch(w, path)) ? 2 : null;
}

/** « r7 » : un mot qui commence par « r » suivi du nombre 7. */
function abbreviationMatch(word: string, path: string): boolean {
	const m = /^([a-z]+)(\d+)$/.exec(word);
	return m !== null && new RegExp(`\\b${m[1]}[a-z]*\\s*${m[2]}\\b`).test(path);
}

/**
 * Un produit rangé dans un emplacement : la ligne qu'on coche, qu'on
 * sélectionne et qu'on déplace.
 */
export type StoredRow = {
	productId: number;
	name: string;
	reference: string;
	ean13: string | null;
	isActive: boolean;
	brandName: string | null;
	imageUrl: string | null;
	/** Stock de la boutique (`product.stock`). */
	shopStock: number;
	purchasePrice: string | null;
	/** Toutes les quantités rangées du produit, emplacement par emplacement. */
	placements: { locationId: number; quantity: number }[];
	locationId: number;
	quantity: number;
};

/** Clé d'une ligne rangée : un produit dans un emplacement. */
export function placementKey(row: { productId: number; locationId: number }): string {
	return `${row.productId}:${row.locationId}`;
}

/**
 * Ce qui empêche de supprimer un emplacement, ou null s'il peut l'être. Une
 * suppression ne doit rien perdre : ni stock, ni sous-emplacement, ni
 * historique ; à défaut, on le désactive. Partagé par le serveur (qui
 * l'applique) et la page (qui l'explique avant le clic).
 */
export function deletionBlockerOf(location: {
	children: number;
	units: number;
	movements: number;
	legacyDoliId: number | null;
}): string | null {
	if (location.children) {
		return `Il contient ${location.children} sous-emplacement${location.children > 1 ? 's' : ''} : supprimez-les ou déplacez-les d'abord.`;
	}
	if (location.units) {
		return `Il contient encore ${location.units} unité${location.units > 1 ? 's' : ''} : déplacez les produits d'abord.`;
	}
	if (location.movements) {
		return 'Il a un historique de mouvements de stock : désactivez-le pour garder cet historique.';
	}
	// Tant que Dolibarr sert, une nouvelle reprise (`migrate:doli`) le recréerait.
	// Règle à retirer à l'arrêt de Dolibarr.
	if (location.legacyDoliId !== null) {
		return 'Il vient de Dolibarr, qui sert encore : désactivez-le, une nouvelle reprise le recréerait.';
	}
	return null;
}
