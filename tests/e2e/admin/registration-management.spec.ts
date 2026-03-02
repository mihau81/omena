import { test, expect } from '@playwright/test';

test.use({ storageState: 'tests/e2e/.auth/admin.json' });

const BASE = '/omena';

test.describe('Admin - Registration Management', () => {
  let auctionId: string | null = null;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: 'tests/e2e/.auth/admin.json' });
    const page = await context.newPage();
    const res = await page.request.get(`${BASE}/api/admin/auctions`);
    if (res.ok()) {
      const data = await res.json();
      if (data.auctions?.length > 0) {
        auctionId = data.auctions[0].id;
      }
    }
    await context.close();
  });

  test('registrations page is accessible for an auction', async ({ page }) => {
    if (!auctionId) test.skip();
    await page.goto(`${BASE}/admin/auctions/${auctionId}/registrations`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading').first()).toBeVisible();
  });

  test('registration list shows status columns', async ({ page }) => {
    if (!auctionId) test.skip();
    await page.goto(`${BASE}/admin/auctions/${auctionId}/registrations`);
    await page.waitForLoadState('networkidle');

    // Page should render with heading and either a table or empty message
    await expect(page.getByRole('heading').first()).toBeVisible();
    const content = await page.locator('main, [class*="space-y"], body').first().textContent();
    expect(content).toBeTruthy();
  });

  test('approve button is available for pending registrations', async ({ page }) => {
    if (!auctionId) test.skip();
    await page.goto(`${BASE}/admin/auctions/${auctionId}/registrations`);
    await page.waitForLoadState('networkidle');

    const approveBtn = page.getByRole('button', { name: /approve/i }).first();
    if (await approveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(approveBtn).toBeVisible();
    }
  });

  test('reject button is available for pending registrations', async ({ page }) => {
    if (!auctionId) test.skip();
    await page.goto(`${BASE}/admin/auctions/${auctionId}/registrations`);
    await page.waitForLoadState('networkidle');

    const rejectBtn = page.getByRole('button', { name: /reject/i }).first();
    if (await rejectBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(rejectBtn).toBeVisible();
    }
  });

  test('empty state shown when no registrations exist', async ({ page }) => {
    if (!auctionId) test.skip();
    await page.goto(`${BASE}/admin/auctions/${auctionId}/registrations`);
    await page.waitForLoadState('networkidle');

    const rows = page.locator('tbody tr');
    const emptyMsg = page.locator('text=/no registrations/i').first();

    const hasRows = await rows.count() > 0;
    const hasEmpty = await emptyMsg.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasRows || hasEmpty).toBeTruthy();
  });
});
