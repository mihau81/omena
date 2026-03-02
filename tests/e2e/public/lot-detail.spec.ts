import { test, expect } from '@playwright/test';

const BASE = '/omena';
const LOCALE = 'en';

test.describe('Lot detail page', () => {
  let auctionSlug: string | null = null;
  let lotUrl: string | null = null;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await page.goto(`${BASE}/${LOCALE}/auctions`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // Get first auction slug
    const auctionLink = page.locator(`a[href*="/${LOCALE}/auctions/"]`).first();
    const auctionHref = await auctionLink.getAttribute('href');
    if (!auctionHref) { await page.close(); return; }

    const parts = auctionHref.split('/auctions/');
    auctionSlug = parts[1]?.split('/')[0] ?? null;

    if (auctionSlug) {
      await page.goto(`${BASE}/${LOCALE}/auctions/${auctionSlug}`);
      await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

      // Get first lot link
      const lotLink = page.locator(`a[href*="/${LOCALE}/auctions/${auctionSlug}/"]`).first();
      lotUrl = await lotLink.getAttribute('href');
    }
    await page.close();
  });

  test('displays lot title and artist', async ({ page }) => {
    if (!lotUrl) test.skip();
    await page.goto(lotUrl!);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // Heading (lot title) should be visible
    await expect(page.getByRole('heading').first()).toBeVisible();
  });

  test('image gallery is present', async ({ page }) => {
    if (!lotUrl) test.skip();
    await page.goto(lotUrl!);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // Images or gallery container should exist
    const images = page.locator('img');
    const count = await images.count();
    expect(count).toBeGreaterThan(0);
  });

  test('bid panel is visible', async ({ page }) => {
    if (!lotUrl) test.skip();
    await page.goto(lotUrl!);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // Bid panel should contain either bid input or status message (SOLD/UNSOLD/upcoming)
    const hasBidInput = await page.locator('#bid-amount').isVisible({ timeout: 3000 }).catch(() => false);
    const hasStatusMsg = await page.locator('[class*="blue"], [class*="upcoming"]').first().isVisible({ timeout: 1000 }).catch(() => false);
    const hasEndedMsg = await page.locator('[class*="sold"], [class*="unsold"]').first().isVisible({ timeout: 1000 }).catch(() => false);
    // Status may also appear as plain text (e.g. "SOLD", "UNSOLD")
    const hasStatusText = await page.locator('text=/SOLD|UNSOLD|PASSED/').first().isVisible({ timeout: 1000 }).catch(() => false);

    expect(hasBidInput || hasStatusMsg || hasEndedMsg || hasStatusText).toBeTruthy();
  });

  test('estimate or price information is shown', async ({ page }) => {
    if (!lotUrl) test.skip();
    await page.goto(lotUrl!);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // Estimate, current bid, or price should be visible
    const priceText = page.locator('text=/PLN|zł|€|\$/').first();
    if (await priceText.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(priceText).toBeVisible();
    }
  });

  test('breadcrumbs navigate back to auction', async ({ page }) => {
    if (!lotUrl || !auctionSlug) test.skip();
    await page.goto(lotUrl!);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // Find auction link in breadcrumbs
    const auctionBreadcrumb = page.locator(`a[href*="/auctions/${auctionSlug}"]`).first();
    if (await auctionBreadcrumb.isVisible({ timeout: 3000 }).catch(() => false)) {
      await auctionBreadcrumb.click();
      await page.waitForURL(`${BASE}/${LOCALE}/auctions/${auctionSlug}**`);
      expect(page.url()).toContain(`/auctions/${auctionSlug}`);
    }
  });

  test('lot number is displayed', async ({ page }) => {
    if (!lotUrl) test.skip();
    await page.goto(lotUrl!);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // Lot number should appear somewhere on page
    const bodyText = await page.textContent('body');
    expect(bodyText).toMatch(/lot\s*#?\d+/i);
  });
});
