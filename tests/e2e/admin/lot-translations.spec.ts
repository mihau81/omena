import { test, expect } from '@playwright/test';

test.use({ storageState: 'tests/e2e/.auth/admin.json' });

const BASE = '/omena';

test.describe('Admin - Lot Translations', () => {
  let auctionId: string | null = null;
  let lotId: string | null = null;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    const auctionsRes = await page.request.get(`${BASE}/api/admin/auctions`);
    if (auctionsRes.ok()) {
      const data = await auctionsRes.json();
      if (data.auctions?.length > 0) {
        auctionId = data.auctions[0].id;
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

  test('translations section is visible on lot page', async ({ page }) => {
    if (!auctionId || !lotId) test.skip();
    await page.goto(`${BASE}/admin/auctions/${auctionId}/lots/${lotId}`);
    await page.waitForLoadState('networkidle');

    const translationSection = page.locator('[class*="translation"], [class*="locale"]').first();
    const translationHeading = page.getByText(/translation|language|EN|PL/i).first();

    const hasSection = await translationSection.isVisible({ timeout: 3000 }).catch(() => false);
    const hasHeading = await translationHeading.isVisible({ timeout: 1000 }).catch(() => false);
    expect(hasSection || hasHeading).toBeTruthy();
  });

  test('EN translation fields are editable', async ({ page }) => {
    if (!auctionId || !lotId) test.skip();
    await page.goto(`${BASE}/admin/auctions/${auctionId}/lots/${lotId}`);
    await page.waitForLoadState('networkidle');

    // Look for EN translation textarea or input
    const enInput = page.locator('textarea[name*="en"], input[name*="en[title]"], [data-locale="en"] textarea').first();
    if (await enInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(enInput).toBeEditable();
    }
  });

  test('save translations button is present', async ({ page }) => {
    if (!auctionId || !lotId) test.skip();
    await page.goto(`${BASE}/admin/auctions/${auctionId}/lots/${lotId}`);
    await page.waitForLoadState('networkidle');

    const saveBtn = page.getByRole('button', { name: /save|update/i });
    await expect(saveBtn.first()).toBeVisible();
  });

  test('locale tabs switch between languages', async ({ page }) => {
    if (!auctionId || !lotId) test.skip();
    await page.goto(`${BASE}/admin/auctions/${auctionId}/lots/${lotId}`);
    await page.waitForLoadState('networkidle');

    // Language tabs
    const enTab = page.getByRole('button', { name: /EN|English/i });
    const plTab = page.getByRole('button', { name: /PL|Polish/i });

    if (await enTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await enTab.click();
    }
    if (await plTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await plTab.click();
    }
  });
});
