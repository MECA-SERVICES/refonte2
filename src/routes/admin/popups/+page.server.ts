import type { PageServerLoad } from './$types';
import { listPopups } from '$lib/server/popups';

export const load: PageServerLoad = async () => ({ rows: await listPopups() });
