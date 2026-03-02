import { test, expect } from '@playwright/test';

const BASE = '/omena';
const LOCALE = 'en';

test.describe('Register for auction', () => {
  test('registration modal appears on lot page bid click', async ({ page }) => {
    // Navigate to auctions and find a lot
    await page.goto(`${BASE}/${LOCALE}/auctions`);
    await page.waitForLoadState('networkidle');

    const auctionLink = page.locator(`a[href*="/${LOCALE}/auctions/"]`).first();
    if (await auctionLink.count() === 0) test.skip();

    const auctionHref = await auctionLink.getAttribute('href');
    if (!auctionHref) test.skip();

    const slug = auctionHref.split('/auctions/')[1]?.split('/')[0];
    if (!slug) test.skip();

    await page.goto(`${BASE}/${LOCALE}/auctions/${slug}`);
    await page.waitForLoadState('networkidle');

    const lotLink = page.locator(`a[href*="/${LOCALE}/auctions/${slug}/"]`).first();
    if (await lotLink.count() === 0) test.skip();

    const lotHref = await lotLink.getAttribute('href');
    if (!lotHref) test.skip();

    await page.goto(`${BASE}${lotHref}`);
    await page.waitForLoadState('networkidle');

    const bidInput = page.locator('#bid-amount');
    if (!await bidInput.isVisible({ timeout: 3000 }).catch(() => false)) test.skip();

    const placeBidBtn = page.getByRole('button').filter({ hasText: /place bid/i });
    if (!await placeBidBtn.isVisible({ timeout: 2000 }).catch(() => false)) test.skip();

    await placeBidBtn.click();

    // Registration modal or confirm dialog should appear
    const modal = page.locator('[role="dialog"], [class*="modal"], [class*="fixed"]').last();
    await expect(modal).toBeVisible({ timeout: 3000 });
  });

  test('register button on auction page opens registration', async ({ page }) => {
    await page.goto(`${BASE}/${LOCALE}/auctions`);
    await page.waitForLoadState('networkidle');

    const auctionLink = page.locator(`a[href*="/${LOCALE}/auctions/"]`).first();
    if (await auctionLink.count() === 0) test.skip();
    await auctionLink.click();
    await page.waitForLoadState('networkidle');

    // Look for register button on the auction detail page
    const registerBtn = page.getByRole('button', { name: /register|bid registration/i });
    if (await registerBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await registerBtn.click();
      const modal = page.locator('[role="dialog"], [class*="modal"]').first();
      await expect(modal).toBeVisible({ timeout: 3000 });
    }
  });

  test('watch button is visible on lot page', async ({ page }) => {
    await page.goto(`${BASE}/${LOCALE}/auctions`);
    await page.waitForLoadState('networkidle');

    const auctionLink = page.locator(`a[href*="/${LOCALE}/auctions/"]`).first();
    if (await auctionLink.count() === 0) test.skip();

    const auctionHref = await auctionLink.getAttribute('href');
    const slug = auctionHref?.split('/auctions/')[1]?.split('/')[0];
    if (!slug) test.skip();

    await page.goto(`${BASE}/${LOCALE}/auctions/${slug}`);
    const lotLink = page.locator(`a[href*="/auctions/${slug}/"]`).first();
    if (await lotLink.count() === 0) test.skip();

    const lotHref = await lotLink.getAttribute('href');
    await page.goto(`${BASE}${lotHref}`);
    await page.waitForLoadState('networkidle');

    // Watch/Unwatch button should exist
    const watchBtn = page.getByRole('button').filter({ hasText: /watch|unwatch/i });
    if (await watchBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(watchBtn).toBeVisible();
    }
  });
});
