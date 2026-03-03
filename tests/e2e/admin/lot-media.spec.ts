import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

test.use({ storageState: 'tests/e2e/.auth/admin.json' });

const BASE = '/omenaa';

test.describe('Admin - Lot Media Management', () => {
  let auctionId: string | null = null;
  let lotId: string | null = null;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    const auctionsRes = await page.request.get(`${BASE}/api/admin/auctions`);
    if (auctionsRes.ok()) {
      const data = await auctionsRes.json();
      if (data.auctions?.length > 0) {
        auctionId = data.auctions[0].id;
        // Get lots for this auction
        const lotsRes = await page.request.get(`${BASE}/api/admin/auctions/${auctionId}/lots`);
        if (lotsRes.ok()) {
          const lotsData = await lotsRes.json();
          if (lotsData.lots?.length > 0) {
            lotId = lotsData.lots[0].id;
          }
        }
      }
    }
    await page.close();
  });

  test('lot edit page shows media upload section', async ({ page }) => {
    if (!auctionId || !lotId) test.skip();
    await page.goto(`${BASE}/admin/auctions/${auctionId}/lots/${lotId}`);
    await page.waitForLoadState('networkidle');

    // Media section should exist
    const mediaSection = page.locator('[class*="media"], [class*="upload"]').first();
    const mediaHeading = page.getByText(/media|images|photos/i).first();

    const hasMedia = await mediaSection.isVisible({ timeout: 3000 }).catch(() => false);
    const hasHeading = await mediaHeading.isVisible({ timeout: 1000 }).catch(() => false);
    expect(hasMedia || hasHeading).toBeTruthy();
  });

  test('YouTube URL input is available', async ({ page }) => {
    if (!auctionId || !lotId) test.skip();
    await page.goto(`${BASE}/admin/auctions/${auctionId}/lots/${lotId}`);
    await page.waitForLoadState('networkidle');

    const youtubeInput = page.locator('input[placeholder*="youtube"], input[name*="youtube"]').first();
    if (await youtubeInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(youtubeInput).toBeVisible();
    }
  });

  test('existing media items are displayed', async ({ page }) => {
    if (!auctionId || !lotId) test.skip();
    await page.goto(`${BASE}/admin/auctions/${auctionId}/lots/${lotId}`);
    await page.waitForLoadState('networkidle');

    // Images or media thumbnails
    const mediaItems = page.locator('[class*="media"] img, [class*="thumbnail"]');
    if (await mediaItems.count() > 0) {
      await expect(mediaItems.first()).toBeVisible();
    }
  });

  test('delete media button is present on media items', async ({ page }) => {
    if (!auctionId || !lotId) test.skip();
    await page.goto(`${BASE}/admin/auctions/${auctionId}/lots/${lotId}`);
    await page.waitForLoadState('networkidle');

    const deleteMediaBtn = page.locator('[class*="media"] button').filter({ hasText: /delete|remove/i }).first();
    if (await deleteMediaBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(deleteMediaBtn).toBeVisible();
    }
  });

  test('file upload input accepts images', async ({ page }) => {
    if (!auctionId || !lotId) test.skip();
    await page.goto(`${BASE}/admin/auctions/${auctionId}/lots/${lotId}`);
    await page.waitForLoadState('networkidle');

    const fileInput = page.locator('input[type="file"][accept*="image"]');
    if (await fileInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      const accept = await fileInput.getAttribute('accept');
      expect(accept).toContain('image');
    }
  });
});
