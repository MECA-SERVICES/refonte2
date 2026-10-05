/**
 * Service client — CDC section 27, côté back-office.
 *
 * Les lectures passent par les vues `support_thread_all` / `support_message_all`,
 * qui réunissent le système vivant et l'historique repris de PrestaShop : une
 * conversation s'affiche de la même façon quelle que soit son origine.
 *
 * Les écritures ne touchent que les tables `support_*`. Une conversation de
 * l'historique ne se rouvre pas : y répondre ouvre une nouvelle conversation
 * qui la prolonge (`continues_thread_id`), et le fil les enchaîne.
 *
 * Les e-mails (R14) ne partent pas encore : ils attendent l'intégration Brevo.
 */

import {
	and,
	asc,
	count,
	desc,
	eq,
	gt,
	ilike,
	inArray,
	isNull,
	or,
	sql,
	type SQL
} from 'drizzle-orm';
import { db } from './db';
import {
	customer,
	order,
	orderState,
	user,
	supportCategory,
	supportThread,
	supportMessage,
	supportThreadAll,
	supportMessageAll,
	supportAttachment,
	legacySupportAttachment,
	SUPPORT_PRIORITIES,
	SUPPORT_STATUSES,
	type SupportPriority,
	type SupportStatus
} from './db/schema';
import { pageBounds, paginated } from './listing';
import { formFields, type ParseResult } from './forms';
import { sanitizeHtml } from './sanitize';
import { TEAM_FALLBACK_NAME } from '$lib/support';

// ---------------------------------------------------------------------------
// Catégories
// ---------------------------------------------------------------------------

/** Catégories, avec le nombre de conversations qui les portent. */
export async function listSupportCategories({ activeOnly = false } = {}) {
	const usage = db
		.select({ categoryId: supportThreadAll.categoryId, n: count().as('n') })
		.from(supportThreadAll)
		.groupBy(supportThreadAll.categoryId)
		.as('usage');

	return db
		.select({
			id: supportCategory.id,
			code: supportCategory.code,
			label: supportCategory.label,
			position: supportCategory.position,
			isActive: supportCategory.isActive,
			threadCount: sql<number>`coalesce(${usage.n}, 0)::int`
		})
		.from(supportCategory)
		.leftJoin(usage, eq(usage.categoryId, supportCategory.id))
		.where(activeOnly ? eq(supportCategory.isActive, true) : undefined)
		.orderBy(asc(supportCategory.position), asc(supportCategory.label));
}

export async function getSupportCategory(id: number) {
	const [row] = await db.select().from(supportCategory).where(eq(supportCategory.id, id)).limit(1);
	return row;
}

type CategoryValues = { code: string; label: string; position: number; isActive: boolean };

/** Code dérivé du libellé quand il n'est pas saisi : minuscules, sans accents. */
function codeFrom(label: string) {
	return label
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '')
		.slice(0, 50);
}

export function parseSupportCategoryForm(form: FormData): ParseResult<CategoryValues> {
	const { str, int, bool } = formFields(form);
	const label = str('label');
	if (!label) return { ok: false, error: 'Le libellé est obligatoire.' };
	const code = codeFrom(str('code') ?? label);
	if (!code)
		return { ok: false, error: 'Le code doit contenir au moins une lettre ou un chiffre.' };
	return {
		ok: true,
		values: { code, label, position: int('position', 0), isActive: bool('isActive') }
	};
}

/** Vrai si le code est déjà pris par une autre catégorie. */
async function codeTaken(code: string, exceptId?: number) {
	const [row] = await db
		.select({ id: supportCategory.id })
		.from(supportCategory)
		.where(eq(supportCategory.code, code))
		.limit(1);
	return Boolean(row && row.id !== exceptId);
}

export async function createSupportCategory(values: CategoryValues) {
	if (await codeTaken(values.code)) return { ok: false as const, error: 'Ce code existe déjà.' };
	await db.insert(supportCategory).values(values);
	return { ok: true as const };
}

export async function updateSupportCategory(id: number, values: CategoryValues) {
	if (await codeTaken(values.code, id))
		return { ok: false as const, error: 'Ce code existe déjà.' };
	await db
		.update(supportCategory)
		.set({ ...values, updatedAt: new Date() })
		.where(eq(supportCategory.id, id));
	return { ok: true as const };
}

/**
 * Supprime une catégorie inutilisée. Une catégorie portée par au moins une
 * conversation se désactive à la place : la supprimer orphelinerait l'historique.
 */
export async function deleteSupportCategory(id: number) {
	const [{ n }] = await db
		.select({ n: count() })
		.from(supportThreadAll)
		.where(eq(supportThreadAll.categoryId, id));
	if (n > 0) {
		return {
			ok: false as const,
			error: `Catégorie utilisée par ${n} conversation${n > 1 ? 's' : ''} : désactivez-la plutôt.`
		};
	}
	await db.delete(supportCategory).where(eq(supportCategory.id, id));
	return { ok: true as const };
}

// ---------------------------------------------------------------------------
// Équipe
// ---------------------------------------------------------------------------

/** Membres de l'équipe à qui une conversation peut être assignée (R11). */
export async function listStaffUsers() {
	return db
		.select({ id: user.id, name: user.name })
		.from(user)
		.where(eq(user.role, 'admin'))
		.orderBy(asc(user.name));
}

// ---------------------------------------------------------------------------
// Liste
// ---------------------------------------------------------------------------

/** Onglets de la liste : « à traiter » regroupe ce qui attend l'équipe. */
export const SUPPORT_QUEUES = ['todo', 'waiting', 'closed', 'all'] as const;
export type SupportQueue = (typeof SUPPORT_QUEUES)[number];

const QUEUE_STATUSES: Record<SupportQueue, SupportStatus[] | null> = {
	todo: ['open', 'pending_staff'],
	waiting: ['pending_customer'],
	closed: ['closed'],
	all: null
};

export type SupportListParams = {
	queue?: SupportQueue;
	search?: string;
	categoryId?: number;
	priority?: SupportPriority;
	/** Identifiant d'un membre, ou `none` pour les conversations non assignées. */
	assigned?: string;
	customerId?: number;
	orderId?: number;
	sort?: string;
	dir?: 'asc' | 'desc';
	page?: number;
};

const SORTS = {
	lastMessageAt: supportThreadAll.lastMessageAt,
	createdAt: supportThreadAll.createdAt,
	reference: supportThreadAll.reference
} as const;

/** Conditions communes à la liste et aux compteurs d'onglets (hors onglet). */
function listConditions(params: SupportListParams): SQL[] {
	const conditions: SQL[] = [];

	const search = params.search?.trim();
	if (search) {
		const term = `%${search}%`;
		conditions.push(
			or(
				ilike(supportThreadAll.reference, term),
				ilike(supportThreadAll.subject, term),
				ilike(supportThreadAll.guestEmail, term),
				ilike(supportThreadAll.guestName, term),
				ilike(customer.email, term),
				ilike(sql`${customer.firstName} || ' ' || ${customer.lastName}`, term),
				ilike(order.reference, term)
			)!
		);
	}
	if (params.categoryId) conditions.push(eq(supportThreadAll.categoryId, params.categoryId));
	if (params.priority) conditions.push(eq(supportThreadAll.priority, params.priority));
	if (params.assigned === 'none') conditions.push(isNull(supportThreadAll.assignedUserId));
	else if (params.assigned) conditions.push(eq(supportThreadAll.assignedUserId, params.assigned));
	if (params.customerId) conditions.push(eq(supportThreadAll.customerId, params.customerId));
	if (params.orderId) conditions.push(eq(supportThreadAll.orderId, params.orderId));

	return conditions;
}

export async function listSupportThreads(params: SupportListParams = {}) {
	const { page, perPage, offset } = pageBounds({ page: params.page }, { defaultPerPage: 25 });
	const queue = params.queue ?? 'todo';
	const base = listConditions(params);
	const statuses = QUEUE_STATUSES[queue];
	const where = and(...base, statuses ? inArray(supportThreadAll.status, statuses) : undefined);

	const sortCol = SORTS[params.sort as keyof typeof SORTS] ?? supportThreadAll.lastMessageAt;
	const orderBy = params.dir === 'asc' ? asc(sortCol) : desc(sortCol);

	const from = () =>
		db
			.select({
				id: supportThreadAll.id,
				reference: supportThreadAll.reference,
				subject: supportThreadAll.subject,
				status: supportThreadAll.status,
				priority: supportThreadAll.priority,
				unreadByStaff: supportThreadAll.unreadByStaff,
				lastMessageAt: supportThreadAll.lastMessageAt,
				guestEmail: supportThreadAll.guestEmail,
				guestName: supportThreadAll.guestName,
				customerId: supportThreadAll.customerId,
				customerFirstName: customer.firstName,
				customerLastName: customer.lastName,
				customerEmail: customer.email,
				categoryLabel: supportCategory.label,
				orderReference: order.reference,
				assignedName: user.name
			})
			.from(supportThreadAll)
			.leftJoin(customer, eq(customer.id, supportThreadAll.customerId))
			.leftJoin(order, eq(order.id, supportThreadAll.orderId))
			.leftJoin(supportCategory, eq(supportCategory.id, supportThreadAll.categoryId))
			.leftJoin(user, eq(user.id, supportThreadAll.assignedUserId));

	const countFrom = (w: SQL | undefined) =>
		db
			.select({ n: count() })
			.from(supportThreadAll)
			.leftJoin(customer, eq(customer.id, supportThreadAll.customerId))
			.leftJoin(order, eq(order.id, supportThreadAll.orderId))
			.where(w);

	const [rows, [{ n: total }], queueCounts] = await Promise.all([
		from().where(where).orderBy(orderBy, desc(supportThreadAll.id)).limit(perPage).offset(offset),
		countFrom(where),
		// Compteurs d'onglets avec les mêmes filtres, pour savoir où chercher.
		Promise.all(
			SUPPORT_QUEUES.map(async (q) => {
				const s = QUEUE_STATUSES[q];
				const [{ n }] = await countFrom(
					and(...base, s ? inArray(supportThreadAll.status, s) : undefined)
				);
				return [q, n] as const;
			})
		)
	]);

	return {
		...paginated(rows, total, page, perPage),
		queue,
		queueCounts: Object.fromEntries(queueCounts) as Record<SupportQueue, number>
	};
}

/** Conversations « à traiter » non lues : pastille du menu. */
export async function countUnreadForStaff() {
	const [{ n }] = await db
		.select({ n: count() })
		.from(supportThread)
		.where(
			and(
				gt(supportThread.unreadByStaff, 0),
				inArray(supportThread.status, ['open', 'pending_staff'])
			)
		);
	return n;
}

/** Conversations d'une commande ou d'un client, pour les encarts du back-office. */
export async function listThreadsFor(
	filter: { orderId?: number; customerId?: number },
	limit = 10
) {
	const where = filter.orderId
		? eq(supportThreadAll.orderId, filter.orderId)
		: eq(supportThreadAll.customerId, filter.customerId ?? -1);

	const [rows, [{ n }]] = await Promise.all([
		db
			.select({
				id: supportThreadAll.id,
				reference: supportThreadAll.reference,
				subject: supportThreadAll.subject,
				status: supportThreadAll.status,
				lastMessageAt: supportThreadAll.lastMessageAt,
				unreadByStaff: supportThreadAll.unreadByStaff
			})
			.from(supportThreadAll)
			.where(where)
			.orderBy(desc(supportThreadAll.lastMessageAt))
			.limit(limit),
		db.select({ n: count() }).from(supportThreadAll).where(where)
	]);
	return { rows, total: n };
}

// ---------------------------------------------------------------------------
// Fil d'une conversation
// ---------------------------------------------------------------------------

/** Échappe un texte brut avant de le rendre en HTML (entités existantes préservées). */
function plainToHtml(content: string) {
	return content
		.replace(/&(?!#?\w+;)/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/\r?\n/g, '<br />');
}

/** Corps prêt pour `{@html}` : HTML assaini, ou texte brut échappé. */
function messageHtml(content: string) {
	return /<[a-z][\s\S]*>/i.test(content) ? (sanitizeHtml(content) ?? '') : plainToHtml(content);
}

export async function getSupportThread(id: number) {
	const [t] = await db.select().from(supportThreadAll).where(eq(supportThreadAll.id, id)).limit(1);
	if (!t) return undefined;

	const [[category], [assigned]] = await Promise.all([
		t.categoryId
			? db
					.select({ label: supportCategory.label })
					.from(supportCategory)
					.where(eq(supportCategory.id, t.categoryId))
					.limit(1)
			: Promise.resolve([]),
		t.assignedUserId
			? db.select({ name: user.name }).from(user).where(eq(user.id, t.assignedUserId)).limit(1)
			: Promise.resolve([])
	]);

	const [messages, cust, ord, followUps, legacyFiles] = await Promise.all([
		db
			.select({
				id: supportMessageAll.id,
				kind: supportMessageAll.kind,
				authorName: supportMessageAll.authorName,
				senderName: user.name,
				content: supportMessageAll.content,
				statusFrom: supportMessageAll.statusFrom,
				statusTo: supportMessageAll.statusTo,
				createdAt: supportMessageAll.createdAt
			})
			.from(supportMessageAll)
			.leftJoin(user, eq(user.id, supportMessageAll.senderUserId))
			.where(eq(supportMessageAll.threadId, id))
			.orderBy(asc(supportMessageAll.createdAt), asc(supportMessageAll.id)),
		t.customerId
			? db
					.select({
						id: customer.id,
						firstName: customer.firstName,
						lastName: customer.lastName,
						email: customer.email,
						phone: customer.phone,
						companyName: customer.companyName,
						type: customer.type
					})
					.from(customer)
					.where(eq(customer.id, t.customerId))
					.limit(1)
			: Promise.resolve([]),
		t.orderId
			? db
					.select({
						id: order.id,
						reference: order.reference,
						totalTtc: order.totalTtc,
						createdAt: order.createdAt,
						stateLabel: orderState.label,
						stateColor: orderState.color
					})
					.from(order)
					.leftJoin(orderState, eq(orderState.id, order.stateId))
					.where(eq(order.id, t.orderId))
					.limit(1)
			: Promise.resolve([]),
		// Conversations ouvertes pour prolonger celle-ci.
		db
			.select({ id: supportThread.id, reference: supportThread.reference })
			.from(supportThread)
			.where(eq(supportThread.continuesThreadId, id))
			.orderBy(asc(supportThread.createdAt)),
		db
			.select({
				messageId: legacySupportAttachment.messageId,
				fileName: legacySupportAttachment.fileName
			})
			.from(legacySupportAttachment)
			.where(
				inArray(
					legacySupportAttachment.messageId,
					db
						.select({ id: supportMessageAll.id })
						.from(supportMessageAll)
						.where(eq(supportMessageAll.threadId, id))
				)
			)
	]);

	const liveFiles = await db
		.select({ messageId: supportAttachment.messageId, fileName: supportAttachment.fileName })
		.from(supportAttachment)
		.where(inArray(supportAttachment.messageId, messages.map((m) => m.id).concat(-1)));

	const filesOf = new Map<number, string[]>();
	for (const f of [...legacyFiles, ...liveFiles]) {
		filesOf.set(f.messageId, [...(filesOf.get(f.messageId) ?? []), f.fileName]);
	}

	const previous = t.continuesThreadId
		? (
				await db
					.select({ id: supportThreadAll.id, reference: supportThreadAll.reference })
					.from(supportThreadAll)
					.where(eq(supportThreadAll.id, t.continuesThreadId))
					.limit(1)
			)[0]
		: undefined;

	return {
		...t,
		categoryLabel: category?.label ?? null,
		assignedName: assigned?.name ?? null,
		customer: cust[0] ?? null,
		order: ord[0] ?? null,
		previous: previous ?? null,
		followUps,
		messages: messages.map((m) => ({
			id: m.id,
			kind: m.kind,
			author:
				m.kind === 'customer'
					? m.authorName ||
						[cust[0]?.firstName, cust[0]?.lastName].filter(Boolean).join(' ') ||
						t.guestName ||
						t.guestEmail ||
						'Client'
					: m.senderName || m.authorName || TEAM_FALLBACK_NAME,
			html: messageHtml(m.content),
			statusFrom: m.statusFrom,
			statusTo: m.statusTo,
			createdAt: m.createdAt,
			files: filesOf.get(m.id) ?? []
		}))
	};
}

// ---------------------------------------------------------------------------
// Écritures
// ---------------------------------------------------------------------------

/**
 * Référence d'une nouvelle conversation, tirée de la séquence commune : unique
 * sans verrou, et lisible au téléphone (« SAV-2026-20871 »).
 */
async function nextThreadId() {
	const [{ id }] = await db.execute<{ id: number }>(
		sql`SELECT nextval('support_thread_id_seq')::int AS id`
	);
	return { id, reference: `SAV-${new Date().getFullYear()}-${id}` };
}

export class SupportError extends Error {}

/** Contenu d'un message : texte saisi, obligatoire. */
function messageContent(form: FormData) {
	const content = form.get('content')?.toString().trim() ?? '';
	if (!content) throw new SupportError('Le message est vide.');
	if (content.length > 20000) throw new SupportError('Le message est trop long.');
	return content;
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Ouvre la suite d'une conversation de l'historique, qui ne se rouvre pas :
 * mêmes demandeur, objet, catégorie et commande, reliée à l'originale.
 */
async function openContinuation(
	tx: Tx,
	current: typeof supportThreadAll.$inferSelect,
	status: SupportStatus
) {
	const { id, reference } = await nextThreadId();
	await tx.insert(supportThread).values({
		id,
		reference,
		customerId: current.customerId,
		guestEmail: current.guestEmail,
		guestName: current.guestName,
		subject: current.subject,
		categoryId: current.categoryId,
		orderId: current.orderId,
		continuesThreadId: current.id,
		status
	});
	return id;
}

/**
 * Réponse ou note interne de l'équipe.
 *
 * Dans une conversation de l'historique, la réponse ouvre une nouvelle
 * conversation qui la prolonge ; l'identifiant renvoyé est celui où le
 * message a été écrit.
 */
export async function postStaffMessage(threadId: number, form: FormData, userId: string) {
	const content = messageContent(form);
	const internal = form.get('internal') === '1';

	const [current] = await db
		.select()
		.from(supportThreadAll)
		.where(eq(supportThreadAll.id, threadId))
		.limit(1);
	if (!current) throw new SupportError('Conversation introuvable.');

	return db.transaction(async (tx) => {
		let target = threadId;

		if (current.isLegacy) {
			target = await openContinuation(tx, current, internal ? 'open' : 'pending_customer');
		}

		await tx.insert(supportMessage).values({
			threadId: target,
			senderType: internal ? 'internal_note' : 'staff',
			senderUserId: userId,
			content
		});

		// Une note interne ne change ni l'état ni les compteurs du client (R13).
		if (!internal) {
			await tx
				.update(supportThread)
				.set({
					status: 'pending_customer',
					unreadByCustomer: sql`${supportThread.unreadByCustomer} + 1`,
					unreadByStaff: 0,
					lastMessageAt: new Date(),
					closedAt: null,
					updatedAt: new Date()
				})
				.where(eq(supportThread.id, target));
		} else {
			await tx
				.update(supportThread)
				.set({ updatedAt: new Date() })
				.where(eq(supportThread.id, target));
		}

		return target;
	});
}

/** Catégorie, priorité et assignation ; sans effet sur une conversation de l'historique. */
export async function updateThreadMeta(threadId: number, form: FormData) {
	const { str, int } = formFields(form);
	const priority = str('priority') as SupportPriority | null;
	const categoryId = int('categoryId', 0) || null;
	const assigned = str('assignedUserId');

	await db
		.update(supportThread)
		.set({
			categoryId,
			priority: priority && SUPPORT_PRIORITIES.includes(priority) ? priority : 'normal',
			assignedUserId: assigned || null,
			updatedAt: new Date()
		})
		.where(eq(supportThread.id, threadId));
}

/** Clôture ou réouverture par l'équipe (R10). */
export async function setThreadStatus(threadId: number, status: SupportStatus) {
	if (!SUPPORT_STATUSES.includes(status)) throw new SupportError('État invalide.');
	await db
		.update(supportThread)
		.set({
			status,
			closedAt: status === 'closed' ? new Date() : null,
			updatedAt: new Date()
		})
		.where(eq(supportThread.id, threadId));
}

/** L'équipe a ouvert le fil : ses messages clients sont lus. */
export async function markReadByStaff(threadId: number) {
	await db.transaction(async (tx) => {
		const [t] = await tx
			.update(supportThread)
			.set({ unreadByStaff: 0 })
			.where(and(eq(supportThread.id, threadId), gt(supportThread.unreadByStaff, 0)))
			.returning({ id: supportThread.id });
		if (!t) return;
		await tx
			.update(supportMessage)
			.set({ readAt: new Date() })
			.where(
				and(
					eq(supportMessage.threadId, threadId),
					eq(supportMessage.senderType, 'customer'),
					isNull(supportMessage.readAt)
				)
			);
	});
}

/**
 * Conversation ouverte à l'initiative de l'équipe (§8.4).
 *
 * Le client est désigné par son e-mail ; la commande, facultative, par sa
 * référence et doit lui appartenir.
 */
export async function createStaffThread(form: FormData, userId: string) {
	const { str, int } = formFields(form);
	const email = str('email')?.toLowerCase();
	const subject = str('subject');
	if (!email) throw new SupportError("L'e-mail du client est obligatoire.");
	if (!subject) throw new SupportError("L'objet est obligatoire.");
	const content = messageContent(form);

	const [cust] = await db
		.select({ id: customer.id })
		.from(customer)
		.where(sql`lower(${customer.email}) = ${email}`)
		.limit(1);
	if (!cust) throw new SupportError('Aucun client avec cet e-mail.');

	let orderId: number | null = null;
	const orderRef = str('orderReference');
	if (orderRef) {
		const [ord] = await db
			.select({ id: order.id, customerId: order.customerId })
			.from(order)
			.where(eq(order.reference, orderRef))
			.limit(1);
		if (!ord) throw new SupportError('Commande introuvable.');
		if (ord.customerId !== cust.id)
			throw new SupportError("Cette commande n'appartient pas au client.");
		orderId = ord.id;
	}

	const priority = str('priority') as SupportPriority | null;
	const { id, reference } = await nextThreadId();

	await db.transaction(async (tx) => {
		await tx.insert(supportThread).values({
			id,
			reference,
			customerId: cust.id,
			subject: subject.slice(0, 255),
			categoryId: int('categoryId', 0) || null,
			priority: priority && SUPPORT_PRIORITIES.includes(priority) ? priority : 'normal',
			orderId,
			assignedUserId: userId,
			status: 'pending_customer',
			unreadByCustomer: 1
		});
		await tx.insert(supportMessage).values({
			threadId: id,
			senderType: 'staff',
			senderUserId: userId,
			content
		});
	});

	return id;
}

// ---------------------------------------------------------------------------
// Espace client
// ---------------------------------------------------------------------------

/**
 * Une conversation n'est montrée au client que si elle contient au moins un
 * message qui lui est destiné : un fil fait uniquement de notes internes
 * n'existe pas pour lui (R12, R13).
 */
const visibleToCustomer = sql`EXISTS (
	SELECT 1 FROM ${supportMessageAll} vm
	WHERE vm.thread_id = ${supportThreadAll.id} AND vm.kind IN ('customer', 'staff')
)`;

/** Conversations du client, la plus récente d'abord. */
export async function listCustomerThreads(customerId: number) {
	return db
		.select({
			id: supportThreadAll.id,
			reference: supportThreadAll.reference,
			subject: supportThreadAll.subject,
			status: supportThreadAll.status,
			unreadByCustomer: supportThreadAll.unreadByCustomer,
			lastMessageAt: supportThreadAll.lastMessageAt,
			orderReference: order.reference
		})
		.from(supportThreadAll)
		.leftJoin(order, eq(order.id, supportThreadAll.orderId))
		.where(and(eq(supportThreadAll.customerId, customerId), visibleToCustomer))
		.orderBy(desc(supportThreadAll.lastMessageAt), desc(supportThreadAll.id));
}

/** Conversations portant une réponse non lue : pastille de l'en-tête. */
export async function countUnreadForCustomer(customerId: number) {
	const [{ n }] = await db
		.select({ n: count() })
		.from(supportThread)
		.where(and(eq(supportThread.customerId, customerId), gt(supportThread.unreadByCustomer, 0)));
	return n;
}

/**
 * Fil d'une conversation du client, ou `undefined` si elle ne lui appartient
 * pas : même réponse qu'une conversation inexistante (R1).
 *
 * Le client ne voit ni les notes internes, ni les changements de statut, ni
 * le nom des membres de l'équipe (R12).
 */
export async function getCustomerThread(customerId: number, id: number) {
	const thread = await getSupportThread(id);
	if (!thread || thread.customerId !== customerId) return undefined;

	const messages = thread.messages
		.filter((m) => m.kind === 'customer' || m.kind === 'staff')
		.map((m) => ({
			id: m.id,
			fromTeam: m.kind === 'staff',
			author: m.kind === 'staff' ? TEAM_FALLBACK_NAME : m.author,
			html: m.html,
			createdAt: m.createdAt,
			files: m.files
		}));
	if (messages.length === 0) return undefined;

	return {
		id: thread.id,
		reference: thread.reference,
		subject: thread.subject,
		status: thread.status,
		isLegacy: thread.isLegacy,
		unreadByCustomer: thread.unreadByCustomer,
		createdAt: thread.createdAt,
		categoryLabel: thread.categoryLabel,
		order: thread.order ? { id: thread.order.id, reference: thread.order.reference } : null,
		previous: thread.previous,
		followUps: thread.followUps,
		messages
	};
}

/** Le client a ouvert le fil : les réponses de l'équipe sont lues. */
export async function markReadByCustomer(customerId: number, threadId: number) {
	await db.transaction(async (tx) => {
		const [t] = await tx
			.update(supportThread)
			.set({ unreadByCustomer: 0 })
			.where(
				and(
					eq(supportThread.id, threadId),
					eq(supportThread.customerId, customerId),
					gt(supportThread.unreadByCustomer, 0)
				)
			)
			.returning({ id: supportThread.id });
		if (!t) return;
		await tx
			.update(supportMessage)
			.set({ readAt: new Date() })
			.where(
				and(
					eq(supportMessage.threadId, threadId),
					eq(supportMessage.senderType, 'staff'),
					isNull(supportMessage.readAt)
				)
			);
	});
}

/** Message du client : la conversation passe en attente de l'équipe (R5), et se rouvre si besoin (R9). */
async function appendCustomerMessage(tx: Tx, threadId: number, content: string) {
	await tx.insert(supportMessage).values({ threadId, senderType: 'customer', content });
	await tx
		.update(supportThread)
		.set({
			status: 'pending_staff',
			unreadByStaff: sql`${supportThread.unreadByStaff} + 1`,
			lastMessageAt: new Date(),
			closedAt: null,
			updatedAt: new Date()
		})
		.where(eq(supportThread.id, threadId));
}

/**
 * Réponse du client dans une de ses conversations. Dans une conversation de
 * l'historique, la réponse ouvre sa suite ; l'identifiant renvoyé est celui
 * où le message a été écrit.
 */
export async function postCustomerMessage(customerId: number, threadId: number, form: FormData) {
	const content = messageContent(form);
	const [current] = await db
		.select()
		.from(supportThreadAll)
		.where(and(eq(supportThreadAll.id, threadId), eq(supportThreadAll.customerId, customerId)))
		.limit(1);
	if (!current) throw new SupportError('Conversation introuvable.');

	return db.transaction(async (tx) => {
		const target = current.isLegacy
			? await openContinuation(tx, current, 'pending_staff')
			: threadId;
		await appendCustomerMessage(tx, target, content);
		return target;
	});
}

/**
 * Nouvelle conversation ouverte par le client (§8.1). La commande, facultative,
 * doit lui appartenir.
 */
export async function createCustomerThread(customerId: number, form: FormData) {
	const { str, int } = formFields(form);
	const subject = str('subject');
	if (!subject) throw new SupportError("Indiquez l'objet de votre demande.");
	const content = messageContent(form);

	let orderId: number | null = int('orderId', 0) || null;
	if (orderId) {
		const [owned] = await db
			.select({ id: order.id })
			.from(order)
			.where(and(eq(order.id, orderId), eq(order.customerId, customerId)))
			.limit(1);
		if (!owned) orderId = null;
	}

	const categoryId = int('categoryId', 0) || null;
	if (categoryId) {
		const [cat] = await db
			.select({ id: supportCategory.id })
			.from(supportCategory)
			.where(and(eq(supportCategory.id, categoryId), eq(supportCategory.isActive, true)))
			.limit(1);
		if (!cat) throw new SupportError('Catégorie invalide.');
	}

	const { id, reference } = await nextThreadId();
	await db.transaction(async (tx) => {
		await tx.insert(supportThread).values({
			id,
			reference,
			customerId,
			subject: subject.slice(0, 255),
			categoryId,
			orderId,
			status: 'pending_staff'
		});
		await appendCustomerMessage(tx, id, content);
	});
	return id;
}
