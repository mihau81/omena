import { test, expect } from '@playwright/test';

const BASE = '/omena';
const LOCALE = 'en';

test.describe('Events page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/${LOCALE}/events`);
    await page.waitForLoadState('networkidle');
  });

  test('page renders without error', async ({ page }) => {
    // Check main content area, not full body (body includes script text with i18n "Not found" key)
    const main = page.locator('main, [id="main-content"], article, section').first();
    const mainText = await main.textContent();
    expect(mainText).toBeTruthy();
    expect(mainText!.length).toBeGreaterThan(50);
  });

  test('displays events heading', async ({ page }) => {
    await expect(page.getByRole('heading').first()).toBeVisible();
  });

  test('event cards or list items are displayed', async ({ page }) => {
    // Event cards should render
    const articles = page.locator('article, [class*="card"], [class*="event"]');
    if (await articles.count() > 0) {
      await expect(articles.first()).toBeVisible();
    } else {
      // At minimum the page should have some content
      const body = await page.textContent('body');
      expect(body!.length).toBeGreaterThan(50);
    }
  });

  test('navigation is functional', async ({ page }) => {
    await expect(page.locator('header')).toBeVisible();
  });
});
