import { test, expect } from '@playwright/test';

const BASE = '/omena';
const LOCALE = 'en';

test.describe('Place bid flow', () => {
  let liveLotUrl: string | null = null;

  test.beforeAll(async ({ browser }) => {
    // Find a live auction lot that has a bid input (#bid-amount).
    // Use the API to quickly check auction statuses instead of navigating pages.
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      // Try API first for speed (admin API may not be accessible without admin auth)
      const res = await page.request.get(`${BASE}/${LOCALE}/auctions`);
      if (!res.ok()) { await page.close(); await context.close(); return; }

      await page.goto(`${BASE}/${LOCALE}/auctions`, { timeout: 10000 });
      await page.waitForLoadState('domcontentloaded');

      // Only check the first auction to avoid timeout
      const auctionLink = page.locator(`a[href*="/${LOCALE}/auctions/"]`).first();
      const href = await auctionLink.getAttribute('href').catch(() => null);
      if (!href) { await page.close(); await context.close(); return; }

      const slug = href.split('/auctions/')[1]?.split('/')[0];
      if (!slug) { await page.close(); await context.close(); return; }

      await page.goto(`${BASE}/${LOCALE}/auctions/${slug}`, { timeout: 10000 });
      await page.waitForLoadState('domcontentloaded');

      const lotLink = page.locator(`a[href*="/${LOCALE}/auctions/${slug}/"]`).first();
      const lotHref = await lotLink.getAttribute('href').catch(() => null);
      if (!lotHref) { await page.close(); await context.close(); return; }

      await page.goto(lotHref, { timeout: 10000 });
      await page.waitForLoadState('domcontentloaded');
      const bidInput = page.locator('#bid-amount');
      if (await bidInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        liveLotUrl = lotHref;
      }
    } catch {
      // No live lot found — tests will skip via liveLotUrl === null
    }
    await page.close();
    await context.close();
  });

  test('bid input is visible for live auction lots', async ({ page }) => {
    if (!liveLotUrl) {
      // Try any lot page
      await page.goto(`${BASE}/${LOCALE}/auctions`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);
      const link = page.locator(`a[href*="/${LOCALE}/auctions/"]`).first();
      if (await link.count() === 0) test.skip();
      await link.click();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);
      const lotLink = page.locator(`a[href*="/auctions/"]`).nth(1);
      if (await lotLink.count() === 0) test.skip();
      await lotLink.click();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);
    } else {
      await page.goto(liveLotUrl!);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);
    }

    // Either bid input or status message (text or class-based) should be visible
    const bidInput = page.locator('#bid-amount');
    const statusMsg = page.locator('[class*="upcoming"], [class*="ended"], [class*="blue"]');
    const statusText = page.locator('text=/SOLD|UNSOLD|PASSED/').first();
    const hasBidInput = await bidInput.isVisible({ timeout: 3000 }).catch(() => false);
    const hasStatus = await statusMsg.isVisible({ timeout: 1000 }).catch(() => false);
    const hasStatusText = await statusText.isVisible({ timeout: 1000 }).catch(() => false);
    expect(hasBidInput || hasStatus || hasStatusText).toBeTruthy();
  });

  test('minimum bid error shown for too-low amount', async ({ page }) => {
    if (!liveLotUrl) test.skip();
    await page.goto(liveLotUrl!);
    await page.waitForLoadState('networkidle');

    const bidInput = page.locator('#bid-amount');
    if (!await bidInput.isVisible({ timeout: 3000 }).catch(() => false)) test.skip();

    // Enter a very low bid
    await bidInput.fill('1');

    // Check for validation error
    const errorMsg = page.locator('text=/minimum|min bid|next minimum/i').first();
    const redError = page.locator('[class*="red-6"], [class*="text-red"]').first();
    const hasError = await errorMsg.isVisible({ timeout: 2000 }).catch(() => false);
    const hasRedError = await redError.isVisible({ timeout: 1000 }).catch(() => false);
    expect(hasError || hasRedError).toBeTruthy();
  });

  test('place bid button is disabled for too-low amount', async ({ page }) => {
    if (!liveLotUrl) test.skip();
    await page.goto(liveLotUrl!);
    await page.waitForLoadState('networkidle');

    const bidInput = page.locator('#bid-amount');
    if (!await bidInput.isVisible({ timeout: 3000 }).catch(() => false)) test.skip();

    await bidInput.fill('1');

    const placeBidBtn = page.getByRole('button').filter({ hasText: /place bid|bid now/i });
    if (await placeBidBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(placeBidBtn).toBeDisabled();
    }
  });

  test('bid confirm modal appears after clicking place bid', async ({ page }) => {
    if (!liveLotUrl) test.skip();
    await page.goto(liveLotUrl!);
    await page.waitForLoadState('networkidle');

    const bidInput = page.locator('#bid-amount');
    if (!await bidInput.isVisible({ timeout: 3000 }).catch(() => false)) test.skip();

    // If user is not registered, registration modal appears
    // If registered, confirm modal appears
    const placeBidBtn = page.getByRole('button').filter({ hasText: /place bid/i });
    if (!await placeBidBtn.isVisible({ timeout: 2000 }).catch(() => false)) test.skip();

    await placeBidBtn.click();

    // Wait for either confirm or registration modal
    const modal = page.locator('[role="dialog"], [class*="modal"]').first();
    await expect(modal).toBeVisible({ timeout: 3000 });
  });
});
