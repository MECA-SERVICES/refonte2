import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	balanceLog,
	balancesOf,
	cancelLeave,
	LeaveError,
	leavesOf,
	parseLeaveForm,
	requestLeave
} from '$lib/server/leaves';
import { runOrFail } from '$lib/server/document-actions';

/** Mes congés : soldes, demande, demandes passées. */
export const load: PageServerLoad = async ({ locals }) => {
	const me = locals.user;
	if (!me) error(401, 'Connexion requise.');
	const [balances, requests, log] = await Promise.all([
		balancesOf(me.id),
		leavesOf(me.id),
		balanceLog(me.id, 20)
	]);
	return { balances, requests, log, isAdmin: me.role === 'admin' };
};

const run = (task: () => Promise<unknown>) => runOrFail(task, (e) => e instanceof LeaveError);

export const actions: Actions = {
	request: async ({ request, locals }) => {
		const parsed = parseLeaveForm(await request.formData());
		if (!parsed.ok) return fail(400, { message: parsed.error });
		const me = locals.user!;
		return run(() => requestLeave({ id: me.id, name: me.name }, parsed.values));
	},

	cancel: async ({ request, locals }) => {
		const me = locals.user!;
		const id = Number((await request.formData()).get('id'));
		return run(() =>
			cancelLeave(id, { id: me.id, name: me.name, isAdmin: me.role === 'admin' }, null)
		);
	}
};
