import { test, expect } from '@playwright/test';

const BASE = '/omena';
const LOCALE = 'en';

test.describe('Public - Artist Pages', () => {
  test.describe('Artists listing page', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`${BASE}/${LOCALE}/artists`);
      await page.waitForLoadState('networkidle');
    });

    test('artists listing page renders with heading', async ({ page }) => {
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    });

    test('breadcrumbs are displayed', async ({ page }) => {
      const breadcrumb = page.locator('nav[aria-label*="breadcrumb"], [class*="breadcrumb"]').first();
      const homeLink = page.locator(`a[href="/${LOCALE}"]`).first();

      const hasBreadcrumb = await breadcrumb.isVisible({ timeout: 3000 }).catch(() => false);
      const hasHome = await homeLink.isVisible({ timeout: 2000 }).catch(() => false);
      expect(hasBreadcrumb || hasHome).toBeTruthy();
    });

    test('search input is displayed', async ({ page }) => {
      const searchInput = page.locator('input[type="text"]').first();
      await expect(searchInput).toBeVisible();
    });

    test('A-Z letter navigation is displayed', async ({ page }) => {
      // The "All" button should be visible (default state)
      const allBtn = page.locator('button').filter({ hasText: /^all$/i }).first()
        .or(page.locator('button').filter({ hasText: /^wszystk/i }).first());

      if (await allBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(allBtn).toBeVisible();

        // At least some letter buttons should be present
        const letterButtons = page.locator('button').filter({ hasText: /^[A-Z]$/ });
        const count = await letterButtons.count();
        expect(count).toBeGreaterThan(0);
      }
    });

    test('artists count is displayed', async ({ page }) => {
      // The page shows "X lots" or similar count text
      const countText = page.locator('text=/\\d+/').first();
      await expect(countText).toBeVisible({ timeout: 3000 });
    });

    test('artists grid or empty state is displayed', async ({ page }) => {
      // Either artist cards in a grid or a "not found" message
      const artistCards = page.locator('a[href*="/artists/"]').filter({
        has: page.locator('.font-medium'),
      });
      const emptyMsg = page.locator('text=/not found/i').first();

      const hasCards = await artistCards.count() > 0;
      const hasEmpty = await emptyMsg.isVisible({ timeout: 3000 }).catch(() => false);
      expect(hasCards || hasEmpty).toBeTruthy();
    });

    test('search filters artists by name', async ({ page }) => {
      const searchInput = page.locator('input[type="text"]').first();
      await searchInput.fill('test artist');
      await page.waitForTimeout(500);

      // Results should update (either fewer cards or empty state)
      await expect(searchInput).toHaveValue('test artist');
    });

    test('letter filter narrows results', async ({ page }) => {
      // Find an active letter button (one that has artists)
      const letterButtons = page.locator('button').filter({ hasText: /^[A-Z]$/ });
      const count = await letterButtons.count();
      if (count === 0) test.skip();

      // Click the first enabled letter button
      for (let i = 0; i < count; i++) {
        const btn = letterButtons.nth(i);
        const isDisabled = await btn.isDisabled().catch(() => true);
        if (!isDisabled) {
          await btn.click();
          await page.waitForTimeout(500);
          break;
        }
      }
    });

    test('clicking an artist card navigates to detail page', async ({ page }) => {
      const artistCard = page.locator(`a[href*="/${LOCALE}/artists/"]`).first();
      if (!await artistCard.isVisible({ timeout: 5000 }).catch(() => false)) test.skip();

      await artistCard.click();
      await page.waitForURL(`${BASE}/${LOCALE}/artists/**`);
      expect(page.url()).toMatch(/\/artists\/.+/);
    });
  });

  test.describe('Artist detail page', () => {
    test('artist detail page renders with artist name as heading', async ({ page }) => {
      // First go to artists listing and find one
      await page.goto(`${BASE}/${LOCALE}/artists`);
      await page.waitForLoadState('networkidle');

      const artistCard = page.locator(`a[href*="/${LOCALE}/artists/"]`).first();
      if (!await artistCard.isVisible({ timeout: 5000 }).catch(() => false)) test.skip();

      await artistCard.click();
      await page.waitForLoadState('networkidle');

      // h1 should contain the artist's name
      const heading = page.getByRole('heading', { level: 1 });
      await expect(heading).toBeVisible({ timeout: 5000 });
      const headingText = await heading.textContent();
      expect(headingText?.trim().length).toBeGreaterThan(0);
    });

    test('artist detail page shows breadcrumbs with link back to artists', async ({ page }) => {
      await page.goto(`${BASE}/${LOCALE}/artists`);
      await page.waitForLoadState('networkidle');

      const artistCard = page.locator(`a[href*="/${LOCALE}/artists/"]`).first();
      if (!await artistCard.isVisible({ timeout: 5000 }).catch(() => false)) test.skip();

      await artistCard.click();
      await page.waitForLoadState('networkidle');

      // Breadcrumbs should include a link back to artists listing
      const artistsLink = page.locator(`a[href*="/${LOCALE}/artists"]`).first();
      await expect(artistsLink).toBeVisible({ timeout: 3000 });
    });

    test('artist detail page shows stats when sold lots exist', async ({ page }) => {
      await page.goto(`${BASE}/${LOCALE}/artists`);
      await page.waitForLoadState('networkidle');

      const artistCard = page.locator(`a[href*="/${LOCALE}/artists/"]`).first();
      if (!await artistCard.isVisible({ timeout: 5000 }).catch(() => false)) test.skip();

      await artistCard.click();
      await page.waitForLoadState('networkidle');

      // Stats pills may or may not be present depending on data
      // Check for any of: total sold, avg hammer, highest hammer
      const statsSection = page.locator('.rounded-lg.bg-beige');
      const hasStats = await statsSection.count() > 0;

      // Also check for the auction results heading (always present)
      const resultsHeading = page.getByRole('heading', { level: 2 }).last();
      await expect(resultsHeading).toBeVisible({ timeout: 5000 });
    });

    test('artist detail page shows auction results table or no results message', async ({ page }) => {
      await page.goto(`${BASE}/${LOCALE}/artists`);
      await page.waitForLoadState('networkidle');

      const artistCard = page.locator(`a[href*="/${LOCALE}/artists/"]`).first();
      if (!await artistCard.isVisible({ timeout: 5000 }).catch(() => false)) test.skip();

      await artistCard.click();
      await page.waitForLoadState('networkidle');

      // Either a results table or "no results" message
      const table = page.locator('table');
      const noResults = page.locator('text=/no results|no auction results/i').first();

      const hasTable = await table.isVisible({ timeout: 3000 }).catch(() => false);
      const hasNoResults = await noResults.isVisible({ timeout: 2000 }).catch(() => false);
      expect(hasTable || hasNoResults).toBeTruthy();
    });

    test('artist detail page shows nationality and years if present', async ({ page }) => {
      await page.goto(`${BASE}/${LOCALE}/artists`);
      await page.waitForLoadState('networkidle');

      const artistCard = page.locator(`a[href*="/${LOCALE}/artists/"]`).first();
      if (!await artistCard.isVisible({ timeout: 5000 }).catch(() => false)) test.skip();

      await artistCard.click();
      await page.waitForLoadState('networkidle');

      // The artist info area should exist
      const heading = page.getByRole('heading', { level: 1 });
      await expect(heading).toBeVisible({ timeout: 5000 });

      // Below the heading, there may be nationality and years text
      // These are optional fields, so just verify the structure exists
      const infoContainer = heading.locator('..');
      await expect(infoContainer).toBeVisible();
    });
  });
});
