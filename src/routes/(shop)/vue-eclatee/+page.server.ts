import type { PageServerLoad } from './$types';
import {
	DEMO_BRANDS,
	DEMO_MODELS,
	DEMO_PART_COUNT,
	DEMO_PLATE,
	DEMO_TYPES,
	FINDER_HELP
} from '$lib/demo/exploded-view';

export const load: PageServerLoad = async () => ({
	brands: DEMO_BRANDS,
	types: DEMO_TYPES,
	models: DEMO_MODELS,
	partCount: DEMO_PART_COUNT,
	help: FINDER_HELP,
	plateSlug: DEMO_PLATE.slug
});
