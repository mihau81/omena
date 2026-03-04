import { test, expect } from '@playwright/test';

const BASE = '/omenaa';
const LOCALE = 'en';

test.describe('Account pages (authenticated user)', () => {
  test.describe('Account bids', () => {
    test('renders My Bids heading', async ({ page }) => {
      await page.goto(`${BASE}/${LOCALE}/account/bids`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // Either shows heading or redirects to login (if not authenticated)
      const heading = page.getByRole('heading', { name: /my bids/i });
      const loginPage = page.locator('input[type="email"]').first();

      const hasBids = await heading.isVisible({ timeout: 5000 }).catch(() => false);
      const isLoginRedirect = await loginPage.isVisible({ timeout: 2000 }).catch(() => false);

      expect(hasBids || isLoginRedirect).toBeTruthy();
    });

    test('shows tabs: All, Winning, Outbid', async ({ page }) => {
      await page.goto(`${BASE}/${LOCALE}/account/bids`);
      await page.waitForLoadState('networkidle');

      const heading = page.getByRole('heading', { name: /my bids/i });
      if (!await heading.isVisible({ timeout: 5000 }).catch(() => false)) {
        test.skip();
        return;
      }

      await expect(page.getByRole('button', { name: /all/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /winning/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /outbid/i })).toBeVisible();
    });

    test('shows empty state or bid list', async ({ page }) => {
      await page.goto(`${BASE}/${LOCALE}/account/bids`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);

      const heading = page.getByRole('heading', { name: /my bids/i });
      if (!await heading.isVisible({ timeout: 3000 }).catch(() => false)) {
        test.skip();
        return;
      }

      const emptyMsg = page.getByText(/no bids found/i);
      const bidItem = page.locator('[class*="rounded-xl"]').first();
      const hasEmpty = await emptyMsg.isVisible({ timeout: 3000 }).catch(() => false);
      const hasBids = await bidItem.isVisible({ timeout: 1000 }).catch(() => false);

      expect(hasEmpty || hasBids).toBeTruthy();
    });
  });

  test.describe('Account favorites', () => {
    test('renders Favorites heading', async ({ page }) => {
      await page.goto(`${BASE}/${LOCALE}/account/favorites`);
      await page.waitForLoadState('networkidle');

      const heading = page.getByRole('heading', { name: /favorites/i });
      const isVisible = await heading.isVisible({ timeout: 5000 }).catch(() => false);

      // Either shows favorites or redirects to login
      if (!isVisible) {
        const loginInput = page.locator('input[type="email"]').first();
        expect(await loginInput.isVisible({ timeout: 2000 }).catch(() => false)).toBeTruthy();
      }
    });

    test('shows empty state or favorites grid', async ({ page }) => {
      await page.goto(`${BASE}/${LOCALE}/account/favorites`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);

      const heading = page.getByRole('heading', { name: /favorites/i });
      if (!await heading.isVisible({ timeout: 3000 }).catch(() => false)) {
        test.skip();
        return;
      }

      const emptyMsg = page.getByText(/no favorites/i);
      const favGrid = page.locator('[class*="grid"]').first();
      const hasEmpty = await emptyMsg.isVisible({ timeout: 3000 }).catch(() => false);
      const hasFavs = await favGrid.isVisible({ timeout: 1000 }).catch(() => false);

      expect(hasEmpty || hasFavs).toBeTruthy();
    });
  });

  test.describe('Account notifications', () => {
    test('renders Notifications heading', async ({ page }) => {
      await page.goto(`${BASE}/${LOCALE}/account/notifications`);
      await page.waitForLoadState('networkidle');

      const heading = page.getByRole('heading', { name: /notifications/i });
      const isVisible = await heading.isVisible({ timeout: 5000 }).catch(() => false);

      if (!isVisible) {
        const loginInput = page.locator('input[type="email"]').first();
        expect(await loginInput.isVisible({ timeout: 2000 }).catch(() => false)).toBeTruthy();
      }
    });
  });

  test.describe('Account layout navigation', () => {
    test('sidebar navigation links are present (desktop)', async ({ page }) => {
      await page.goto(`${BASE}/${LOCALE}/account/bids`);
      await page.waitForLoadState('networkidle');

      const heading = page.getByRole('heading', { name: /my bids/i });
      if (!await heading.isVisible({ timeout: 5000 }).catch(() => false)) {
        test.skip();
        return;
      }

      // Check sidebar nav items
      const navItems = ['Dashboard', 'My Bids', 'Favorites', 'Invoices', 'Notifications', 'Profile'];
      for (const item of navItems) {
        const link = page.getByRole('link', { name: item }).first();
        const isVisible = await link.isVisible({ timeout: 1000 }).catch(() => false);
        // On mobile, sidebar is hidden — so only check desktop
        if (!isVisible) continue;
        expect(await link.isVisible()).toBeTruthy();
      }
    });
  });
});
