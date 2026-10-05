import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	getSupportThread,
	listStaffUsers,
	listSupportCategories,
	markReadByStaff,
	postStaffMessage,
	setThreadStatus,
	SupportError,
	updateThreadMeta
} from '$lib/server/support';

function threadId(raw: string) {
	const id = Number(raw);
	if (!Number.isInteger(id)) error(404, 'Conversation introuvable');
	return id;
}

export const load: PageServerLoad = async ({ params }) => {
	const id = threadId(params.id);
	const thread = await getSupportThread(id);
	if (!thread) error(404, 'Conversation introuvable');

	// Ouvrir le fil vaut lecture des messages du client.
	if (!thread.isLegacy && thread.unreadByStaff > 0) await markReadByStaff(id);

	const [categories, staff] = await Promise.all([listSupportCategories(), listStaffUsers()]);

	return {
		thread,
		categories: categories
			.filter((c) => c.isActive || c.id === thread.categoryId)
			.map((c) => ({ id: c.id, label: c.label })),
		staff
	};
};

export const actions: Actions = {
	/** Réponse au client ou note interne (`internal=1`). */
	reply: async ({ params, request, locals }) => {
		const id = threadId(params.id);
		if (!locals.user) error(401);
		try {
			const target = await postStaffMessage(id, await request.formData(), locals.user.id);
			// Répondre à une conversation de l'historique ouvre sa suite.
			if (target !== id) redirect(303, `/admin/customer-service/${target}`);
			return { replied: true };
		} catch (cause) {
			if (cause instanceof SupportError) return fail(400, { message: cause.message });
			throw cause;
		}
	},

	meta: async ({ params, request }) => {
		await updateThreadMeta(threadId(params.id), await request.formData());
		return { saved: true };
	},

	close: async ({ params }) => {
		await setThreadStatus(threadId(params.id), 'closed');
		return { closed: true };
	},

	reopen: async ({ params }) => {
		await setThreadStatus(threadId(params.id), 'pending_staff');
		return { reopened: true };
	}
};
