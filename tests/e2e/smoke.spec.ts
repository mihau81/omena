import { test, expect } from '@playwright/test';

/**
 * Minimal CI smoke tests — verify the production build starts and renders.
 * These run WITHOUT auth setup to keep CI fast and lightweight.
 */
test.describe('Smoke tests', () => {
  test('homepage renders successfully', async ({ page }) => {
    const response = await page.goto('/omenaa/en', { timeout: 30_000 });
    expect(response?.status()).toBeLessThan(500);
    await page.waitForLoadState('domcontentloaded');

    // Verify page has meaningful content (not an error page)
    await expect(page.locator('header').first()).toBeVisible({ timeout: 20_000 });
  });

  test('about page loads successfully', async ({ page }) => {
    const response = await page.goto('/omenaa/en/about', { timeout: 30_000 });
    expect(response?.status()).toBeLessThan(500);
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('header').first()).toBeVisible({ timeout: 20_000 });
  });

  test('auctions page loads successfully', async ({ page }) => {
    const response = await page.goto('/omenaa/en/auctions', { timeout: 30_000 });
    expect(response?.status()).toBeLessThan(500);
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('header').first()).toBeVisible({ timeout: 20_000 });
  });
});
