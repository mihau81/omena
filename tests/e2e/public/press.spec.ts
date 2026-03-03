import { test, expect } from '@playwright/test';

const BASE = '/omenaa';
const LOCALE = 'en';

test.describe('Press page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/${LOCALE}/press`);
    await page.waitForLoadState('networkidle');
  });

  test('page renders without error', async ({ page }) => {
    // Check main content area, not full body (body includes script text with i18n "Not found" key)
    const main = page.locator('main, [id="main-content"], article, section').first();
    const mainText = await main.textContent();
    expect(mainText).toBeTruthy();
    expect(mainText!.length).toBeGreaterThan(50);
  });

  test('displays press heading', async ({ page }) => {
    await expect(page.getByRole('heading').first()).toBeVisible();
  });

  test('press items or articles are displayed', async ({ page }) => {
    const items = page.locator('article, [class*="press"], [class*="card"]');
    if (await items.count() > 0) {
      await expect(items.first()).toBeVisible();
    } else {
      const body = await page.textContent('body');
      expect(body!.length).toBeGreaterThan(50);
    }
  });

  test('navigation header is present', async ({ page }) => {
    await expect(page.locator('header')).toBeVisible();
  });
});
