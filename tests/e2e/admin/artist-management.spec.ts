import { test, expect } from '@playwright/test';

test.use({ storageState: 'tests/e2e/.auth/admin.json' });

const BASE = '/omena';

test.describe('Admin - Artist Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/admin/artists`);
    await page.waitForLoadState('networkidle');
  });

  test('artists page renders with heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /artists/i }).first()).toBeVisible();
  });

  test('New Artist button is visible', async ({ page }) => {
    const newBtn = page.getByRole('button', { name: /new artist/i });
    await expect(newBtn).toBeVisible();
  });

  test('artists table or empty state is displayed', async ({ page }) => {
    const table = page.locator('table');
    const emptyMsg = page.locator('text=/no artists found/i').first();

    const hasTable = await table.isVisible({ timeout: 3000 }).catch(() => false);
    const hasEmpty = await emptyMsg.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasTable || hasEmpty).toBeTruthy();
  });

  test('artists table shows correct columns', async ({ page }) => {
    const table = page.locator('table');
    if (!await table.isVisible({ timeout: 3000 }).catch(() => false)) test.skip();

    await expect(page.locator('th').filter({ hasText: /name/i }).first()).toBeVisible();
    await expect(page.locator('th').filter({ hasText: /nationality/i }).first()).toBeVisible();
    await expect(page.locator('th').filter({ hasText: /years/i }).first()).toBeVisible();
    await expect(page.locator('th').filter({ hasText: /lots/i }).first()).toBeVisible();
  });

  test('creates a new artist', async ({ page }) => {
    // Open the create form
    await page.getByRole('button', { name: /new artist/i }).click();

    // Wait for the form to appear
    await expect(page.getByRole('heading', { name: /new artist/i })).toBeVisible({ timeout: 5000 });

    // Fill name
    const nameInput = page.locator('input[placeholder="Artist full name"]').first();
    await expect(nameInput).toBeVisible({ timeout: 3000 });
    const uniqueName = `E2E Test Artist ${Date.now()}`;
    await nameInput.fill(uniqueName);

    // Slug should auto-generate
    const slugInput = page.locator('input[placeholder="url-friendly-slug"]').first();
    await expect(slugInput).toBeVisible();
    const slugValue = await slugInput.inputValue();
    expect(slugValue).toBeTruthy();

    // Fill nationality
    const nationalityInput = page.locator('input[placeholder*="Polish"]').first();
    if (await nationalityInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await nationalityInput.fill('Polish');
    }

    // Fill bio
    const bioTextarea = page.locator('textarea[placeholder*="biography"]').first();
    if (await bioTextarea.isVisible({ timeout: 2000 }).catch(() => false)) {
      await bioTextarea.fill('E2E test artist biography.');
    }

    // Submit form
    const createBtn = page.getByRole('button', { name: /create artist/i });
    await expect(createBtn).toBeVisible();
    await createBtn.click();

    // Should redirect to artist detail page
    await page.waitForTimeout(3000);
    expect(page.url()).toContain('/admin/artists/');
  });

  test('search filters artists', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Search by name"]').first();
    if (!await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) test.skip();

    await searchInput.fill('test');

    // Submit the search form
    const searchBtn = page.getByRole('button', { name: /search/i });
    if (await searchBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await searchBtn.click();
    }
    await page.waitForTimeout(1500);
    await expect(searchInput).toHaveValue('test');
  });

  test('clicking artist row navigates to detail page', async ({ page }) => {
    // Wait for table to load
    const emptyMsg = page.locator('text=/no artists found/i');
    if (await emptyMsg.isVisible({ timeout: 3000 }).catch(() => false)) test.skip();

    const row = page.locator('tbody tr').filter({ has: page.locator('.font-medium') }).first();
    if (!await row.isVisible({ timeout: 3000 }).catch(() => false)) test.skip();

    await row.click();
    await page.waitForURL(`${BASE}/admin/artists/**`);
    expect(page.url()).toMatch(/\/admin\/artists\/.+/);
  });

  test('artist detail page shows artist info and edit/delete buttons', async ({ page }) => {
    // Navigate to an existing artist
    const emptyMsg = page.locator('text=/no artists found/i');
    if (await emptyMsg.isVisible({ timeout: 3000 }).catch(() => false)) test.skip();

    const row = page.locator('tbody tr').filter({ has: page.locator('.font-medium') }).first();
    if (!await row.isVisible({ timeout: 3000 }).catch(() => false)) test.skip();

    await row.click();
    await page.waitForLoadState('networkidle');

    // Should show Artist Details section
    await expect(page.getByText('Artist Details').first()).toBeVisible({ timeout: 5000 });

    // Edit and Delete buttons should be present
    const editBtn = page.getByRole('button', { name: /^edit$/i });
    const deleteBtn = page.getByRole('button', { name: /^delete$/i });
    await expect(editBtn).toBeVisible();
    await expect(deleteBtn).toBeVisible();
  });

  test('edit artist details', async ({ page }) => {
    // Navigate to an existing artist
    const emptyMsg = page.locator('text=/no artists found/i');
    if (await emptyMsg.isVisible({ timeout: 3000 }).catch(() => false)) test.skip();

    const row = page.locator('tbody tr').filter({ has: page.locator('.font-medium') }).first();
    if (!await row.isVisible({ timeout: 3000 }).catch(() => false)) test.skip();

    await row.click();
    await page.waitForLoadState('networkidle');

    // Click edit
    const editBtn = page.getByRole('button', { name: /^edit$/i });
    await expect(editBtn).toBeVisible({ timeout: 5000 });
    await editBtn.click();

    // Edit mode should show form inputs
    const nameInput = page.locator('input').first();
    await expect(nameInput).toBeVisible({ timeout: 3000 });

    // Save and Cancel buttons should appear
    const saveBtn = page.getByRole('button', { name: /^save$/i });
    const cancelBtn = page.getByRole('button', { name: /^cancel$/i });
    await expect(saveBtn).toBeVisible();
    await expect(cancelBtn).toBeVisible();

    // Cancel edit mode
    await cancelBtn.click();

    // Should go back to view mode with Edit button visible again
    await expect(page.getByRole('button', { name: /^edit$/i })).toBeVisible();
  });

  test('delete artist shows confirm dialog', async ({ page }) => {
    // Navigate to an existing artist
    const emptyMsg = page.locator('text=/no artists found/i');
    if (await emptyMsg.isVisible({ timeout: 3000 }).catch(() => false)) test.skip();

    const row = page.locator('tbody tr').filter({ has: page.locator('.font-medium') }).first();
    if (!await row.isVisible({ timeout: 3000 }).catch(() => false)) test.skip();

    await row.click();
    await page.waitForLoadState('networkidle');

    // Click Delete
    const deleteBtn = page.getByRole('button', { name: /^delete$/i });
    await expect(deleteBtn).toBeVisible({ timeout: 5000 });
    await deleteBtn.click();

    // Confirm dialog should appear with the artist name
    const dialog = page.locator('[role="dialog"]').or(page.locator('text=/are you sure/i').first());
    await expect(dialog).toBeVisible({ timeout: 3000 });

    // Cancel button should be in the dialog
    const cancelBtn = page.getByRole('button', { name: /cancel/i });
    if (await cancelBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await cancelBtn.click();
    }
  });

  test('cancel button closes the create form', async ({ page }) => {
    // Open the create form
    await page.getByRole('button', { name: /new artist/i }).click();
    await expect(page.getByRole('heading', { name: /new artist/i })).toBeVisible({ timeout: 3000 });

    // Click Cancel
    const cancelBtn = page.getByRole('button', { name: /^cancel$/i });
    await cancelBtn.click();

    // Form should disappear
    await expect(page.getByRole('heading', { name: /new artist/i })).not.toBeVisible();
  });

  test('pagination controls appear when there are many artists', async ({ page }) => {
    // Pagination should be visible if totalPages > 1
    const paginationInfo = page.locator('text=/page \\d+ of \\d+/i');
    const prevBtn = page.getByRole('button', { name: /previous/i });
    const nextBtn = page.getByRole('button', { name: /next/i });

    const hasPagination = await paginationInfo.isVisible({ timeout: 3000 }).catch(() => false);
    if (hasPagination) {
      // At least one navigation button should be visible
      const hasPrev = await prevBtn.isVisible({ timeout: 1000 }).catch(() => false);
      const hasNext = await nextBtn.isVisible({ timeout: 1000 }).catch(() => false);
      expect(hasPrev || hasNext).toBeTruthy();
    }
    // If no pagination, that's fine too (fewer than 50 artists)
  });
});
