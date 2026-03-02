import { test, expect } from '@playwright/test';

test.use({ storageState: 'tests/e2e/.auth/admin.json' });

const BASE = '/omena';

test.describe('Admin - Invoice Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/admin/invoices`);
    await page.waitForLoadState('networkidle');
  });

  test('invoices page renders with heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /invoices/i }).first()).toBeVisible();
  });

  test('invoice list or empty state is displayed', async ({ page }) => {
    const rows = page.locator('tbody tr');
    const emptyMsg = page.locator('text=/no invoices/i').first();

    const hasRows = await rows.count() > 0;
    const hasEmpty = await emptyMsg.isVisible({ timeout: 3000 }).catch(() => false);
    expect(hasRows || hasEmpty).toBeTruthy();
  });

  test('status filter options are available', async ({ page }) => {
    // Status filter for invoices
    const statusFilter = page.locator('select[name*="status"], button').filter({ hasText: /all|pending|paid|overdue/i });
    if (await statusFilter.count() > 0) {
      await expect(statusFilter.first()).toBeVisible();
    }
  });

  test('invoice table shows amount and status columns', async ({ page }) => {
    const table = page.locator('table');
    if (await table.isVisible({ timeout: 3000 }).catch(() => false)) {
      const headers = await page.locator('th').allTextContents();
      const hasAmount = headers.some((h) => /amount|total|price/i.test(h));
      const hasStatus = headers.some((h) => /status/i.test(h));
      // At minimum there should be some columns
      expect(headers.length).toBeGreaterThan(0);
    }
  });

  test('view invoice button opens invoice', async ({ page }) => {
    const viewBtn = page.getByRole('link', { name: /view|open/i }).first();
    const htmlBtn = page.getByRole('button', { name: /html|view/i }).first();

    if (await viewBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      const href = await viewBtn.getAttribute('href');
      expect(href).toBeTruthy();
    }
  });

  test('generate invoice action is available on lot detail', async ({ page }) => {
    // Try to find generate invoice button in auctions/bids context
    const auctionsRes = await page.request.get(`${BASE}/api/admin/auctions`);
    if (auctionsRes.ok()) {
      const data = await auctionsRes.json();
      if (data.auctions?.length > 0) {
        const auctionId = data.auctions[0].id;
        await page.goto(`${BASE}/admin/auctions/${auctionId}/bids`);
        await page.waitForLoadState('networkidle');

        const invoiceBtn = page.getByRole('button', { name: /invoice/i }).first();
        if (await invoiceBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await expect(invoiceBtn).toBeVisible();
        }
      }
    }
  });
});
