/**
 * Seed idempotent des états de commande (jeu unifié depuis PrestaShop).
 * Usage : DATABASE_URL=... bun run scripts/seed-order-states.ts
 */
import postgres from 'postgres';
import { ORDER_STATE_SEED } from '../src/lib/server/db/order.schema';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL manquant');

const sql = postgres(url, { ssl: 'require' });

let created = 0;
let updated = 0;

for (const s of ORDER_STATE_SEED) {
	const existing = await sql`SELECT id FROM order_state WHERE code = ${s.code}`;
	const values = {
		label: s.label,
		color: s.color,
		position: s.position,
		is_paid: 'isPaid' in s ? s.isPaid : false,
		is_shipped: 'isShipped' in s ? s.isShipped : false,
		is_final: 'isFinal' in s ? s.isFinal : false,
		send_email_on_change: 'sendEmailOnChange' in s ? s.sendEmailOnChange : false
	};

	if (existing.length) {
		await sql`UPDATE order_state SET ${sql(values)}, updated_at = now() WHERE code = ${s.code}`;
		updated++;
	} else {
		await sql`INSERT INTO order_state ${sql({ code: s.code, ...values })}`;
		created++;
	}
}

console.log(`États de commande : ${created} créés, ${updated} mis à jour.`);
await sql.end();
