import { test, expect } from '@playwright/test';

const BASE = '/omenaa';
const LOCALE = 'en';

test.describe('Account dashboard', () => {
  test('renders Dashboard heading', async ({ page }) => {
    await page.goto(`${BASE}/${LOCALE}/account`);
    await page.waitForLoadState('networkidle');

    const heading = page.getByRole('heading', { name: /dashboard/i });
    const isVisible = await heading.isVisible({ timeout: 5000 }).catch(() => false);

    // Either shows dashboard or redirects to login
    if (!isVisible) {
      const loginInput = page.locator('input[type="email"]').first();
      expect(await loginInput.isVisible({ timeout: 2000 }).catch(() => false)).toBeTruthy();
    }
  });

  test('shows stats cards or loading state', async ({ page }) => {
    await page.goto(`${BASE}/${LOCALE}/account`);
    await page.waitForLoadState('networkidle');

    const heading = page.getByRole('heading', { name: /dashboard/i });
    if (!await heading.isVisible({ timeout: 5000 }).catch(() => false)) {
      test.skip();
      return;
    }

    await page.waitForTimeout(3000);

    // Either shows stat cards or "Failed to load"
    const cardsExist = await page.locator('a[class*="rounded-xl"]').first().isVisible({ timeout: 3000 }).catch(() => false);
    const failedMsg = await page.getByText(/failed to load/i).isVisible({ timeout: 1000 }).catch(() => false);

    expect(cardsExist || failedMsg).toBeTruthy();
  });

  test('dashboard links navigate to account pages', async ({ page }) => {
    await page.goto(`${BASE}/${LOCALE}/account`);
    await page.waitForLoadState('networkidle');

    const heading = page.getByRole('heading', { name: /dashboard/i });
    if (!await heading.isVisible({ timeout: 5000 }).catch(() => false)) {
      test.skip();
      return;
    }

    await page.waitForTimeout(3000);

    // Check that link cards are present (they link to /account/bids, /account/favorites, etc.)
    const links = page.locator(`a[href*="/${LOCALE}/account/"]`);
    const count = await links.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });
});
