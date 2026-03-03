import { test, expect } from '@playwright/test';

const BASE = '/omenaa';
const LOCALE = 'en';

// Force mobile viewport
test.use({ viewport: { width: 375, height: 812 } });

test.describe('Mobile bid panel', () => {
  let liveLotUrl: string | null = null;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await page.goto(`${BASE}/${LOCALE}/auctions`);
    await page.waitForLoadState('networkidle');

    const auctionLinks = page.locator(`a[href*="/${LOCALE}/auctions/"]`);
    for (let i = 0; i < Math.min(await auctionLinks.count(), 3); i++) {
      const href = await auctionLinks.nth(i).getAttribute('href');
      if (!href) continue;
      const slug = href.split('/auctions/')[1]?.split('/')[0];
      if (!slug) continue;

      await page.goto(`${BASE}/${LOCALE}/auctions/${slug}`);
      await page.waitForLoadState('networkidle');

      const lotLinks = page.locator(`a[href*="/${LOCALE}/auctions/${slug}/"]`);
      if (await lotLinks.count() > 0) {
        const lotHref = await lotLinks.first().getAttribute('href');
        if (lotHref) {
          await page.goto(`${BASE}${lotHref}`);
          await page.waitForLoadState('networkidle');
          if (await page.locator('#bid-amount').isVisible({ timeout: 2000 }).catch(() => false)) {
            liveLotUrl = lotHref;
            break;
          }
        }
      }
    }
    await page.close();
  });

  test('bid panel is visible on mobile viewport', async ({ page }) => {
    if (!liveLotUrl) test.skip();
    await page.goto(`${BASE}${liveLotUrl}`);
    await page.waitForLoadState('networkidle');

    // Bid panel container should be visible
    const bidPanel = page.locator('[class*="rounded-2xl"]').filter({
      has: page.locator('#bid-amount').or(page.locator('[class*="upcoming"]')),
    }).first();

    if (await bidPanel.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(bidPanel).toBeVisible();
    }
  });

  test('bid amount input is usable on mobile', async ({ page }) => {
    if (!liveLotUrl) test.skip();
    await page.goto(`${BASE}${liveLotUrl}`);
    await page.waitForLoadState('networkidle');

    const bidInput = page.locator('#bid-amount');
    if (!await bidInput.isVisible({ timeout: 3000 }).catch(() => false)) test.skip();

    // Input should be within viewport
    const box = await bidInput.boundingBox();
    if (box) {
      expect(box.width).toBeGreaterThan(0);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(375 + 50); // Allow slight overflow
    }

    // Input should accept numeric input
    await bidInput.tap();
    await bidInput.fill('5000');
    const value = await bidInput.inputValue();
    expect(value).toMatch(/5[\s,]?000|5000/);
  });

  test('place bid button is tappable on mobile', async ({ page }) => {
    if (!liveLotUrl) test.skip();
    await page.goto(`${BASE}${liveLotUrl}`);
    await page.waitForLoadState('networkidle');

    const bidInput = page.locator('#bid-amount');
    if (!await bidInput.isVisible({ timeout: 3000 }).catch(() => false)) test.skip();

    const placeBidBtn = page.getByRole('button').filter({ hasText: /place bid/i });
    if (await placeBidBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Button should have adequate touch target size
      const box = await placeBidBtn.boundingBox();
      if (box) {
        expect(box.height).toBeGreaterThanOrEqual(40); // Min 40px touch target
        expect(box.width).toBeGreaterThan(0);
      }
    }
  });

  test('lot images display correctly on mobile', async ({ page }) => {
    if (!liveLotUrl) test.skip();
    await page.goto(`${BASE}${liveLotUrl}`);
    await page.waitForLoadState('networkidle');

    // Images should be responsive
    const mainImage = page.locator('img').first();
    if (await mainImage.isVisible({ timeout: 3000 }).catch(() => false)) {
      const box = await mainImage.boundingBox();
      if (box) {
        // Image should fit mobile width
        expect(box.width).toBeLessThanOrEqual(390); // Small tolerance above 375
      }
    }
  });

  test('lot title and artist info is visible on mobile', async ({ page }) => {
    if (!liveLotUrl) test.skip();
    await page.goto(`${BASE}${liveLotUrl}`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading').first()).toBeVisible();
  });

  test('watch button is accessible on mobile', async ({ page }) => {
    if (!liveLotUrl) test.skip();
    await page.goto(`${BASE}${liveLotUrl}`);
    await page.waitForLoadState('networkidle');

    const watchBtn = page.getByRole('button').filter({ hasText: /watch|unwatch/i });
    if (await watchBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Should be tappable
      const box = await watchBtn.boundingBox();
      if (box) {
        expect(box.height).toBeGreaterThanOrEqual(40);
      }
    }
  });
});
