/**
 * `sourceCursor` pagine 1 M de lignes sans `OFFSET`. Une erreur de curseur y est
 * silencieuse et coûteuse : elle ne plante pas, elle **perd des lignes** — c'est
 * exactement le type de défaut qui a produit les 81 % de produits orphelins que
 * ce chantier corrige.
 *
 * L'exécuteur de requête est injecté : ces tests rejouent la pagination contre
 * une table en mémoire, sans base ni tunnel SSH, et vérifient que le jeu rendu
 * est **exactement** le jeu de départ — sans perte ni doublon.
 */
import { describe, it, expect } from 'vitest';
import { sourceCursor } from './source-db.ts';

interface Row extends Record<string, unknown> {
	id: number;
	label: string;
}

/**
 * Faux exécuteur : rejoue la sémantique de
 * « WHERE … AND <clé> > N ORDER BY <clé> LIMIT n » sur une table en mémoire.
 * Compte aussi les appels, pour détecter une boucle qui n'avance pas.
 */
function fakeSource(table: Row[]) {
	const state = { calls: 0 };

	const fetchPage = async (sql: string): Promise<Row[]> => {
		if (++state.calls > 500) throw new Error('curseur bloqué : trop d’itérations');

		const after = /> (\d+)/.exec(sql);
		const limit = /LIMIT (\d+)/.exec(sql);
		const from = after ? Number(after[1]) : -Infinity;

		return table
			.filter((r) => r.id > from)
			.sort((a, b) => a.id - b.id)
			.slice(0, limit ? Number(limit[1]) : table.length);
	};

	return { fetchPage, state };
}

/** Draine le curseur en une liste plate. */
async function drain(
	table: Row[],
	keyColumn: string,
	pageSize: number,
	uniqueKey: boolean
): Promise<Row[]> {
	const { fetchPage } = fakeSource(table);
	const out: Row[] = [];

	for await (const page of sourceCursor<Row>(
		'SELECT id, label FROM t WHERE 1 = 1 {{WHERE}}',
		keyColumn,
		pageSize,
		uniqueKey,
		fetchPage
	)) {
		out.push(...page);
	}

	return out;
}

/** `n` lignes de clés distinctes : 1…n. */
function uniqueRows(n: number): Row[] {
	return Array.from({ length: n }, (_, i) => ({ id: i + 1, label: `l${i}` }));
}

describe('sourceCursor', () => {
	describe('clé unique', () => {
		it('rend toutes les lignes, une seule fois', async () => {
			const table = uniqueRows(250);

			const rows = await drain(table, 'id', 40, true);

			expect(rows.map((r) => r.id)).toEqual(table.map((r) => r.id));
		});

		it('gère un total multiple exact de la taille de page', async () => {
			const rows = await drain(uniqueRows(100), 'id', 25, true);

			expect(rows).toHaveLength(100);
		});

		it('accepte une colonne qualifiée, absente telle quelle du résultat', async () => {
			// MySQL renvoie « id », pas « p.id » : le curseur doit déqualifier la
			// clé pour relire sa valeur dans la ligne, sinon il boucle sur undefined.
			const rows = await drain(uniqueRows(30), 'p.id', 10, true);

			expect(rows).toHaveLength(30);
		});
	});

	describe('clé non unique', () => {
		/** `groups` produits × `per` liaisons chacun. */
		function grouped(groups: number, per: number): Row[] {
			const rows: Row[] = [];
			for (let id = 1; id <= groups; id++) {
				for (let k = 0; k < per; k++) rows.push({ id, label: `${id}-${k}` });
			}
			return rows;
		}

		it("ne perd aucune ligne d'un groupe à cheval sur deux pages", async () => {
			// 5 produits × 7 liaisons, pages de 10 : les groupes tombent en travers.
			const rows = await drain(grouped(5, 7), 'id', 10, false);

			expect(rows).toHaveLength(35);
			expect(new Set(rows.map((r) => r.label)).size).toBe(35);
		});

		it('avance même quand un groupe dépasse la taille de page', async () => {
			// 25 liaisons pour un seul produit, pages de 10 : sans traitement
			// dédié, le curseur ne pourrait jamais couper et boucrait à l'infini.
			const table: Row[] = Array.from({ length: 25 }, (_, k) => ({ id: 1, label: `a${k}` }));
			table.push({ id: 2, label: 'b' });

			const rows = await drain(table, 'id', 10, false);

			expect(rows.filter((r) => r.id === 2)).toHaveLength(1);
		});

		it('ne duplique pas les lignes rendues', async () => {
			const rows = await drain(grouped(12, 3), 'id', 7, false);

			expect(new Set(rows.map((r) => r.label)).size).toBe(rows.length);
			expect(rows).toHaveLength(36);
		});
	});

	it('signale une colonne de curseur absente du résultat', async () => {
		// Sans ce garde-fou, une clé introuvable donne `undefined` et le curseur
		// relit indéfiniment la même page.
		await expect(drain(uniqueRows(20), 'absent', 10, true)).rejects.toThrow(/colonne de curseur/);
	});
});
