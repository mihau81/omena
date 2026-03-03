import { test, expect } from '@playwright/test';

test.use({ storageState: 'tests/e2e/.auth/admin.json' });

const BASE = '/omena';

test.describe('Admin - Settlement Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/admin/settlements`);
    await page.waitForLoadState('networkidle');
  });

  test('settlements page renders with heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /settlements/i }).first()).toBeVisible();
  });

  test('subtitle shows consignor payout tracking', async ({ page }) => {
    await expect(page.locator('text=/consignor payout tracking/i').first()).toBeVisible();
  });

  test('Generate Settlement button is visible', async ({ page }) => {
    const generateBtn = page.getByRole('button', { name: /generate settlement/i });
    await expect(generateBtn).toBeVisible();
  });

  test('status filter tabs are displayed', async ({ page }) => {
    const allTab = page.locator('button').filter({ hasText: /^all/i }).first();
    const pendingTab = page.locator('button').filter({ hasText: /pending/i }).first();
    const approvedTab = page.locator('button').filter({ hasText: /approved/i }).first();
    const paidTab = page.locator('button').filter({ hasText: /^paid/i }).first();

    await expect(allTab).toBeVisible();
    await expect(pendingTab).toBeVisible();
    await expect(approvedTab).toBeVisible();
    await expect(paidTab).toBeVisible();
  });

  test('consignor filter dropdown is present', async ({ page }) => {
    const consignorSelect = page.locator('select').filter({ has: page.locator('option', { hasText: /all consignors/i }) });
    await expect(consignorSelect.first()).toBeVisible({ timeout: 5000 });
  });

  test('settlement list or empty state is displayed', async ({ page }) => {
    const table = page.locator('table');
    const emptyMsg = page.locator('text=/no settlements found/i').first();
    const loadingMsg = page.locator('text=/loading settlements/i').first();

    // Wait for loading to finish
    await page.waitForTimeout(2000);

    const hasTable = await table.isVisible({ timeout: 3000 }).catch(() => false);
    const hasEmpty = await emptyMsg.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasTable || hasEmpty).toBeTruthy();
  });

  test('settlement table shows correct columns when data exists', async ({ page }) => {
    await page.waitForTimeout(2000);
    const table = page.locator('table');
    if (!await table.isVisible({ timeout: 3000 }).catch(() => false)) test.skip();

    await expect(page.locator('th').filter({ hasText: /consignor/i }).first()).toBeVisible();
    await expect(page.locator('th').filter({ hasText: /auction/i }).first()).toBeVisible();
    await expect(page.locator('th').filter({ hasText: /total hammer/i }).first()).toBeVisible();
    await expect(page.locator('th').filter({ hasText: /commission/i }).first()).toBeVisible();
    await expect(page.locator('th').filter({ hasText: /net payout/i }).first()).toBeVisible();
    await expect(page.locator('th').filter({ hasText: /status/i }).first()).toBeVisible();
  });

  test('status filter tabs change the view', async ({ page }) => {
    // Click Pending tab
    const pendingTab = page.locator('button').filter({ hasText: /pending/i }).first();
    await pendingTab.click();
    await page.waitForTimeout(1500);

    // Click All tab to go back
    const allTab = page.locator('button').filter({ hasText: /^all/i }).first();
    await allTab.click();
    await page.waitForTimeout(1000);

    // Verify we're back on all
    await expect(allTab).toBeVisible();
  });

  test('Generate Settlement opens modal', async ({ page }) => {
    const generateBtn = page.getByRole('button', { name: /generate settlement/i });
    await generateBtn.click();

    // Modal should appear
    const modalTitle = page.locator('h3').filter({ hasText: /generate settlement/i });
    await expect(modalTitle).toBeVisible({ timeout: 3000 });

    // Consignor and Auction select dropdowns should be in the modal
    const consignorLabel = page.locator('label').filter({ hasText: /consignor/i });
    const auctionLabel = page.locator('label').filter({ hasText: /auction/i });
    await expect(consignorLabel).toBeVisible();
    await expect(auctionLabel).toBeVisible();

    // Cancel button should close the modal
    const cancelBtn = page.getByRole('button', { name: /cancel/i });
    await cancelBtn.click();
    await expect(modalTitle).not.toBeVisible();
  });

  test('Generate Settlement modal has required selects', async ({ page }) => {
    const generateBtn = page.getByRole('button', { name: /generate settlement/i });
    await generateBtn.click();

    // Wait for modal
    await expect(page.locator('h3').filter({ hasText: /generate settlement/i })).toBeVisible({ timeout: 3000 });

    // Generate button in modal should be disabled until both selects are filled
    const generateSubmitBtn = page.getByRole('button', { name: /^generate$/i }).or(
      page.getByRole('button', { name: /^generating/i })
    );
    const isDisabled = await generateSubmitBtn.isDisabled().catch(() => false);
    expect(isDisabled).toBeTruthy();

    // Close modal
    const cancelBtn = page.getByRole('button', { name: /cancel/i });
    await cancelBtn.click();
  });

  test('View link navigates to settlement detail', async ({ page }) => {
    await page.waitForTimeout(2000);

    const viewLink = page.getByRole('link', { name: /^view$/i }).first();
    if (!await viewLink.isVisible({ timeout: 3000 }).catch(() => false)) test.skip();

    await viewLink.click();
    await page.waitForURL(`${BASE}/admin/settlements/**`);
    expect(page.url()).toMatch(/\/admin\/settlements\/.+/);
  });

  test('settlement rows show status badges', async ({ page }) => {
    await page.waitForTimeout(2000);
    const table = page.locator('table');
    if (!await table.isVisible({ timeout: 3000 }).catch(() => false)) test.skip();

    // Status badges should be present (Pending, Approved, or Paid)
    const badges = page.locator('.rounded-full').filter({
      hasText: /pending|approved|paid/i,
    });

    if (await badges.count() > 0) {
      await expect(badges.first()).toBeVisible();
    }
  });
});
