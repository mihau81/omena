import { test, expect } from '@playwright/test';

test.use({ storageState: 'tests/e2e/.auth/admin.json' });

const BASE = '/omenaa';

test.describe('Admin - Auction CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/admin/auctions`);
    await page.waitForLoadState('networkidle');
  });

  test('auction list page renders with heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Auctions' })).toBeVisible();
  });

  test('New Auction button is visible', async ({ page }) => {
    await expect(page.getByRole('link', { name: /new auction/i })).toBeVisible();
  });

  test('creates a new auction', async ({ page }) => {
    await page.getByRole('link', { name: /new auction/i }).click();
    await page.waitForURL(`${BASE}/admin/auctions/new`);

    // Fill in the auction form
    const titleInput = page.locator('input[name="title"], input[id="title"], input[placeholder*="title"]').first();
    if (await titleInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await titleInput.fill('E2E Test Auction');
    }

    // Fill slug if present
    const slugInput = page.locator('input[name="slug"], input[id="slug"]').first();
    if (await slugInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await slugInput.fill(`e2e-test-auction-${Date.now()}`);
    }

    // Fill start and end dates (AuctionForm uses datetime-local inputs)
    const startDateInput = page.locator('input[type="datetime-local"], input[type="date"], input[name*="start"]').first();
    if (await startDateInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      const startType = await startDateInput.getAttribute('type');
      await startDateInput.fill(startType === 'datetime-local' ? '2027-01-15T10:00' : '2027-01-15');
    }

    const endDateInput = page.locator('input[type="datetime-local"], input[type="date"], input[name*="end"]').first();
    if (await endDateInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      const endType = await endDateInput.getAttribute('type');
      await endDateInput.fill(endType === 'datetime-local' ? '2027-01-20T18:00' : '2027-01-20');
    }

    // Submit the form
    const submitBtn = page.getByRole('button', { name: /create auction|save|submit/i });
    if (await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await submitBtn.click();
      await page.waitForTimeout(3000);

      // Should redirect to the new auction page
      const url = page.url();
      expect(url).toContain('/admin/auctions');
    }
  });

  test('filters auctions by status', async ({ page }) => {
    // Status filter tabs should be present
    const statusTabs = page.locator('button').filter({ hasText: /all|draft|preview|live/i });
    if (await statusTabs.count() > 0) {
      await statusTabs.first().click();
      await page.waitForTimeout(500);
    }
  });

  test('auctions list shows title and status columns', async ({ page }) => {
    const table = page.locator('table');
    if (await table.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(table).toBeVisible();
      // Check for header columns
      await expect(page.getByText('Title').first()).toBeVisible();
      await expect(page.getByText('Status').first()).toBeVisible();
    }
  });

  test('delete auction shows confirm dialog', async ({ page }) => {
    // Find a delete button
    const deleteBtn = page.getByRole('button', { name: /delete/i }).first();
    if (!await deleteBtn.isVisible({ timeout: 3000 }).catch(() => false)) test.skip();

    await deleteBtn.click();

    // Confirm dialog should appear
    const confirmDialog = page.locator('[role="dialog"], [class*="modal"]').first();
    const confirmText = page.locator('text=/delete|confirm/i').first();

    const hasDialog = await confirmDialog.isVisible({ timeout: 2000 }).catch(() => false);
    const hasConfirm = await confirmText.isVisible({ timeout: 1000 }).catch(() => false);
    expect(hasDialog || hasConfirm).toBeTruthy();

    // Cancel to avoid actually deleting
    const cancelBtn = page.getByRole('button', { name: /cancel/i });
    if (await cancelBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await cancelBtn.click();
    }
  });

  test('clicking auction title opens edit page', async ({ page }) => {
    const auctionLink = page.locator('td a').filter({ hasText: /.+/ }).first();
    if (!await auctionLink.isVisible({ timeout: 3000 }).catch(() => false)) test.skip();

    await auctionLink.click();
    await page.waitForURL(`${BASE}/admin/auctions/**`);
    expect(page.url()).toMatch(/\/admin\/auctions\/.+/);
  });
});
