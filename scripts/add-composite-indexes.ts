/**
 * Ajoute des index composites pour optimiser les performances.
 * CONCURRENTLY pour éviter de bloquer la table pendant la création (1M+ produits).
 */

import postgres from 'postgres';

/** Erreur renvoyée par Postgres : le code SQLSTATE permet de distinguer les cas. */
function asPgError(err: unknown): { code?: string; message: string } {
	const e = err as { code?: unknown; message?: unknown };
	return {
		code: typeof e?.code === 'string' ? e.code : undefined,
		message: typeof e?.message === 'string' ? e.message : String(err)
	};
}

const sql = postgres(process.env.DATABASE_URL!, {
	max: 1,
	onnotice: () => {} // Ignorer les NOTICE
});

const indexes = [
	{
		name: 'product_active_created_idx',
		sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS "product_active_created_idx" ON "product" ("is_active", "created_at" DESC, "id" DESC)`,
		desc: 'Produits actifs triés par date (nouveautés)'
	},
	{
		name: 'product_active_price_idx',
		sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS "product_active_price_idx" ON "product" ("is_active", "price_ht")`,
		desc: 'Produits actifs triés par prix'
	},
	{
		name: 'product_active_category_idx',
		sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS "product_active_category_idx" ON "product" ("is_active", "category_id")`,
		desc: 'Produits actifs par catégorie'
	},
	{
		name: 'product_category_composite_idx',
		sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS "product_category_composite_idx" ON "product_category" ("category_id", "product_id")`,
		desc: 'Liaison catégories multiples'
	}
];

console.log('📊 Création des index composites...\n');

for (const idx of indexes) {
	console.log(`⏳ ${idx.desc} (${idx.name})...`);
	const start = Date.now();

	try {
		await sql.unsafe(idx.sql);
		const duration = ((Date.now() - start) / 1000).toFixed(1);
		console.log(`✓ ${idx.name} créé en ${duration}s\n`);
	} catch (err: unknown) {
		const pgError = asPgError(err);
		if (pgError.code === '42P07') {
			console.log(`  → Index déjà existant, skipped\n`);
		} else {
			console.error(`✗ Erreur: ${pgError.message}\n`);
			throw err;
		}
	}
}

console.log('✅ Tous les index ont été créés avec succès');

await sql.end();
