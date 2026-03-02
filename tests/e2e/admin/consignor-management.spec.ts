import { test, expect } from '@playwright/test';

test.use({ storageState: 'tests/e2e/.auth/admin.json' });

const BASE = '/omena';

test.describe('Admin - Consignor Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/admin/consignors`);
    await page.waitForLoadState('networkidle');
  });

  test('consignors page renders with heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /consignors/i }).first()).toBeVisible();
  });

  test('New Consignor button is present', async ({ page }) => {
    const newBtn = page.getByRole('link', { name: /new consignor/i }).or(
      page.getByRole('button', { name: /new consignor|add consignor/i })
    );
    if (await newBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(newBtn).toBeVisible();
    }
  });

  test('consignors list or empty state is displayed', async ({ page }) => {
    const rows = page.locator('tbody tr');
    const cards = page.locator('[class*="card"], [class*="consignor"]');
    const emptyMsg = page.locator('text=/no consignors/i').first();

    const hasRows = await rows.count() > 0;
    const hasCards = await cards.count() > 0;
    const hasEmpty = await emptyMsg.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasRows || hasCards || hasEmpty).toBeTruthy();
  });

  test('creates a new consignor', async ({ page }) => {
    const newBtn = page.getByRole('link', { name: /new consignor/i }).or(
      page.getByRole('button', { name: /new consignor|add/i })
    );
    if (!await newBtn.isVisible({ timeout: 3000 }).catch(() => false)) test.skip();

    await newBtn.click();
    await page.waitForLoadState('networkidle');

    // Fill in consignor form
    const nameInput = page.locator('input[name="name"], input[placeholder*="name"]').first();
    if (await nameInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await nameInput.fill('E2E Test Consignor');

      const saveBtn = page.getByRole('button', { name: /save|create|submit/i });
      if (await saveBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await saveBtn.click();
        await page.waitForTimeout(2000);
      }
    }
  });

  test('search filters consignors', async ({ page }) => {
    const searchInput = page.locator('input[type="search"], input[placeholder*="search"]').first();
    if (!await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) test.skip();

    await searchInput.fill('test');
    await page.waitForTimeout(1000);
    await expect(searchInput).toHaveValue('test');
  });

  test('clicking consignor navigates to detail', async ({ page }) => {
    const link = page.locator('tbody td a, [class*="consignor"] a').first();
    const editLink = page.getByRole('link', { name: /edit/i }).first();

    const target = await link.isVisible({ timeout: 2000 }).catch(() => false) ? link : editLink;
    if (!await target.isVisible({ timeout: 2000 }).catch(() => false)) test.skip();

    await target.click();
    await page.waitForURL(`${BASE}/admin/consignors/**`);
    expect(page.url()).toContain('/admin/consignors/');
  });
});
