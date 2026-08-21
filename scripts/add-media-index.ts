/**
 * Ajoute un index composite pour optimiser la récupération d'images produits par catégorie.
 * Utilisé par getShopMenu() pour afficher les vignettes des catégories.
 */

import postgres from 'postgres';
import { config } from 'dotenv';

config({ path: '.env.local' });

if (!process.env.DATABASE_URL) {
	console.error('❌ DATABASE_URL non défini dans .env.local');
	process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, {
	max: 1,
	onnotice: () => {} // Ignorer les NOTICE
});

const index = {
	name: 'product_media_category_idx',
	sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS "product_media_category_idx"
		ON "product_media" ("type", "product_id", "position")`,
	desc: 'Images produits triées par position (menu catégories)'
};

console.log('📊 Création de l\'index pour les images de menu...\n');
console.log(`⏳ ${index.desc} (${index.name})...`);

const start = Date.now();

try {
	await sql.unsafe(index.sql);
	const duration = ((Date.now() - start) / 1000).toFixed(1);
	console.log(`✓ ${index.name} créé en ${duration}s\n`);
} catch (err: any) {
	if (err.code === '42P07') {
		console.log(`  → Index déjà existant, skipped\n`);
	} else {
		console.error(`✗ Erreur: ${err.message}\n`);
		throw err;
	}
}

console.log('✅ Index créé avec succès');

await sql.end();
