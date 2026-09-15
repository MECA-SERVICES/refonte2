import type { PageServerLoad } from './$types';
import { listBlogArticles } from '$lib/server/blog';

export const load: PageServerLoad = async () => ({ rows: await listBlogArticles() });
