import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	balanceLog,
	cancelLeave,
	decideLeave,
	LeaveError,
	setBalance,
	teamBalances,
	teamLeaves
} from '$lib/server/leaves';
import { runOrFail } from '$lib/server/document-actions';
import { balanceTypes, isLeaveStatus, type BalanceType } from '$lib/leaves';

/** Congés de l'équipe (administrateurs) : `?status=` filtre les demandes. */
export const load: PageServerLoad = async ({ url }) => {
	const status = url.searchParams.get('status');
	const filter = isLeaveStatus(status) ? status : null;
	const [requests, balances, log] = await Promise.all([
		teamLeaves(filter),
		teamBalances(),
		balanceLog(null, 40)
	]);
	return { requests, balances, log, status: filter };
};

const run = (task: () => Promise<unknown>) => runOrFail(task, (e) => e instanceof LeaveError);
const note = (form: FormData) => form.get('note')?.toString().trim() || null;

export const actions: Actions = {
	approve: async ({ request, locals }) => {
		const form = await request.formData();
		const me = locals.user!;
		return run(() => decideLeave(Number(form.get('id')), true, me, note(form)));
	},

	refuse: async ({ request, locals }) => {
		const form = await request.formData();
		const me = locals.user!;
		return run(() => decideLeave(Number(form.get('id')), false, me, note(form)));
	},

	cancel: async ({ request, locals }) => {
		const form = await request.formData();
		const me = locals.user!;
		return run(() =>
			cancelLeave(Number(form.get('id')), { id: me.id, name: me.name, isAdmin: true }, note(form))
		);
	},

	setBalance: async ({ request, locals }) => {
		const form = await request.formData();
		const type = form.get('type')?.toString();
		if (!balanceTypes.includes(type as BalanceType)) {
			return fail(400, { message: 'Type de solde invalide.' });
		}
		const days = Number(String(form.get('days') ?? '').replace(',', '.'));
		return run(() =>
			setBalance(
				form.get('userId')?.toString() ?? '',
				type as BalanceType,
				days,
				form.get('reason')?.toString() ?? '',
				locals.user!.name
			)
		);
	}
};
