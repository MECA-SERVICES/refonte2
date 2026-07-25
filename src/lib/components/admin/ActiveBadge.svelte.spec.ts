import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ActiveBadge from './ActiveBadge.svelte';

describe('ActiveBadge.svelte', () => {
	it('affiche « Actif » quand active est vrai', async () => {
		render(ActiveBadge, { active: true });
		await expect.element(page.getByText('Actif')).toBeInTheDocument();
	});

	it('affiche « Inactif » quand active est faux', async () => {
		render(ActiveBadge, { active: false });
		await expect.element(page.getByText('Inactif')).toBeInTheDocument();
	});
});
