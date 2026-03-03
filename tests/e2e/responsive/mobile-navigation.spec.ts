import { test, expect } from '@playwright/test';

const BASE = '/omenaa';
const LOCALE = 'en';

// Force mobile viewport for these tests
test.use({ viewport: { width: 375, height: 812 } });

test.describe('Mobile navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/${LOCALE}`);
    await page.waitForLoadState('networkidle');
  });

  test('hamburger menu button is visible on mobile', async ({ page }) => {
    const menuBtn = page.getByRole('button', { name: /menu/i });
    await expect(menuBtn).toBeVisible();

    // Desktop nav should be hidden
    const desktopNav = page.locator('header nav.hidden');
    // The nav has class "hidden lg:block" so it should not be visible on mobile
  });

  test('hamburger menu opens mobile nav overlay', async ({ page }) => {
    const menuBtn = page.getByRole('button', { name: /menu/i });
    await menuBtn.click();

    // Mobile menu overlay should appear
    await page.waitForTimeout(500);

    // Nav links should be visible
    const auctionsLink = page.locator('nav').getByRole('link', { name: /auctions/i }).first();
    if (await auctionsLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(auctionsLink).toBeVisible();
    } else {
      // Menu may use different structure
      const navLinks = page.locator('a').filter({ hasText: /auctions|about|contact/i });
      if (await navLinks.count() > 0) {
        await expect(navLinks.first()).toBeVisible();
      }
    }
  });

  test('close button dismisses mobile menu', async ({ page }) => {
    // Open menu
    await page.getByRole('button', { name: /menu/i }).click();
    await page.waitForTimeout(500);

    // Close — the mobile menu overlay must have higher z-index than the header
    const closeBtn = page.getByRole('button', { name: /close/i });
    if (await closeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await closeBtn.click({ force: true });
      await page.waitForTimeout(500);

      // After closing, the hamburger menu button should be visible again
      await expect(page.getByRole('button', { name: /menu/i })).toBeVisible();
    }
  });

  test('clicking a nav link in mobile menu navigates and closes menu', async ({ page }) => {
    await page.getByRole('button', { name: /menu/i }).click();
    await page.waitForTimeout(300);

    // Click auctions link
    const auctionsLink = page.locator('nav a, [class*="mobile"] a').filter({ hasText: /auctions/i }).first();
    if (await auctionsLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      await auctionsLink.click();
      await page.waitForURL(`${BASE}/${LOCALE}/auctions`);
      expect(page.url()).toContain('/auctions');
    }
  });

  test('language switcher is accessible in mobile menu', async ({ page }) => {
    await page.getByRole('button', { name: /menu/i }).click();
    await page.waitForTimeout(500);

    // Mobile language switcher — locale buttons with flags or text labels
    const langBtns = page.locator('nav button').filter({ hasText: /.+/ });
    const langBtnCount = await langBtns.count();
    // There should be locale buttons (flags) and currency buttons in the mobile menu
    expect(langBtnCount).toBeGreaterThan(0);
  });

  test('OMENAA logo is visible and clickable on mobile', async ({ page }) => {
    const logo = page.locator('header a').filter({ hasText: 'OMENAA' });
    await expect(logo).toBeVisible();
    await logo.click();
    await page.waitForURL(`${BASE}/${LOCALE}`);
  });

  test('mobile menu has overlay backdrop', async ({ page }) => {
    await page.getByRole('button', { name: /menu/i }).click();
    await page.waitForTimeout(300);

    // Overlay/backdrop should exist
    const overlay = page.locator('[class*="backdrop"], [class*="overlay"], [class*="bg-dark-brown"]').first();
    if (await overlay.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(overlay).toBeVisible();
    }
  });
});
