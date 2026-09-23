/**
 * Pop-ups d'annonce de la boutique.
 *
 * Le vocabulaire et les règles d'éligibilité vivent dans `$lib/popups`,
 * partagé avec le navigateur ; ce module garde les accès à la base et les
 * réexporte, sur le modèle de `$lib/server/repairs`.
 */

import { and, asc, desc, eq, isNull, lte, or, gte } from 'drizzle-orm';
import { db } from './db';
import { popup, type NewPopup } from './db/popup.schema';
import { sanitizeHtml } from './sanitize';
import { formFields, type ParseResult } from './forms';
import { isLive, matchesPath, POPUP_SCOPES, type PopupScope } from '$lib/popups';

export { isLive, matchesPath, POPUP_SCOPES, type PopupScope };

/** Toutes les pop-ups, la plus prioritaire d'abord — back-office. */
export function listPopups() {
	return db.select().from(popup).orderBy(desc(popup.priority), asc(popup.name));
}

export async function getPopup(id: number) {
	const [row] = await db.select().from(popup).where(eq(popup.id, id)).limit(1);
	return row;
}

export async function createPopup(values: NewPopup) {
	const [row] = await db.insert(popup).values(values).returning();
	return row;
}

export async function updatePopup(id: number, values: Partial<NewPopup>) {
	const [row] = await db
		.update(popup)
		.set({ ...values, updatedAt: new Date() })
		.where(eq(popup.id, id))
		.returning();
	return row;
}

export async function deletePopup(id: number) {
	await db.delete(popup).where(eq(popup.id, id));
}

/**
 * Pop-up à présenter sur une adresse donnée, s'il y en a une.
 *
 * La fenêtre de diffusion est filtrée en SQL — c'est ce qui élimine le gros du
 * volume — puis le ciblage par adresse est appliqué en mémoire, la liste
 * restante étant courte.
 *
 * Une seule pop-up est renvoyée : en présenter deux à la fois serait une gêne,
 * la priorité tranche.
 */
export async function popupForPath(pathname: string, now: Date = new Date()) {
	const rows = await db
		.select()
		.from(popup)
		.where(
			and(
				eq(popup.isActive, true),
				// Bornes facultatives : absentes, elles n'excluent rien.
				or(isNull(popup.startsAt), lte(popup.startsAt, now)),
				or(isNull(popup.endsAt), gte(popup.endsAt, now))
			)
		)
		.orderBy(desc(popup.priority), asc(popup.id));

	const eligible = rows.find((row) => matchesPath(row.scope, row.paths, pathname));
	if (!eligible) return null;

	// Le contenu part vers le navigateur : il est assaini ici, jamais à
	// l'affichage, pour qu'aucune vue ne puisse l'oublier.
	return {
		id: eligible.id,
		title: eligible.title,
		content: sanitizeHtml(eligible.content) ?? '',
		imageUrl: eligible.imageUrl,
		ctaLabel: eligible.ctaLabel,
		ctaUrl: eligible.ctaUrl,
		delaySeconds: eligible.delaySeconds,
		dismissDays: eligible.dismissDays
	};
}

/** Champs saisissables d'une pop-up. */
export type PopupInput = {
	name: string;
	title: string | null;
	content: string;
	imageUrl: string | null;
	ctaLabel: string | null;
	ctaUrl: string | null;
	isActive: boolean;
	startsAt: Date | null;
	endsAt: Date | null;
	scope: PopupScope;
	paths: string | null;
	delaySeconds: number;
	dismissDays: number;
	priority: number;
};

/** Lit une date de formulaire (`datetime-local`), ou null si absente. */
function parseDate(value: string | null): Date | null {
	if (!value) return null;
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? null : date;
}

/** Champs d'une pop-up, extraits d'un formulaire. */
export function parsePopupForm(form: FormData): ParseResult<PopupInput> {
	const { str, int, bool } = formFields(form);

	const name = str('name');
	if (!name) return { ok: false, error: 'Le nom interne est obligatoire.' };

	const rawScope = str('scope') ?? 'all';
	const scope = (POPUP_SCOPES as readonly string[]).includes(rawScope)
		? (rawScope as PopupScope)
		: 'all';

	const startsAt = parseDate(str('startsAt'));
	const endsAt = parseDate(str('endsAt'));

	// Une fenêtre inversée ne diffuserait jamais : le signaler vaut mieux que
	// de laisser une pop-up muette sans explication.
	if (startsAt && endsAt && endsAt < startsAt) {
		return { ok: false, error: 'La date de fin précède la date de début.' };
	}

	const ctaLabel = str('ctaLabel');
	const ctaUrl = str('ctaUrl');
	if (ctaLabel && !ctaUrl) {
		return { ok: false, error: 'Indiquez l’adresse du bouton, ou retirez son libellé.' };
	}

	const paths = form.get('paths')?.toString().trim() || null;
	if (scope === 'paths' && !paths) {
		return { ok: false, error: 'Indiquez au moins une page ciblée.' };
	}

	return {
		ok: true,
		values: {
			name,
			title: str('title'),
			content: form.get('content')?.toString() ?? '',
			imageUrl: str('imageUrl'),
			ctaLabel,
			ctaUrl,
			isActive: bool('isActive'),
			startsAt,
			endsAt,
			scope,
			paths,
			// Bornes de bon sens : un délai négatif ou démesuré n'a pas de sens.
			delaySeconds: Math.min(Math.max(int('delaySeconds', 0), 0), 120),
			dismissDays: Math.min(Math.max(int('dismissDays', 7), 0), 365),
			priority: int('priority', 0)
		}
	};
}
