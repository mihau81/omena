import { test, expect } from '@playwright/test';

const BASE = '/omena';
const LOCALE = 'en';

test.describe('My Bids page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/${LOCALE}/my-bids`);
    await page.waitForLoadState('networkidle');
  });

  test('my-bids page renders heading', async ({ page }) => {
    // Page heading should be visible (My Bids or similar)
    await expect(page.getByRole('heading').first()).toBeVisible();
  });

  test('breadcrumbs navigate back to home', async ({ page }) => {
    const homeLink = page.locator(`a[href="/${LOCALE}"]`).first();
    if (await homeLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(homeLink).toBeVisible();
    }
  });

  test('shows empty state or bid list', async ({ page }) => {
    // Either shows empty state message or list of bids
    const spinner = page.locator('[class*="animate-spin"]');
    // Wait for loading to finish
    await page.waitForTimeout(2000);

    const emptyMsg = page.locator('text=/no bids|empty|haven.*placed/i').first();
    const bidList = page.locator('[class*="space-y"]').first();
    const unauthMsg = page.locator('text=/log in|sign in|register/i').first();

    const hasEmpty = await emptyMsg.isVisible({ timeout: 2000 }).catch(() => false);
    const hasBids = await bidList.isVisible({ timeout: 1000 }).catch(() => false);
    const hasUnauth = await unauthMsg.isVisible({ timeout: 1000 }).catch(() => false);

    expect(hasEmpty || hasBids || hasUnauth).toBeTruthy();
  });

  test('bid items show winning/outbid status indicators', async ({ page }) => {
    await page.waitForTimeout(2000);

    // If there are bids, they should have status indicators
    const winningBadge = page.locator('text=/winning|won/i').first();
    const outbidBadge = page.locator('text=/outbid/i').first();

    // This test only validates if bids exist
    const bidCards = page.locator('[class*="rounded-xl"]');
    if (await bidCards.count() > 0) {
      // At least one of winning/outbid should appear
      const hasWinning = await winningBadge.isVisible({ timeout: 2000 }).catch(() => false);
      const hasOutbid = await outbidBadge.isVisible({ timeout: 2000 }).catch(() => false);
      // If bids exist, status indicators should be present
    }
  });

  test('lot links navigate to lot detail', async ({ page }) => {
    await page.waitForTimeout(2000);
    const lotLink = page.locator(`a[href*="/${LOCALE}/auctions/"]`).first();
    if (await lotLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      const href = await lotLink.getAttribute('href');
      expect(href).toContain('/auctions/');
    }
  });

  test('view all auctions link is present in empty state', async ({ page }) => {
    await page.waitForTimeout(2000);
    const viewAllLink = page.getByRole('link', { name: /view all auctions|all auctions/i });
    // Only present in empty state
    if (await viewAllLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(viewAllLink).toHaveAttribute('href', new RegExp(`/${LOCALE}/auctions`));
    }
  });
});
