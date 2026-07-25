import { expect, test } from '@playwright/test';

test('la racine du site renvoie vers le back-office', async ({ page }) => {
	await page.goto('/');
	await expect(page).toHaveURL(/\/admin\/login/);
});

test('le back-office exige une connexion', async ({ page }) => {
	await page.goto('/admin/products');
	await expect(page).toHaveURL(/\/admin\/login\?redirectTo=/);
	await expect(page.locator('form')).toBeVisible();
});
