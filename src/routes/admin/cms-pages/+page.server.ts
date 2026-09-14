import type { PageServerLoad } from './$types';
import { listCmsPages } from '$lib/server/cms';

export const load: PageServerLoad = async () => ({ rows: await listCmsPages() });
