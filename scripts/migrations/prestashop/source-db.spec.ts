/**
 * Le garde-fou lecture seule de la source PrestaShop est la **règle non
 * négociable** du cahier des charges (§2.1) : la base `prod5` est la production
 * du client, et rien dans ce dépôt ne doit pouvoir y écrire.
 *
 * Ces tests verrouillent ce garde-fou. Ils ne dépendent d'aucune connexion :
 * `assertReadOnly` est volontairement exporté séparément pour rester testable.
 */
import { describe, it, expect } from 'vitest';
import { assertReadOnly } from './source-db.ts';

describe('assertReadOnly', () => {
	describe('refuse toute écriture', () => {
		const forbidden = [
			['DELETE', 'DELETE FROM ps_product'],
			['UPDATE', 'UPDATE ps_product SET active = 0'],
			['INSERT', 'INSERT INTO ps_product VALUES (1)'],
			['DROP', 'DROP TABLE ps_product'],
			['TRUNCATE', 'TRUNCATE ps_product'],
			['ALTER', 'ALTER TABLE ps_product ADD x int'],
			['CREATE', 'CREATE TABLE x (a int)'],
			['SET', 'SET autocommit = 0'],
			['LOCK', 'LOCK TABLES ps_product WRITE'],
			['GRANT', 'GRANT ALL ON prod5.* TO x'],
			['requêtes multiples', 'SELECT 1; DROP TABLE ps_product']
		] as const;

		for (const [label, sql] of forbidden) {
			it(`refuse ${label}`, () => {
				expect(() => assertReadOnly(sql)).toThrow(/REFUSÉ/);
			});
		}
	});

	describe("refuse l'écriture de fichier déguisée en SELECT", () => {
		// Ces requêtes commencent par SELECT et ne contiennent aucun mot-clé
		// d'écriture : elles écrivent pourtant un fichier sur le serveur source.
		const sneaky = [
			"SELECT 1 INTO OUTFILE '/tmp/x'",
			"SELECT * FROM ps_product INTO DUMPFILE '/tmp/y'",
			"SELECT 1 INTO   OUTFILE '/tmp/z'",
			"select/*commentaire*/ 1 into outfile '/tmp/a'"
		];

		for (const sql of sneaky) {
			it(`refuse ${sql.slice(0, 45)}`, () => {
				expect(() => assertReadOnly(sql)).toThrow(/REFUSÉ/);
			});
		}
	});

	describe('accepte la lecture', () => {
		const allowed = [
			'SELECT * FROM ps_product LIMIT 1',
			'SHOW COLUMNS FROM ps_product',
			'DESCRIBE ps_product',
			'EXPLAIN SELECT 1',
			'WITH t AS (SELECT 1 AS a) SELECT * FROM t',
			'SELECT COUNT(*) AS n FROM ps_image -- delete en commentaire'
		];

		for (const sql of allowed) {
			it(`accepte ${sql.slice(0, 45)}`, () => {
				expect(() => assertReadOnly(sql)).not.toThrow();
			});
		}

		it('ne confond pas un mot-clé dans un littéral avec une écriture', () => {
			// Un nom de produit contenant « DROP TABLE » ne doit pas bloquer la lecture.
			expect(() =>
				assertReadOnly("SELECT name FROM ps_product WHERE name = 'DROP TABLE x'")
			).not.toThrow();
		});
	});
});
