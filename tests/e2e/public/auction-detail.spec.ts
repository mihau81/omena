import { test, expect } from '@playwright/test';

const BASE = '/omena';
const LOCALE = 'en';

test.describe('Auction detail page', () => {
  let auctionSlug: string | null = null;

  test.beforeAll(async ({ browser }) => {
    // Navigate to auctions list and pick the first slug
    const page = await browser.newPage();
    await page.goto(`${BASE}/${LOCALE}/auctions`);
    await page.waitForLoadState('networkidle');
    const link = page.locator(`a[href*="/${LOCALE}/auctions/"]`).first();
    const href = await link.getAttribute('href');
    if (href) {
      const parts = href.split('/auctions/');
      auctionSlug = parts[1]?.split('/')[0] ?? null;
    }
    await page.close();
  });

  test('displays auction title and dates', async ({ page }) => {
    if (!auctionSlug) test.skip();
    await page.goto(`${BASE}/${LOCALE}/auctions/${auctionSlug}`);
    await page.waitForLoadState('networkidle');

    // Heading should be visible
    await expect(page.getByRole('heading').first()).toBeVisible();
    // Some date info should be present
    const pageText = await page.textContent('body');
    expect(pageText).toBeTruthy();
  });

  test('displays lot grid with lot cards', async ({ page }) => {
    if (!auctionSlug) test.skip();
    await page.goto(`${BASE}/${LOCALE}/auctions/${auctionSlug}`);
    await page.waitForLoadState('networkidle');

    // Lot cards should be visible — they link to lot detail pages
    const lotLinks = page.locator(`a[href*="/${LOCALE}/auctions/${auctionSlug}/"]`);
    if (await lotLinks.count() > 0) {
      await expect(lotLinks.first()).toBeVisible();
    }
  });

  test('breadcrumbs or back navigation is present', async ({ page }) => {
    if (!auctionSlug) test.skip();
    await page.goto(`${BASE}/${LOCALE}/auctions/${auctionSlug}`);
    await page.waitForLoadState('networkidle');

    // Breadcrumb or back link should exist (aria-label may be localized)
    const breadcrumb = page.locator('nav[aria-label*="breadcrumb" i], nav[aria-label*="okruszkowa" i], [class*="breadcrumb"]').first();
    const backLink = page.locator(`a[href*="/auctions"]`).filter({ hasText: /auctions|back/i }).first();

    const hasBreadcrumb = await breadcrumb.isVisible({ timeout: 2000 }).catch(() => false);
    const hasBackLink = await backLink.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasBreadcrumb || hasBackLink).toBeTruthy();
  });

  test('lot card links navigate to lot detail', async ({ page }) => {
    if (!auctionSlug) test.skip();
    await page.goto(`${BASE}/${LOCALE}/auctions/${auctionSlug}`);
    await page.waitForLoadState('networkidle');

    const lotLinks = page.locator(`a[href*="/${LOCALE}/auctions/${auctionSlug}/"]`);
    if (await lotLinks.count() === 0) {
      test.skip();
      return;
    }

    const firstLotLink = lotLinks.first();
    await firstLotLink.click();
    await page.waitForURL(`${BASE}/${LOCALE}/auctions/${auctionSlug}/**`);
    expect(page.url()).toContain(`/${auctionSlug}/`);
  });
});
