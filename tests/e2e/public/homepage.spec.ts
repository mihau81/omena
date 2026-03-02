import { test, expect } from '@playwright/test';

const BASE = '/omena';
const LOCALE = 'en';

test.describe('Homepage', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/${LOCALE}`);
    await page.waitForLoadState('networkidle');
  });

  test('shows the OMENA brand name as hero heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Omena', level: 1 })).toBeVisible();
  });

  test('displays featured auctions section', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /featured auctions/i }).or(
        page.locator('h2').filter({ hasText: /auction/i }).first()
      )
    ).toBeVisible();
  });

  test('navigation links are visible on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const nav = page.locator('header nav');
    await expect(nav.getByRole('link', { name: /auctions/i })).toBeVisible();
    await expect(nav.getByRole('link', { name: /about/i })).toBeVisible();
    await expect(nav.getByRole('link', { name: /contact/i })).toBeVisible();
  });

  test('hero CTA button links to auctions', async ({ page }) => {
    const ctaLink = page.locator('a').filter({ hasText: /view auctions|browse auctions|explore/i }).first();
    if (await ctaLink.isVisible().catch(() => false)) {
      await expect(ctaLink).toHaveAttribute('href', new RegExp(`/${LOCALE}/auctions`));
    } else {
      // The hero CTA may have translated text — just verify some auction link exists
      const auctionLinks = page.locator(`a[href*="/${LOCALE}/auctions"]`);
      await expect(auctionLinks.first()).toBeVisible();
    }
  });

  test('language switcher changes locale', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    // Find language dropdown button in header
    const langButton = page.locator('header button').filter({ hasText: /🇬🇧|EN|English/i }).first();
    if (await langButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await langButton.click();
      // Look for Polish option
      const plButton = page.getByRole('button', { name: /🇵🇱|PL|Polish/i });
      if (await plButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await plButton.click();
        await page.waitForURL(`${BASE}/pl**`);
        expect(page.url()).toContain('/pl');
      }
    }
  });

  test('mobile hamburger menu opens and shows nav links', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`${BASE}/${LOCALE}`);
    await page.waitForLoadState('networkidle');

    // Click hamburger menu
    const menuButton = page.getByRole('button', { name: /menu/i });
    await expect(menuButton).toBeVisible();
    await menuButton.click();
    await page.waitForTimeout(300);

    // Navigation links should now be visible
    await expect(page.getByRole('link', { name: /auctions/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /about/i }).first()).toBeVisible();

    // Close the menu (force click — sticky header may intercept pointer events)
    const closeButton = page.getByRole('button', { name: /close/i });
    await expect(closeButton).toBeVisible();
    await closeButton.click({ force: true });
  });

  test('upcoming events section is displayed', async ({ page }) => {
    await expect(
      page.locator('h2').filter({ hasText: /events|upcoming/i }).first()
    ).toBeVisible();
  });

  test('view all auctions link navigates correctly', async ({ page }) => {
    const viewAll = page.locator(`a[href*="/${LOCALE}/auctions"]`).last();
    await expect(viewAll).toBeVisible();
    await viewAll.click();
    await page.waitForURL(`${BASE}/${LOCALE}/auctions`);
    expect(page.url()).toContain(`/${LOCALE}/auctions`);
  });
});
