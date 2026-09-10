import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { category, product } from '$lib/server/db/catalog.schema';
import { asc, sql } from 'drizzle-orm';

/** Nœud de l'arborescence, tel que consommé par la page. */
export type CategoryNode = {
	id: number;
	name: string;
	slug: string;
	parentId: number | null;
	position: number;
	isActive: boolean;
	/** Produits rattachés directement à cette catégorie. */
	productCount: number;
	children: CategoryNode[];
};

export const load: PageServerLoad = async () => {
	// L'arbre entier est chargé d'un bloc : 594 catégories tiennent largement en
	// mémoire, et le replier côté client évite un aller-retour par ouverture.
	const rows = await db
		.select({
			id: category.id,
			name: category.name,
			slug: category.slug,
			parentId: category.parentId,
			position: category.position,
			isActive: category.isActive,
			productCount: sql<number>`(
				SELECT count(*)::int FROM ${product} p WHERE p.category_id = ${category.id}
			)`
		})
		.from(category)
		.orderBy(asc(category.position), asc(category.name));

	// Construction en deux passes : les enfants peuvent précéder leur parent.
	const byId = new Map<number, CategoryNode>();
	for (const row of rows) byId.set(row.id, { ...row, children: [] });

	const roots: CategoryNode[] = [];
	for (const node of byId.values()) {
		const parent = node.parentId === null ? undefined : byId.get(node.parentId);
		// Un parent manquant ne doit pas faire disparaître la branche : elle
		// remonte à la racine plutôt que d'être silencieusement perdue.
		if (parent) parent.children.push(node);
		else roots.push(node);
	}

	return { roots, total: rows.length };
};
