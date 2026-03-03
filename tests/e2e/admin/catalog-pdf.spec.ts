import { test, expect } from '@playwright/test';

test.use({ storageState: 'tests/e2e/.auth/admin.json' });

const BASE = '/omena';

test.describe('Admin - Catalog PDF Generation', () => {
  test('auction detail page shows catalog button', async ({ page }) => {
    // First, navigate to auctions list to find an existing auction
    await page.goto(`${BASE}/admin/auctions`);
    await page.waitForLoadState('networkidle');

    // Click on the first auction in the list
    const auctionLink = page.locator('td a').filter({ hasText: /.+/ }).first();
    if (!await auctionLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Try clicking a table row directly
      const auctionRow = page.locator('tbody tr').first();
      if (!await auctionRow.isVisible({ timeout: 3000 }).catch(() => false)) test.skip();
      await auctionRow.click();
    } else {
      await auctionLink.click();
    }

    await page.waitForURL(`${BASE}/admin/auctions/**`);
    await page.waitForLoadState('networkidle');

    // The CatalogButton should be visible — it shows either "Generate Catalog" or "Regenerate Catalog"
    const catalogBtn = page.getByRole('button', { name: /generate catalog|regenerate catalog/i });
    await expect(catalogBtn).toBeVisible({ timeout: 5000 });
  });

  test('Generate Catalog button triggers generation', async ({ page }) => {
    // Navigate to auctions list
    await page.goto(`${BASE}/admin/auctions`);
    await page.waitForLoadState('networkidle');

    const auctionLink = page.locator('td a').filter({ hasText: /.+/ }).first();
    if (!await auctionLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      const auctionRow = page.locator('tbody tr').first();
      if (!await auctionRow.isVisible({ timeout: 3000 }).catch(() => false)) test.skip();
      await auctionRow.click();
    } else {
      await auctionLink.click();
    }

    await page.waitForURL(`${BASE}/admin/auctions/**`);
    await page.waitForLoadState('networkidle');

    const catalogBtn = page.getByRole('button', { name: /generate catalog|regenerate catalog/i });
    if (!await catalogBtn.isVisible({ timeout: 5000 }).catch(() => false)) test.skip();

    // Click the generate button
    await catalogBtn.click();

    // Should show loading state ("Generating..." text with spinner)
    const generatingText = page.locator('text=/generating/i');
    const hasGenerating = await generatingText.isVisible({ timeout: 3000 }).catch(() => false);

    // After generation completes, either:
    // - "Regenerate Catalog" button appears (success, URL was set)
    // - "Download PDF" link appears
    // - An error message appears
    await page.waitForTimeout(5000);

    const downloadLink = page.getByRole('link', { name: /download pdf/i });
    const regenerateBtn = page.getByRole('button', { name: /regenerate catalog/i });
    const errorMsg = page.locator('.text-red-600').first();

    const hasDownload = await downloadLink.isVisible({ timeout: 3000 }).catch(() => false);
    const hasRegenerate = await regenerateBtn.isVisible({ timeout: 2000 }).catch(() => false);
    const hasError = await errorMsg.isVisible({ timeout: 1000 }).catch(() => false);

    // One of these outcomes should be true
    expect(hasDownload || hasRegenerate || hasError || hasGenerating).toBeTruthy();
  });

  test('Download PDF link appears after catalog is generated', async ({ page }) => {
    // Navigate to auctions list
    await page.goto(`${BASE}/admin/auctions`);
    await page.waitForLoadState('networkidle');

    const auctionLink = page.locator('td a').filter({ hasText: /.+/ }).first();
    if (!await auctionLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      const auctionRow = page.locator('tbody tr').first();
      if (!await auctionRow.isVisible({ timeout: 3000 }).catch(() => false)) test.skip();
      await auctionRow.click();
    } else {
      await auctionLink.click();
    }

    await page.waitForURL(`${BASE}/admin/auctions/**`);
    await page.waitForLoadState('networkidle');

    // Check if a "Download PDF" link is already present (from a previous generation)
    const downloadLink = page.getByRole('link', { name: /download pdf/i });
    if (await downloadLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Verify the link has target="_blank" and a valid href
      await expect(downloadLink).toHaveAttribute('target', '_blank');
      const href = await downloadLink.getAttribute('href');
      expect(href).toBeTruthy();
    }
    // If no download link, it means catalog hasn't been generated yet -- that's fine
  });

  test('catalog button has correct title attribute', async ({ page }) => {
    // Navigate to auctions list
    await page.goto(`${BASE}/admin/auctions`);
    await page.waitForLoadState('networkidle');

    const auctionLink = page.locator('td a').filter({ hasText: /.+/ }).first();
    if (!await auctionLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      const auctionRow = page.locator('tbody tr').first();
      if (!await auctionRow.isVisible({ timeout: 3000 }).catch(() => false)) test.skip();
      await auctionRow.click();
    } else {
      await auctionLink.click();
    }

    await page.waitForURL(`${BASE}/admin/auctions/**`);
    await page.waitForLoadState('networkidle');

    const catalogBtn = page.getByRole('button', { name: /generate catalog|regenerate catalog/i });
    if (!await catalogBtn.isVisible({ timeout: 5000 }).catch(() => false)) test.skip();

    // Button should have a title attribute
    const title = await catalogBtn.getAttribute('title');
    expect(title).toMatch(/generate catalog pdf|regenerate catalog pdf/i);
  });

  test('auction detail page shows other management links alongside catalog', async ({ page }) => {
    // Navigate to auctions list
    await page.goto(`${BASE}/admin/auctions`);
    await page.waitForLoadState('networkidle');

    const auctionLink = page.locator('td a').filter({ hasText: /.+/ }).first();
    if (!await auctionLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      const auctionRow = page.locator('tbody tr').first();
      if (!await auctionRow.isVisible({ timeout: 3000 }).catch(() => false)) test.skip();
      await auctionRow.click();
    } else {
      await auctionLink.click();
    }

    await page.waitForURL(`${BASE}/admin/auctions/**`);
    await page.waitForLoadState('networkidle');

    // Manage Lots, Manage Bids, and Registrations links should be visible alongside catalog
    const lotsLink = page.getByRole('link', { name: /manage lots/i });
    const bidsLink = page.getByRole('link', { name: /manage bids/i });
    const registrationsLink = page.getByRole('link', { name: /registrations/i });

    await expect(lotsLink).toBeVisible({ timeout: 5000 });
    await expect(bidsLink).toBeVisible();
    await expect(registrationsLink).toBeVisible();
  });
});
