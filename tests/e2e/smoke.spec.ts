import { test, expect } from '@playwright/test';

/**
 * Minimal CI smoke tests — verify the production build starts and renders.
 * These run WITHOUT auth setup to keep CI fast and lightweight.
 */
test.describe('Smoke tests', () => {
  test('homepage renders with brand heading', async ({ page }) => {
    await page.goto('/omenaa/en');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('h1')).toBeVisible({ timeout: 15_000 });
    await expect(page).toHaveTitle(/Omenaa/i);
  });

  test('about page loads successfully', async ({ page }) => {
    const response = await page.goto('/omenaa/en/about');
    expect(response?.status()).toBeLessThan(500);
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 15_000 });
  });

  test('auctions page loads successfully', async ({ page }) => {
    const response = await page.goto('/omenaa/en/auctions');
    expect(response?.status()).toBeLessThan(500);
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 15_000 });
  });
});
