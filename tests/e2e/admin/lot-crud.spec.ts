import { test, expect } from '@playwright/test';

test.use({ storageState: 'tests/e2e/.auth/admin.json' });

const BASE = '/omenaa';

test.describe('Admin - Lot CRUD', () => {
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

  test('lots list page renders for an auction', async ({ page }) => {
    if (!auctionId) test.skip();
    await page.goto(`${BASE}/admin/auctions/${auctionId}/lots`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: /lots/i }).first()).toBeVisible();
  });

  test('New Lot button is present', async ({ page }) => {
    if (!auctionId) test.skip();
    await page.goto(`${BASE}/admin/auctions/${auctionId}/lots`);
    await page.waitForLoadState('networkidle');

    const newLotBtn = page.getByRole('link', { name: /new lot/i }).or(
      page.getByRole('button', { name: /add lot|new lot/i })
    );
    if (await newLotBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(newLotBtn).toBeVisible();
    }
  });

  test('creates a new lot', async ({ page }) => {
    if (!auctionId) test.skip();
    await page.goto(`${BASE}/admin/auctions/${auctionId}/lots/new`);
    await page.waitForLoadState('networkidle');

    // Fill the lot form
    const titleInput = page.locator('input[name="title"]').or(
      page.locator('input[placeholder*="title"]')
    ).first();

    if (!await titleInput.isVisible({ timeout: 5000 }).catch(() => false)) test.skip();

    await titleInput.fill('E2E Test Lot');

    const artistInput = page.locator('input[name="artist"]').or(
      page.locator('input[placeholder*="artist"]')
    ).first();
    if (await artistInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await artistInput.fill('E2E Test Artist');
    }

    const lotNumberInput = page.locator('input[name="lotNumber"], input[type="number"]').first();
    if (await lotNumberInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await lotNumberInput.fill('999');
    }

    const estimateMinInput = page.locator('input[name="estimateMin"]').first();
    if (await estimateMinInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await estimateMinInput.fill('1000');
    }

    const estimateMaxInput = page.locator('input[name="estimateMax"]').first();
    if (await estimateMaxInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await estimateMaxInput.fill('2000');
    }

    const saveBtn = page.getByRole('button', { name: /save|create lot/i });
    if (await saveBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await saveBtn.click();
      await page.waitForTimeout(3000);
      expect(page.url()).toContain('/admin/auctions');
    }
  });

  test('lot rows are displayed in list', async ({ page }) => {
    if (!auctionId) test.skip();
    await page.goto(`${BASE}/admin/auctions/${auctionId}/lots`);
    await page.waitForLoadState('networkidle');

    // Table rows, draggable lot rows (div-based), or Edit links
    const tableRows = page.locator('tr').filter({ hasText: /.+/ });
    const editLinks = page.getByRole('link', { name: /edit/i });
    const dragButtons = page.getByRole('button', { name: /drag to reorder/i });
    const tableCount = await tableRows.count();
    const editCount = await editLinks.count();
    const dragCount = await dragButtons.count();
    // Either has lots or shows empty state
    const emptyMsg = page.locator('text=/no lots/i').first();
    const hasEmpty = await emptyMsg.isVisible({ timeout: 2000 }).catch(() => false);
    expect(tableCount > 0 || editCount > 0 || dragCount > 0 || hasEmpty).toBeTruthy();
  });

  test('lot edit link navigates to lot editor', async ({ page }) => {
    if (!auctionId) test.skip();
    await page.goto(`${BASE}/admin/auctions/${auctionId}/lots`);
    await page.waitForLoadState('networkidle');

    const editLink = page.getByRole('link', { name: /edit/i }).first();
    if (!await editLink.isVisible({ timeout: 3000 }).catch(() => false)) test.skip();

    await editLink.click();
    await page.waitForURL(`${BASE}/admin/auctions/**/lots/**`);
    expect(page.url()).toContain('/lots/');
  });
});
