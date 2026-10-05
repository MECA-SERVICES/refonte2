import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireCustomer } from '../../guard';
import {
	getCustomerThread,
	markReadByCustomer,
	postCustomerMessage,
	SupportError
} from '$lib/server/support';

export const load: PageServerLoad = async ({ locals, params, url }) => {
	const profile = await requireCustomer(locals, url.pathname);

	const id = Number(params.id);
	// Une conversation d'un autre client répond comme une conversation
	// inexistante : rien ne doit trahir son existence (R1).
	if (!Number.isInteger(id)) error(404, 'Conversation introuvable');

	const thread = await getCustomerThread(profile.id, id);
	if (!thread) error(404, 'Conversation introuvable');

	if (!thread.isLegacy && thread.unreadByCustomer > 0) await markReadByCustomer(profile.id, id);

	return { thread };
};

export const actions: Actions = {
	reply: async ({ locals, params, request, url }) => {
		const profile = await requireCustomer(locals, url.pathname);
		const id = Number(params.id);
		if (!Number.isInteger(id)) error(404, 'Conversation introuvable');

		try {
			const target = await postCustomerMessage(profile.id, id, await request.formData());
			if (target !== id) redirect(303, `/compte/messages/${target}`);
			return { sent: true };
		} catch (cause) {
			if (cause instanceof SupportError) return fail(400, { message: cause.message });
			throw cause;
		}
	}
};
