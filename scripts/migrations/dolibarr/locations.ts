/**
 * Lecture de l'arborescence des emplacements Dolibarr (`llx_entrepot`).
 *
 * `lieu` porte le chemin complet, ex. « MAGASIN PIECES DETACHEES / PARTIE
 * DROITE / ETAGERE 44 / RANGEE 1 ». Il fait foi pour retrouver le parent :
 * dans `doli_bdd1`, 233 emplacements sur 375 ont un `fk_parent` qui contient
 * la **référence** du parent (« 44 ») au lieu de son identifiant — une saisie
 * du module sur mesure « UTILE ». `fk_parent` ne sert donc qu'en secours.
 */

export interface DoliLocation {
	rowid: number;
	ref: string | null;
	lieu: string | null;
	fk_parent: number | null;
}

/** Segments du chemin, nettoyés (« /. PARTIE GAUCHE » → « PARTIE GAUCHE »). */
export function locationSegments(lieu: string | null): string[] {
	return (lieu ?? '')
		.split('/')
		.map((s) =>
			s
				.replace(/^[\s.]+/, '')
				.replace(/\s+/g, ' ')
				.trim()
		)
		.filter(Boolean);
}

/**
 * Nom affiché : le dernier segment du chemin, le reste se lisant dans les
 * parents. Un emplacement sans parent garde son chemin complet : « PARTIE
 * DROITE » n'a pas de nœud « MAGASIN PIECES DETACHEES » au-dessus de lui dans
 * Dolibarr, et perdrait sinon son contexte.
 */
export function locationName(location: DoliLocation, hasParent: boolean): string {
	const segments = locationSegments(location.lieu);
	if (!segments.length) return location.ref?.trim() || `Emplacement ${location.rowid}`;
	return hasParent ? segments[segments.length - 1] : segments.join(' / ');
}

/** Description : le `lieu` de Dolibarr, segments nettoyés (« A /. B » → « A / B »). */
export function locationDescription(location: DoliLocation): string | null {
	const segments = locationSegments(location.lieu);
	return segments.length ? segments.join(' / ') : null;
}

/**
 * Parent de chaque emplacement (`rowid` → `rowid` du parent), retrouvé par le
 * chemin, puis par `fk_parent` s'il désigne bien un emplacement dont le chemin
 * est un préfixe. Sans parent fiable, l'emplacement reste une racine.
 */
export function resolveParents(locations: DoliLocation[]): Map<number, number> {
	const key = (segments: string[]) => segments.join('/').toUpperCase();
	const byPath = new Map<string, number>();
	const segmentsOf = new Map<number, string[]>();
	for (const l of locations) {
		const segments = locationSegments(l.lieu);
		segmentsOf.set(l.rowid, segments);
		if (segments.length) byPath.set(key(segments), l.rowid);
	}

	const parents = new Map<number, number>();
	for (const l of locations) {
		const segments = segmentsOf.get(l.rowid) ?? [];
		const byLieu = segments.length > 1 ? byPath.get(key(segments.slice(0, -1))) : undefined;
		if (byLieu !== undefined && byLieu !== l.rowid) {
			parents.set(l.rowid, byLieu);
			continue;
		}
		const declared = l.fk_parent ? segmentsOf.get(l.fk_parent) : undefined;
		const isPrefix =
			declared !== undefined &&
			declared.length < segments.length &&
			key(segments.slice(0, declared.length)) === key(declared);
		if (l.fk_parent && isPrefix) parents.set(l.rowid, l.fk_parent);
	}
	return parents;
}
