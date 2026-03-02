import { test, expect } from '@playwright/test';

const BASE = '/omena';
const LOCALE = 'en';

test.describe('About page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/${LOCALE}/about`);
    await page.waitForLoadState('networkidle');
  });

  test('page renders without error', async ({ page }) => {
    // Check main content area, not full body (body includes script text with i18n "Not found" key)
    const main = page.locator('main, [id="main-content"], article, section').first();
    const mainText = await main.textContent();
    expect(mainText).toBeTruthy();
    expect(mainText!.length).toBeGreaterThan(50);
  });

  test('displays a main heading', async ({ page }) => {
    await expect(page.getByRole('heading').first()).toBeVisible();
  });

  test('navigation header is visible', async ({ page }) => {
    await expect(page.locator('header')).toBeVisible();
    await expect(page.locator('header a').filter({ hasText: 'OMENA' })).toBeVisible();
  });

  test('about content sections are present', async ({ page }) => {
    // The page should have multiple sections or meaningful content
    const sections = page.locator('section, article, [class*="section"]');
    const count = await sections.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('links in the page are functional', async ({ page }) => {
    const viewport = page.viewportSize();
    if (viewport && viewport.width < 1024) {
      // On mobile, links are in hamburger menu
      const menuBtn = page.getByRole('button', { name: /menu/i });
      if (await menuBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await menuBtn.click();
        await page.waitForTimeout(300);
      }
    }
    const auctionsLink = page.getByRole('link', { name: /auctions/i }).first();
    await expect(auctionsLink).toBeVisible();
  });
});
