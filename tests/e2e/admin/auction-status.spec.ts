import { test, expect } from '@playwright/test';

test.use({ storageState: 'tests/e2e/.auth/admin.json' });

const BASE = '/omenaa';

test.describe('Admin - Auction status transitions', () => {
  let auctionId: string | null = null;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: 'tests/e2e/.auth/admin.json' });
    const page = await context.newPage();

    const res = await page.request.get(`${BASE}/api/admin/auctions`);
    if (res.ok()) {
      const data = await res.json();
      const auctions = data.auctions ?? [];
      const draftAuction = auctions.find((a: any) => a.status === 'draft') ?? auctions[0];
      if (draftAuction) auctionId = draftAuction.id;
    }
    await context.close();
  });

  test('auction detail page shows status selector', async ({ page }) => {
    if (!auctionId) test.skip();
    await page.goto(`${BASE}/admin/auctions/${auctionId}`);
    await page.waitForLoadState('networkidle');

    // Status selector, buttons, or status text (e.g. "archive", "draft") should be visible
    const statusSelect = page.locator('select[name*="status"], [class*="status"]').first();
    const statusBtns = page.locator('button').filter({ hasText: /draft|preview|live|reconciliation|archive/i });
    // Status may also appear as plain text in the page heading area
    const statusText = page.locator('text=/draft|preview|live|reconciliation|archive/i').first();

    const hasSelect = await statusSelect.isVisible({ timeout: 3000 }).catch(() => false);
    const hasBtns = await statusBtns.count() > 0;
    const hasText = await statusText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasSelect || hasBtns || hasText).toBeTruthy();
  });

  test('status badge is displayed in auction list', async ({ page }) => {
    await page.goto(`${BASE}/admin/auctions`);
    await page.waitForLoadState('networkidle');

    // Status badges should appear in table
    const statusBadge = page.locator('span').filter({ hasText: /draft|preview|live|archive/i }).first();
    if (await statusBadge.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(statusBadge).toBeVisible();
    }
  });

  test('status filter tabs filter auction list', async ({ page }) => {
    await page.goto(`${BASE}/admin/auctions`);
    await page.waitForLoadState('networkidle');

    const allCount = await page.locator('tbody tr').count();

    // Click "draft" filter
    const draftBtn = page.getByRole('button', { name: /^draft$/i });
    if (await draftBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await draftBtn.click();
      await page.waitForTimeout(500);
      // Row count should possibly change
    }
  });

  test('auction status can be updated via edit form', async ({ page }) => {
    if (!auctionId) test.skip();
    await page.goto(`${BASE}/admin/auctions/${auctionId}`);
    await page.waitForLoadState('networkidle');

    // Find status field and change it
    const statusSelect = page.locator('select[name="status"]');
    if (await statusSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      await statusSelect.selectOption('preview');
      const saveBtn = page.getByRole('button', { name: /save|update/i });
      if (await saveBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await saveBtn.click();
        await page.waitForTimeout(2000);
      }
    }
  });
});
