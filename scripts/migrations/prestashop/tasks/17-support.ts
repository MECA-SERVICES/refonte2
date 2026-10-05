/**
 * Reprise de l'historique du service client — CDC 27 §7 (R17-R21), CDC 04
 * (M12-M16).
 *
 *   ps_wk_hd_ticket / _msg / _attachment   (module wkhelpdesk, 2021 →)
 *   ps_customer_thread / ps_customer_message (SAV natif, 2015 →)
 *   ps_message                              (commentaires de commande)
 *        ──►  legacy_support_thread / _message / _attachment
 *
 * ────────────────────────────────────────────────────────────────────────────
 *  Décisions (phase 0, 2026-10-05)
 *
 *  - L'historique vit dans des tables à part, en lecture seule, mais
 *    s'affiche comme n'importe quelle conversation (vues `support_*_all`).
 *  - Toutes les conversations reprises sont closes ; les tickets marqués
 *    « spam » dans le helpdesk ne sont pas repris.
 *  - Les changements de statut du helpdesk sont conservés : ils disent quel
 *    agent a traité le ticket.
 *  - `ps_message` n'est pas une messagerie : les journaux du module de
 *    paiement sont écartés, les « Commande manuelle - Employé … » deviennent
 *    des notes internes, et les commentaires du client ne sont repris que
 *    s'ils ne figurent pas déjà dans un fil du SAV natif (PrestaShop les y
 *    recopie).
 *  - Les fichiers joints restent sur l'ancien serveur : seule leur trace
 *    (nom, chemin) est reprise, pour un transfert ultérieur.
 *  - Les noms des agents sont repris tels quels, doublons compris.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Rattachement : le client par `legacy_ps_id`, à défaut par son e-mail (R3) ;
 * la commande par `legacy_ps_id`. Sans correspondance, la conversation est
 * reprise sans rattachement (R20).
 *
 * Idempotente : une conversation est identifiée par `(source, legacy_ps_id)`,
 * un message par `(thread_id, legacy_ps_id)`. Relancer la tâche met à jour
 * les conversations et n'ajoute que les messages manquants.
 */
import type { Task } from '../../../lib/runner.ts';
import { sourceQuery } from '../source-db.ts';
import { targetDb } from '../../../lib/target-db.ts';
import { text, date } from '../../../lib/transform.ts';
import { log, count } from '../../../lib/logger.ts';

const WRITE_BATCH = 500;

/** Statuts du helpdesk (`ps_wk_hd_status_code`). */
const WK_STATUS: Record<number, string> = {
	1: 'open',
	2: 'closed',
	3: 'answered',
	4: 'pending',
	5: 'resolved',
	6: 'spam'
};
const WK_SPAM = 6;

/** Types de demande du helpdesk → code de `support_category`. */
const WK_CATEGORY: Record<number, string> = {
	1: 'sav',
	2: 'commercial',
	3: 'order_tracking',
	4: 'warranty',
	5: 'return',
	6: 'saved_cart'
};

/** Signature d'un journal technique du module de paiement dans `ps_message`. */
const PAYMENT_LOG = /^(Refused payment|The transaction was made|TPE:|Test of payment)/i;
const MANUAL_ORDER = /^Commande manuelle/i;

type Kind = 'customer' | 'staff' | 'internal_note' | 'status_change';

interface DraftMessage {
	legacyPsId: number;
	kind: Kind;
	authorName: string | null;
	content: string;
	statusFrom: string | null;
	statusTo: string | null;
	createdAt: Date;
	attachments: { fileName: string; legacyPath: string }[];
}

interface DraftThread {
	source: 'wkhelpdesk' | 'ps_thread' | 'ps_message';
	legacyPsId: number;
	reference: string;
	customerId: number | null;
	guestEmail: string | null;
	guestName: string | null;
	subject: string;
	categoryCode: string;
	legacyStatus: string | null;
	orderId: number | null;
	openedAt: Date;
	messages: DraftMessage[];
}

/** Nom affiché, sans espaces parasites ; `null` si vide. */
function fullName(first: unknown, last: unknown): string | null {
	return text([text(first), text(last)].filter(Boolean).join(' '));
}

/** Entités HTML courantes des anciens messages (accents saisis via l'éditeur). */
const ENTITIES: Record<string, string> = {
	amp: '&',
	lt: '<',
	gt: '>',
	quot: '"',
	apos: "'",
	nbsp: ' ',
	euro: '€',
	laquo: '«',
	raquo: '»',
	rsquo: '’',
	lsquo: '‘',
	hellip: '…',
	deg: '°'
};

/** Décode les entités HTML d'un texte destiné à un champ brut (objet). */
function decodeEntities(input: string): string {
	return input.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (full, code: string) => {
		if (code[0] === '#') {
			const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : Number(code.slice(1));
			return Number.isFinite(n) ? String.fromCodePoint(n) : full;
		}
		const named = ENTITIES[code.toLowerCase()];
		if (named) return named;
		// Lettres accentuées : `&eacute;`, `&agrave;`, `&ccedil;`…
		const accent = /^([a-z])(acute|grave|circ|uml|cedil|tilde)$/i.exec(code);
		if (accent) {
			const marks = {
				acute: '\u0301',
				grave: '\u0300',
				circ: '\u0302',
				uml: '\u0308',
				cedil: '\u0327',
				tilde: '\u0303'
			} as const;
			return (accent[1] + marks[accent[2].toLowerCase() as keyof typeof marks]).normalize('NFC');
		}
		return full;
	});
}

/** Objet tiré du premier message, pour les fils du SAV natif qui n'en ont pas. */
function subjectFrom(content: string): string {
	const plain = decodeEntities(content.replace(/<[^>]+>/g, ' '))
		.replace(/\s+/g, ' ')
		.trim();
	if (!plain) return 'Message';
	return plain.length > 80 ? `${plain.slice(0, 77)}…` : plain;
}

// ---------------------------------------------------------------------------
// Correspondances côté cible
// ---------------------------------------------------------------------------

interface Lookups {
	customerByLegacy: Map<number, number>;
	/** E-mail → client, seulement quand l'adresse désigne un client unique. */
	customerByEmail: Map<string, number>;
	customerName: Map<number, string>;
	orderByLegacy: Map<number, { id: number; reference: string }>;
	categoryByCode: Map<string, number>;
}

async function loadLookups(): Promise<Lookups> {
	const sql = targetDb();

	const customers = await sql<
		{
			id: number;
			legacy_ps_id: number | null;
			email: string;
			first_name: string;
			last_name: string;
		}[]
	>`SELECT id, legacy_ps_id, lower(email) AS email, first_name, last_name FROM customer`;

	const customerByLegacy = new Map<number, number>();
	const customerName = new Map<number, string>();
	const emailCount = new Map<string, number>();
	const emailOwner = new Map<string, number>();
	for (const c of customers) {
		if (c.legacy_ps_id) customerByLegacy.set(Number(c.legacy_ps_id), c.id);
		customerName.set(c.id, fullName(c.first_name, c.last_name) ?? '');
		if (c.email) {
			emailCount.set(c.email, (emailCount.get(c.email) ?? 0) + 1);
			emailOwner.set(c.email, c.id);
		}
	}
	const customerByEmail = new Map([...emailOwner].filter(([email]) => emailCount.get(email) === 1));

	const orders = await sql<{ id: number; legacy_ps_id: number; reference: string }[]>`
		SELECT id, legacy_ps_id, reference FROM "order" WHERE legacy_ps_id IS NOT NULL`;
	const orderByLegacy = new Map(
		orders.map((o) => [Number(o.legacy_ps_id), { id: o.id, reference: o.reference }])
	);

	const categories = await sql<{ id: number; code: string }[]>`
		SELECT id, code FROM support_category`;
	const categoryByCode = new Map(categories.map((c) => [c.code, c.id]));

	return { customerByLegacy, customerByEmail, customerName, orderByLegacy, categoryByCode };
}

/** Client rattaché : par identifiant PrestaShop, sinon par e-mail (R3). */
function resolveCustomer(lk: Lookups, psCustomerId: unknown, email: unknown): number | null {
	const byId = Number(psCustomerId) > 0 ? lk.customerByLegacy.get(Number(psCustomerId)) : undefined;
	if (byId) return byId;
	const mail = text(email)?.toLowerCase();
	return (mail && lk.customerByEmail.get(mail)) || null;
}

// ---------------------------------------------------------------------------
// Source 1 — module wkhelpdesk
// ---------------------------------------------------------------------------

async function draftWkHelpdesk(lk: Lookups, limit: number | null): Promise<DraftThread[]> {
	const tickets = await sourceQuery<{
		id: number;
		id_query_type: number;
		id_status: number;
		subject: string | null;
		id_order: number | null;
		date_add: Date;
		id_ps_customer: number | null;
		first_name: string | null;
		last_name: string | null;
		email: string | null;
	}>(
		`SELECT t.id, t.id_query_type, t.id_status, t.subject, t.id_order, t.date_add,
		        c.id_ps_customer, c.first_name, c.last_name, c.email
		   FROM ps_wk_hd_ticket t
		   LEFT JOIN ps_wk_hd_customer c ON c.id = t.hd_id_customer
		  WHERE t.id_status <> ${WK_SPAM}
		  ORDER BY t.id
		  ${limit ? `LIMIT ${limit}` : ''}`
	);
	if (tickets.length === 0) return [];
	const ids = tickets.map((t) => Number(t.id));

	// `id_agent` désigne une ligne de `ps_wk_hd_ticket_agent`, pas un employé.
	const agents = await sourceQuery<{ id: number; name: string | null }>(
		`SELECT id, name FROM ps_wk_hd_ticket_agent`
	);
	const agentName = new Map(agents.map((a) => [Number(a.id), text(a.name)]));

	const messages = await sourceQuery<{
		id: number;
		hd_id_ticket: number;
		message: string | null;
		id_customer: number;
		id_agent: number;
		is_internal_note: number;
		is_status_update: number;
		status_from: number;
		status_to: number;
		date_add: Date;
	}>(
		`SELECT id, hd_id_ticket, message, id_customer, id_agent, is_internal_note,
		        is_status_update, status_from, status_to, date_add
		   FROM ps_wk_hd_ticket_msg
		  WHERE hd_id_ticket IN (${ids.join(',')})
		  ORDER BY date_add, id`
	);

	const attachments = await sourceQuery<{ hd_id_msg: number; attachment_name: string }>(
		`SELECT a.hd_id_msg, a.attachment_name
		   FROM ps_wk_hd_ticket_attachment a
		   JOIN ps_wk_hd_ticket_msg m ON m.id = a.hd_id_msg
		  WHERE m.hd_id_ticket IN (${ids.join(',')})`
	);
	const filesByMsg = new Map<number, { fileName: string; legacyPath: string }[]>();
	for (const a of attachments) {
		const name = text(a.attachment_name);
		if (!name) continue;
		const list = filesByMsg.get(Number(a.hd_id_msg)) ?? [];
		list.push({ fileName: name, legacyPath: `modules/wkhelpdesk/ticketattachments/${name}` });
		filesByMsg.set(Number(a.hd_id_msg), list);
	}

	const byTicket = new Map<number, DraftMessage[]>();
	const customerOf = new Map(
		tickets.map((t) => [Number(t.id), fullName(t.first_name, t.last_name)])
	);

	for (const m of messages) {
		const ticketId = Number(m.hd_id_ticket);
		const isAgent = Number(m.id_agent) > 0;
		const agent = isAgent ? (agentName.get(Number(m.id_agent)) ?? null) : null;

		let kind: Kind;
		if (Number(m.is_status_update) === 1) kind = 'status_change';
		else if (Number(m.is_internal_note) === 1) kind = 'internal_note';
		else kind = isAgent ? 'staff' : 'customer';

		const list = byTicket.get(ticketId) ?? [];
		list.push({
			legacyPsId: Number(m.id),
			kind,
			authorName: isAgent ? agent : (customerOf.get(ticketId) ?? null),
			content: text(m.message) ?? '',
			statusFrom: kind === 'status_change' ? (WK_STATUS[Number(m.status_from)] ?? null) : null,
			statusTo: kind === 'status_change' ? (WK_STATUS[Number(m.status_to)] ?? null) : null,
			createdAt: date(m.date_add),
			attachments: filesByMsg.get(Number(m.id)) ?? []
		});
		byTicket.set(ticketId, list);
	}

	return tickets.map((t) => {
		const order = Number(t.id_order) > 0 ? lk.orderByLegacy.get(Number(t.id_order)) : undefined;
		const customerId = resolveCustomer(lk, t.id_ps_customer, t.email);
		return {
			source: 'wkhelpdesk' as const,
			legacyPsId: Number(t.id),
			// Numéro que le client a pu voir dans ses e-mails du helpdesk.
			reference: `#${t.id}`,
			customerId,
			guestEmail: text(t.email),
			guestName: fullName(t.first_name, t.last_name),
			subject: decodeEntities(text(t.subject) ?? 'Demande'),
			categoryCode: WK_CATEGORY[Number(t.id_query_type)] ?? 'other',
			legacyStatus: WK_STATUS[Number(t.id_status)] ?? null,
			orderId: order?.id ?? null,
			openedAt: date(t.date_add),
			messages: byTicket.get(Number(t.id)) ?? []
		};
	});
}

// ---------------------------------------------------------------------------
// Source 2 — SAV natif PrestaShop
// ---------------------------------------------------------------------------

async function draftNativeThreads(lk: Lookups, limit: number | null): Promise<DraftThread[]> {
	const threads = await sourceQuery<{
		id_customer_thread: number;
		id_customer: number | null;
		id_order: number | null;
		status: string;
		email: string | null;
		date_add: Date;
	}>(
		`SELECT id_customer_thread, id_customer, id_order, status, email, date_add
		   FROM ps_customer_thread
		  ORDER BY id_customer_thread
		  ${limit ? `LIMIT ${limit}` : ''}`
	);
	if (threads.length === 0) return [];
	const ids = threads.map((t) => Number(t.id_customer_thread));

	const employees = await sourceQuery<{ id_employee: number; firstname: string; lastname: string }>(
		`SELECT id_employee, firstname, lastname FROM ps_employee`
	);
	const employeeName = new Map(
		employees.map((e) => [Number(e.id_employee), fullName(e.firstname, e.lastname)])
	);

	const messages = await sourceQuery<{
		id_customer_message: number;
		id_customer_thread: number;
		id_employee: number | null;
		message: string | null;
		file_name: string | null;
		private: number;
		date_add: Date;
	}>(
		`SELECT id_customer_message, id_customer_thread, id_employee, message, file_name,
		        private, date_add
		   FROM ps_customer_message
		  WHERE id_customer_thread IN (${ids.join(',')})
		  ORDER BY date_add, id_customer_message`
	);

	const byThread = new Map<number, DraftMessage[]>();
	for (const m of messages) {
		const threadId = Number(m.id_customer_thread);
		const isStaff = Number(m.id_employee) > 0;
		const file = text(m.file_name);
		const list = byThread.get(threadId) ?? [];
		list.push({
			legacyPsId: Number(m.id_customer_message),
			kind: Number(m.private) === 1 ? 'internal_note' : isStaff ? 'staff' : 'customer',
			authorName: isStaff ? (employeeName.get(Number(m.id_employee)) ?? null) : null,
			content: text(m.message) ?? '',
			statusFrom: null,
			statusTo: null,
			createdAt: date(m.date_add),
			attachments: file ? [{ fileName: file, legacyPath: `upload/${file}` }] : []
		});
		byThread.set(threadId, list);
	}

	return threads.map((t) => {
		const id = Number(t.id_customer_thread);
		const order = Number(t.id_order) > 0 ? lk.orderByLegacy.get(Number(t.id_order)) : undefined;
		const customerId = resolveCustomer(lk, t.id_customer, t.email);
		const msgs = byThread.get(id) ?? [];
		// Le nom du client n'est pas porté par le fil : on le reprend de sa fiche.
		const customerName = customerId ? lk.customerName.get(customerId) || null : null;
		for (const m of msgs) if (m.kind === 'customer') m.authorName = customerName;

		const firstCustomer = msgs.find((m) => m.kind === 'customer') ?? msgs[0];
		return {
			source: 'ps_thread' as const,
			legacyPsId: id,
			reference: `#C${id}`,
			customerId,
			guestEmail: text(t.email),
			guestName: customerName,
			subject: order ? `Commande ${order.reference}` : subjectFrom(firstCustomer?.content ?? ''),
			categoryCode: order ? 'order_tracking' : 'other',
			legacyStatus: text(t.status),
			orderId: order?.id ?? null,
			openedAt: date(t.date_add),
			messages: msgs
		};
	});
}

// ---------------------------------------------------------------------------
// Source 3 — messages de commande (`ps_message`)
// ---------------------------------------------------------------------------

async function draftOrderMessages(
	lk: Lookups,
	limit: number | null
): Promise<{ threads: DraftThread[]; skippedLogs: number; skippedCopies: number }> {
	const rows = await sourceQuery<{
		id_message: number;
		id_order: number;
		id_customer: number;
		message: string | null;
		private: number;
		date_add: Date;
	}>(
		`SELECT id_message, id_order, id_customer, message, private, date_add
		   FROM ps_message
		  WHERE id_order > 0
		  ORDER BY id_order, date_add, id_message`
	);

	// Commentaires déjà recopiés par PrestaShop dans un fil du SAV natif de la
	// même commande : les reprendre ici les afficherait deux fois.
	const copies = await sourceQuery<{ id_order: number; message: string }>(
		`SELECT t.id_order, cm.message
		   FROM ps_customer_thread t
		   JOIN ps_customer_message cm ON cm.id_customer_thread = t.id_customer_thread
		  WHERE t.id_order > 0`
	);
	const copied = new Set(copies.map((c) => `${c.id_order}|${(c.message ?? '').trim()}`));

	let skippedLogs = 0;
	let skippedCopies = 0;
	const byOrder = new Map<number, { customer: number; messages: DraftMessage[] }>();

	for (const m of rows) {
		const content = text(m.message);
		if (!content) continue;
		if (PAYMENT_LOG.test(content)) {
			skippedLogs++;
			continue;
		}
		const orderId = Number(m.id_order);
		const manual = MANUAL_ORDER.test(content);
		if (!manual && copied.has(`${orderId}|${content}`)) {
			skippedCopies++;
			continue;
		}

		const entry = byOrder.get(orderId) ?? { customer: Number(m.id_customer), messages: [] };
		entry.messages.push({
			legacyPsId: Number(m.id_message),
			kind: manual || Number(m.private) === 1 ? 'internal_note' : 'customer',
			authorName: null,
			content,
			statusFrom: null,
			statusTo: null,
			createdAt: date(m.date_add),
			attachments: []
		});
		byOrder.set(orderId, entry);
	}

	let entries = [...byOrder];
	if (limit) entries = entries.slice(0, limit);

	const threads = entries.map(([psOrderId, entry]) => {
		const order = lk.orderByLegacy.get(psOrderId);
		const customerId = resolveCustomer(lk, entry.customer, null);
		const customerName = customerId ? lk.customerName.get(customerId) || null : null;
		for (const msg of entry.messages) if (msg.kind === 'customer') msg.authorName = customerName;
		return {
			source: 'ps_message' as const,
			legacyPsId: psOrderId,
			reference: `#O${psOrderId}`,
			customerId,
			guestEmail: null,
			guestName: customerName,
			subject: order ? `Commande ${order.reference}` : `Commande n°${psOrderId}`,
			categoryCode: 'order_tracking',
			legacyStatus: null,
			orderId: order?.id ?? null,
			openedAt: entry.messages[0].createdAt,
			messages: entry.messages
		};
	});

	return { threads, skippedLogs, skippedCopies };
}

// ---------------------------------------------------------------------------
// Écriture
// ---------------------------------------------------------------------------

/** Ligne de conversation prête à l'insertion. */
function threadRow(t: DraftThread, lk: Lookups) {
	const visible = t.messages.filter((m) => m.kind !== 'status_change');
	const last = t.messages.at(-1)?.createdAt ?? t.openedAt;
	const lastAgent = [...t.messages].reverse().find((m) => m.kind === 'staff' && m.authorName);

	return {
		source: t.source,
		legacy_ps_id: t.legacyPsId,
		reference: t.reference,
		customer_id: t.customerId,
		guest_email: t.guestEmail,
		guest_name: t.guestName,
		subject: t.subject.slice(0, 255),
		category_id: lk.categoryByCode.get(t.categoryCode) ?? lk.categoryByCode.get('other') ?? null,
		legacy_status: t.legacyStatus,
		order_id: t.orderId,
		last_agent_name: lastAgent?.authorName ?? null,
		message_count: visible.length,
		opened_at: t.openedAt,
		last_message_at: last > t.openedAt ? last : t.openedAt
	};
}

async function writeThreads(threads: DraftThread[], lk: Lookups) {
	const sql = targetDb();
	let messages = 0;
	let files = 0;

	for (let i = 0; i < threads.length; i += WRITE_BATCH) {
		const batch = threads.slice(i, i + WRITE_BATCH);
		const rows = batch.map((t) => threadRow(t, lk));

		const saved = await sql<{ id: number; source: string; legacy_ps_id: number }[]>`
			INSERT INTO legacy_support_thread ${sql(rows)}
			ON CONFLICT (source, legacy_ps_id) DO UPDATE SET
				reference = EXCLUDED.reference,
				customer_id = EXCLUDED.customer_id,
				guest_email = EXCLUDED.guest_email,
				guest_name = EXCLUDED.guest_name,
				subject = EXCLUDED.subject,
				category_id = EXCLUDED.category_id,
				legacy_status = EXCLUDED.legacy_status,
				order_id = EXCLUDED.order_id,
				last_agent_name = EXCLUDED.last_agent_name,
				message_count = EXCLUDED.message_count,
				opened_at = EXCLUDED.opened_at,
				last_message_at = EXCLUDED.last_message_at
			RETURNING id, source, legacy_ps_id`;
		const idOf = new Map(saved.map((s) => [`${s.source}|${s.legacy_ps_id}`, s.id]));

		const msgRows: Record<string, unknown>[] = [];
		const filesOf = new Map<string, { fileName: string; legacyPath: string }[]>();
		for (const t of batch) {
			const threadId = idOf.get(`${t.source}|${t.legacyPsId}`);
			if (!threadId) continue;
			for (const m of t.messages) {
				msgRows.push({
					thread_id: threadId,
					kind: m.kind,
					author_name: m.authorName,
					content: m.content,
					status_from: m.statusFrom,
					status_to: m.statusTo,
					legacy_ps_id: m.legacyPsId,
					created_at: m.createdAt
				});
				if (m.attachments.length) filesOf.set(`${threadId}|${m.legacyPsId}`, m.attachments);
			}
		}

		for (let j = 0; j < msgRows.length; j += WRITE_BATCH * 2) {
			const chunk = msgRows.slice(j, j + WRITE_BATCH * 2);
			// Seuls les messages nouvellement insérés reviennent : leurs pièces
			// jointes ne sont donc enregistrées qu'une fois, même en relance.
			const inserted = await sql<{ id: number; thread_id: number; legacy_ps_id: number }[]>`
				INSERT INTO legacy_support_message ${sql(chunk)}
				ON CONFLICT (thread_id, legacy_ps_id) DO NOTHING
				RETURNING id, thread_id, legacy_ps_id`;
			messages += inserted.length;

			const fileRows = inserted.flatMap((row) =>
				(filesOf.get(`${row.thread_id}|${row.legacy_ps_id}`) ?? []).map((f) => ({
					message_id: row.id,
					file_name: f.fileName,
					legacy_path: f.legacyPath
				}))
			);
			if (fileRows.length) {
				await sql`INSERT INTO legacy_support_attachment ${sql(fileRows)}`;
				files += fileRows.length;
			}
		}
	}

	return { messages, files };
}

// ---------------------------------------------------------------------------
// Tâche
// ---------------------------------------------------------------------------

export const supportTask: Task = {
	name: 'support',
	description:
		'Historique du service client (wkhelpdesk, SAV natif, ps_message → legacy_support_*)',
	dependsOn: ['customers', 'orders'],

	async run({ dryRun, limit }) {
		log.step('Correspondances clients, commandes, catégories');
		const lk = await loadLookups();
		log.muted(
			`${count(lk.customerByLegacy.size)} clients repris, ${count(lk.orderByLegacy.size)} commandes, ${lk.categoryByCode.size} catégories`
		);
		if (lk.categoryByCode.size === 0) {
			throw new Error('Aucune catégorie : appliquer la migration 0036_service_client avant.');
		}

		log.step('Lecture du helpdesk (wkhelpdesk)');
		const wk = await draftWkHelpdesk(lk, limit);
		log.step('Lecture du SAV natif');
		const native = await draftNativeThreads(lk, limit);
		log.step('Lecture des messages de commande');
		const orders = await draftOrderMessages(lk, limit);

		const all = [...wk, ...native, ...orders.threads];
		const stats = (list: DraftThread[]) => {
			const msgs = list.flatMap((t) => t.messages);
			return {
				threads: list.length,
				linkedCustomer: list.filter((t) => t.customerId).length,
				linkedOrder: list.filter((t) => t.orderId).length,
				messages: msgs.length,
				byKind: msgs.reduce<Record<string, number>>((acc, m) => {
					acc[m.kind] = (acc[m.kind] ?? 0) + 1;
					return acc;
				}, {}),
				files: msgs.reduce((n, m) => n + m.attachments.length, 0),
				unnamedAgents: msgs.filter(
					(m) => (m.kind === 'staff' || m.kind === 'status_change') && !m.authorName
				).length
			};
		};

		for (const [label, list] of [
			['helpdesk', wk],
			['SAV natif', native],
			['commandes', orders.threads]
		] as const) {
			const s = stats(list);
			log.info(
				`${label.padEnd(10)} ${count(s.threads)} fils (client : ${count(s.linkedCustomer)}, commande : ${count(s.linkedOrder)}) · ${count(s.messages)} messages ${JSON.stringify(s.byKind)} · ${count(s.files)} fichiers · ${count(s.unnamedAgents)} sans nom d'agent`
			);
		}
		log.muted(
			`ps_message écartés : ${count(orders.skippedLogs)} journaux de paiement, ${count(orders.skippedCopies)} déjà dans le SAV natif`
		);

		if (dryRun) {
			log.warn(`Simulation : ${count(all.length)} conversations auraient été écrites.`);
			return { processed: 0, note: 'simulation' };
		}

		log.step('Écriture');
		const written = await writeThreads(all, lk);
		log.success(
			`${count(all.length)} conversations, ${count(written.messages)} messages ajoutés, ${count(written.files)} pièces jointes référencées.`
		);
		return { processed: all.length };
	}
};
