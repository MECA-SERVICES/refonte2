/**
 * Indicateurs de pilotage — CDC section 42.
 *
 * Aucune table dédiée : tout est calculé à la demande sur les données déjà
 * présentes. Seules les commandes ayant atteint un état marqué payé entrent
 * dans le chiffre d'affaires (R2).
 */

import { sql } from 'drizzle-orm';
import { db } from './db';

/** Période d'observation, exprimée en jours. */
export type StatsPeriod = 7 | 30 | 90 | 365;

export type Kpi = {
	/** Valeur sur la période. */
	value: number;
	/** Même durée, juste avant : sert la comparaison (R3). */
	previous: number;
	/** Variation en pourcentage ; `null` quand la base de comparaison est nulle. */
	change: number | null;
};

function toKpi(value: number, previous: number): Kpi {
	return {
		value,
		previous,
		// Comparer à zéro ne produit pas un pourcentage exploitable : mieux vaut
		// ne rien afficher qu'une croissance infinie.
		change: previous > 0 ? ((value - previous) / previous) * 100 : null
	};
}

/**
 * Indicateurs principaux, comparés à la période précédente.
 *
 * Une seule requête par indicateur, chacune agrégeant les deux périodes : deux
 * requêtes séparées doubleraient les allers-retours pour le même résultat.
 */
export async function headlineStats(days: StatsPeriod) {
	const [row] = await db.execute<{
		revenue: string;
		revenue_prev: string;
		orders: number;
		orders_prev: number;
		customers: number;
		customers_prev: number;
	}>(sql`
		WITH bornes AS (
			SELECT
				now() - ${`${days} days`}::interval AS debut,
				now() - ${`${days * 2} days`}::interval AS debut_prec
		)
		SELECT
			coalesce(sum(o.total_ttc) FILTER (WHERE o.created_at >= b.debut), 0)::text AS revenue,
			coalesce(sum(o.total_ttc) FILTER (
				WHERE o.created_at >= b.debut_prec AND o.created_at < b.debut
			), 0)::text AS revenue_prev,
			count(*) FILTER (WHERE o.created_at >= b.debut)::int AS orders,
			count(*) FILTER (
				WHERE o.created_at >= b.debut_prec AND o.created_at < b.debut
			)::int AS orders_prev,
			count(DISTINCT o.customer_id) FILTER (WHERE o.created_at >= b.debut)::int AS customers,
			count(DISTINCT o.customer_id) FILTER (
				WHERE o.created_at >= b.debut_prec AND o.created_at < b.debut
			)::int AS customers_prev
		FROM "order" o
		JOIN order_state s ON s.id = o.state_id
		CROSS JOIN bornes b
		WHERE s.is_paid AND o.created_at >= b.debut_prec
	`);

	const revenue = Number(row?.revenue ?? 0);
	const revenuePrev = Number(row?.revenue_prev ?? 0);
	const orders = row?.orders ?? 0;
	const ordersPrev = row?.orders_prev ?? 0;

	return {
		revenue: toKpi(revenue, revenuePrev),
		orders: toKpi(orders, ordersPrev),
		customers: toKpi(row?.customers ?? 0, row?.customers_prev ?? 0),
		// Le panier moyen se déduit des deux précédents plutôt que d'être
		// recalculé : c'est le même résultat pour une requête de moins.
		averageCart: toKpi(
			orders > 0 ? revenue / orders : 0,
			ordersPrev > 0 ? revenuePrev / ordersPrev : 0
		)
	};
}

/**
 * Chiffre d'affaires jour par jour.
 *
 * `generate_series` produit la série complète : sans elle, les journées sans
 * vente disparaîtraient et la courbe se déformerait.
 */
export async function revenueByDay(days: StatsPeriod) {
	const rows = await db.execute<{ jour: string; total: string; commandes: number }>(sql`
		SELECT
			d.jour::date::text AS jour,
			coalesce(sum(o.total_ttc), 0)::text AS total,
			count(o.id)::int AS commandes
		FROM generate_series(
			date_trunc('day', now() - ${`${days - 1} days`}::interval),
			date_trunc('day', now()),
			'1 day'
		) AS d(jour)
		LEFT JOIN "order" o
			ON date_trunc('day', o.created_at) = d.jour
			AND EXISTS (SELECT 1 FROM order_state s WHERE s.id = o.state_id AND s.is_paid)
		GROUP BY d.jour
		ORDER BY d.jour
	`);

	return rows.map((r) => ({
		day: r.jour,
		revenue: Number(r.total),
		orders: r.commandes
	}));
}

/** Meilleures ventes sur la période, en quantité et en valeur. */
export async function topProducts(days: StatsPeriod, limit = 8) {
	const rows = await db.execute<{
		product_id: number | null;
		nom: string;
		quantite: number;
		total: string;
	}>(sql`
		SELECT
			l.product_id,
			l.product_name AS nom,
			sum(l.quantity)::int AS quantite,
			sum(l.total_ttc)::text AS total
		FROM order_line l
		JOIN "order" o ON o.id = l.order_id
		JOIN order_state s ON s.id = o.state_id
		WHERE s.is_paid AND o.created_at >= now() - ${`${days} days`}::interval
		GROUP BY l.product_id, l.product_name
		ORDER BY sum(l.total_ttc) DESC
		LIMIT ${limit}
	`);

	return rows.map((r) => ({
		productId: r.product_id,
		name: r.nom,
		quantity: r.quantite,
		revenue: Number(r.total)
	}));
}

/** Répartition des commandes par état, sur la période. */
export async function ordersByState(days: StatsPeriod) {
	const rows = await db.execute<{ libelle: string; couleur: string | null; total: number }>(sql`
		SELECT s.label AS libelle, s.color AS couleur, count(*)::int AS total
		FROM "order" o
		JOIN order_state s ON s.id = o.state_id
		WHERE o.created_at >= now() - ${`${days} days`}::interval
		GROUP BY s.label, s.color
		ORDER BY count(*) DESC
		LIMIT 8
	`);

	return rows.map((r) => ({ label: r.libelle, color: r.couleur, total: r.total }));
}

/**
 * Marge dégagée sur la période.
 *
 * Le prix d'achat vient du catalogue courant : il n'est pas figé sur la ligne
 * de commande, la valeur est donc indicative (voir CDC 20).
 */
export async function marginStats(days: StatsPeriod) {
	const [row] = await db.execute<{ ca_ht: string; cout: string; lignes: number }>(sql`
		SELECT
			coalesce(sum(l.total_ht), 0)::text AS ca_ht,
			coalesce(sum(p.purchase_price * l.quantity), 0)::text AS cout,
			count(*) FILTER (WHERE p.purchase_price IS NOT NULL)::int AS lignes
		FROM order_line l
		JOIN "order" o ON o.id = l.order_id
		JOIN order_state s ON s.id = o.state_id
		LEFT JOIN product p ON p.id = l.product_id
		WHERE s.is_paid AND o.created_at >= now() - ${`${days} days`}::interval
	`);

	const revenue = Number(row?.ca_ht ?? 0);
	const cost = Number(row?.cout ?? 0);

	return {
		revenueHt: revenue,
		cost,
		margin: revenue - cost,
		rate: revenue > 0 ? ((revenue - cost) / revenue) * 100 : null,
		/** Lignes dont le prix d'achat est connu : mesure la fiabilité du calcul. */
		coveredLines: row?.lignes ?? 0
	};
}
