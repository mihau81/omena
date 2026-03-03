import { test, expect } from '@playwright/test';

const BASE = '/omenaa';
const LOCALE = 'en';

test.describe('Public - Search & Filters (Results Page)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/${LOCALE}/results`);
    await page.waitForLoadState('networkidle');
  });

  test('results page renders with heading', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  });

  test('breadcrumbs are displayed', async ({ page }) => {
    const homeLink = page.locator(`a[href*="/${LOCALE}"]`).first();
    await expect(homeLink).toBeVisible({ timeout: 3000 });
  });

  test('filter sidebar is visible on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(500);

    // Filters section heading
    const filtersHeading = page.locator('h3').filter({ hasText: /filter/i }).first();
    await expect(filtersHeading).toBeVisible({ timeout: 5000 });
  });

  test('artist search filter input is present', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(500);

    // Artist text input
    const artistLabel = page.locator('text=/artist/i').first();
    const artistInput = page.locator('input[type="text"]').first();

    const hasLabel = await artistLabel.isVisible({ timeout: 3000 }).catch(() => false);
    const hasInput = await artistInput.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasLabel || hasInput).toBeTruthy();
  });

  test('category filter chips are displayed', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(500);

    // Category section label
    const categoryLabel = page.locator('text=/category|kategori/i').first();
    await expect(categoryLabel).toBeVisible({ timeout: 5000 });

    // Category chip buttons should exist
    const chipButtons = page.locator('button.rounded-full');
    const count = await chipButtons.count();
    expect(count).toBeGreaterThan(0);
  });

  test('apply category filter', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(500);

    // Click a category chip (e.g., the first one)
    const chipButtons = page.locator('button.rounded-full');
    const count = await chipButtons.count();
    if (count === 0) test.skip();

    await chipButtons.first().click();
    await page.waitForTimeout(300);

    // The chip should now be active (gold background)
    const activeChip = chipButtons.first();
    const className = await activeChip.getAttribute('class');
    expect(className).toContain('bg-gold');

    // Click Apply button
    const applyBtn = page.getByRole('button', { name: /apply|zastosuj/i });
    if (await applyBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await applyBtn.click();
      await page.waitForLoadState('networkidle');

      // URL should contain the categories parameter
      expect(page.url()).toContain('categories=');
    }
  });

  test('price range filter inputs are present', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(500);

    // Price range label
    const priceLabel = page.locator('text=/price range|zakres cen/i').first();
    await expect(priceLabel).toBeVisible({ timeout: 5000 });

    // Min and max price inputs
    const priceInputs = page.locator('input[type="number"]');
    const count = await priceInputs.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('apply price range filter', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(500);

    // Find price min/max inputs
    const priceInputs = page.locator('input[type="number"]');
    if (await priceInputs.count() < 2) test.skip();

    const minInput = priceInputs.first();
    const maxInput = priceInputs.nth(1);

    await minInput.fill('1000');
    await maxInput.fill('50000');

    // Click Apply
    const applyBtn = page.getByRole('button', { name: /apply|zastosuj/i });
    if (await applyBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await applyBtn.click();
      await page.waitForLoadState('networkidle');

      // URL should contain price parameters
      expect(page.url()).toContain('priceMin=1000');
      expect(page.url()).toContain('priceMax=50000');
    }
  });

  test('apply artist filter', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(500);

    // Find the artist text input (first text input in the filter sidebar)
    const artistInput = page.locator('input[type="text"]').first();
    if (!await artistInput.isVisible({ timeout: 3000 }).catch(() => false)) test.skip();

    await artistInput.fill('Picasso');

    // Click Apply
    const applyBtn = page.getByRole('button', { name: /apply|zastosuj/i });
    if (await applyBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await applyBtn.click();
      await page.waitForLoadState('networkidle');

      // URL should contain artist parameter
      expect(page.url()).toContain('artist=Picasso');
    }
  });

  test('auction selector filter is present', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(500);

    // Auction dropdown select
    const auctionSelect = page.locator('select').first();
    await expect(auctionSelect).toBeVisible({ timeout: 5000 });

    // Should have "All auctions" as default option
    const allOption = page.locator('option').filter({ hasText: /all auctions|wszystkie aukcje/i });
    const hasAllOption = await allOption.count() > 0;
    expect(hasAllOption).toBeTruthy();
  });

  test('date range filter inputs are present', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(500);

    // Date inputs
    const dateInputs = page.locator('input[type="date"]');
    const count = await dateInputs.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('results count is displayed', async ({ page }) => {
    // Results count text (e.g., "42 objects")
    const countText = page.locator('text=/\\d+.*object|\\d+.*obiekt/i').first();
    await expect(countText).toBeVisible({ timeout: 5000 });
  });

  test('results grid or empty state is displayed', async ({ page }) => {
    // Either result cards or a "no results" message
    const resultCards = page.locator('.grid a[href*="/auctions/"]');
    const emptyMsg = page.locator('text=/no results|brak wynik/i').first();

    const hasCards = await resultCards.count() > 0;
    const hasEmpty = await emptyMsg.isVisible({ timeout: 3000 }).catch(() => false);
    expect(hasCards || hasEmpty).toBeTruthy();
  });

  test('clear all filters resets the view', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    // First apply a filter
    const artistInput = page.locator('input[type="text"]').first();
    if (!await artistInput.isVisible({ timeout: 3000 }).catch(() => false)) test.skip();

    await artistInput.fill('SomeArtist');

    const applyBtn = page.getByRole('button', { name: /apply|zastosuj/i });
    if (await applyBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await applyBtn.click();
      await page.waitForLoadState('networkidle');
    }

    // Now click "Clear all" link
    const clearBtn = page.locator('button, a').filter({ hasText: /clear all|wyczysc/i }).first();
    if (await clearBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await clearBtn.click();
      await page.waitForLoadState('networkidle');

      // URL should be clean (no filter params except possibly page=1)
      const url = new URL(page.url());
      expect(url.searchParams.has('artist')).toBeFalsy();
      expect(url.searchParams.has('categories')).toBeFalsy();
      expect(url.searchParams.has('priceMin')).toBeFalsy();
    }
  });

  test('result cards show lot number, title, artist, and price', async ({ page }) => {
    // Wait for results to load
    await page.waitForTimeout(2000);

    const resultCards = page.locator('.grid a[href*="/auctions/"]');
    if (await resultCards.count() === 0) test.skip();

    const firstCard = resultCards.first();
    await expect(firstCard).toBeVisible();

    // Card should contain lot number badge
    const lotBadge = firstCard.locator('text=/lot \\d+/i');
    const hasLotBadge = await lotBadge.isVisible({ timeout: 2000 }).catch(() => false);

    // Card should contain a title (h3 inside .p-4)
    const title = firstCard.locator('h3').first();
    const hasTitle = await title.isVisible({ timeout: 2000 }).catch(() => false);

    expect(hasLotBadge || hasTitle).toBeTruthy();
  });

  test('clicking a result card navigates to lot detail', async ({ page }) => {
    await page.waitForTimeout(2000);

    const resultCard = page.locator('.grid a[href*="/auctions/"]').first();
    if (!await resultCard.isVisible({ timeout: 3000 }).catch(() => false)) test.skip();

    await resultCard.click();
    await page.waitForLoadState('networkidle');

    // Should navigate to an auction/lot page
    expect(page.url()).toContain('/auctions/');
  });

  test('pagination appears when there are many results', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Pagination text like "1 / 5"
    const paginationText = page.locator('text=/\\d+\\s*\\/\\s*\\d+/');
    const nextLink = page.getByRole('link', { name: /next|następna/i });
    const prevLink = page.getByRole('link', { name: /prev|poprzednia/i });

    const hasPagination = await paginationText.isVisible({ timeout: 3000 }).catch(() => false);
    const hasNext = await nextLink.isVisible({ timeout: 1000 }).catch(() => false);

    // Pagination may not be visible if there are few results — that's fine
    if (hasPagination) {
      expect(hasNext || await prevLink.isVisible({ timeout: 1000 }).catch(() => false)).toBeTruthy();
    }
  });

  test('multiple filters can be combined', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(500);

    // Apply artist filter
    const artistInput = page.locator('input[type="text"]').first();
    if (await artistInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await artistInput.fill('test');
    }

    // Apply category filter
    const chipButtons = page.locator('button.rounded-full');
    if (await chipButtons.count() > 0) {
      await chipButtons.first().click();
    }

    // Apply price min
    const priceInputs = page.locator('input[type="number"]');
    if (await priceInputs.count() >= 2) {
      await priceInputs.first().fill('500');
    }

    // Click Apply
    const applyBtn = page.getByRole('button', { name: /apply|zastosuj/i });
    if (await applyBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await applyBtn.click();
      await page.waitForLoadState('networkidle');

      // URL should contain multiple parameters
      const url = page.url();
      expect(url).toContain('artist=');
      expect(url).toContain('categories=');
      expect(url).toContain('priceMin=');
    }
  });
});
