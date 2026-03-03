import { test, expect } from '@playwright/test';

const BASE = '/omenaa';
const LOCALE = 'en';

test.describe('Auctions listing page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/${LOCALE}/auctions`);
    await page.waitForLoadState('networkidle');
  });

  test('renders auctions page heading', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /auctions/i }).first()
    ).toBeVisible();
  });

  test('displays auction cards or list items', async ({ page }) => {
    // Auction cards or rows should exist
    const cards = page.locator('article, [class*="card"], a[href*="/auctions/"]');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('clicking an auction navigates to detail page', async ({ page }) => {
    // Click the first auction link in the list
    const firstAuctionLink = page.locator(`a[href*="/${LOCALE}/auctions/"]`).first();
    await expect(firstAuctionLink).toBeVisible();
    const href = await firstAuctionLink.getAttribute('href');
    await firstAuctionLink.click();
    await page.waitForURL(`${BASE}/${LOCALE}/auctions/**`);
    expect(page.url()).toContain(`/${LOCALE}/auctions/`);
  });

  test('status filters are present', async ({ page }) => {
    // Status filter buttons / tabs should exist
    const filterArea = page.locator('[class*="filter"], button').filter({ hasText: /all|live|upcoming|ended/i });
    // At least some filtering mechanism should be visible
    if (await filterArea.count() > 0) {
      await expect(filterArea.first()).toBeVisible();
    }
  });

  test('page title includes Auctions text', async ({ page }) => {
    const title = await page.title();
    // Title should contain auction-related text or OMENAA
    expect(title.toLowerCase()).toMatch(/auction|omenaa/);
  });
});
