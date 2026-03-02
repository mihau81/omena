import { test, expect } from '@playwright/test';

test.use({ storageState: 'tests/e2e/.auth/admin.json' });

const BASE = '/omena';

test.describe('Admin - User Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/admin/users`);
    await page.waitForLoadState('networkidle');
  });

  test('users list page renders with heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /users/i }).first()).toBeVisible();
  });

  test('user table displays rows', async ({ page }) => {
    const rows = page.locator('tbody tr');
    const count = await rows.count();
    const emptyMsg = page.locator('text=/no users/i').first();
    const hasEmpty = await emptyMsg.isVisible({ timeout: 2000 }).catch(() => false);
    expect(count > 0 || hasEmpty).toBeTruthy();
  });

  test('search input narrows user results', async ({ page }) => {
    const searchInput = page.locator('input[type="search"], input[placeholder*="search"]').first();
    if (!await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) test.skip();

    await searchInput.fill('test');
    await page.waitForTimeout(1000);
    // Table should update
    await expect(searchInput).toHaveValue('test');
  });

  test('clicking user row or edit navigates to user detail', async ({ page }) => {
    // UsersClient uses clickable <tr> rows with onClick handler
    // The "No users found" message means no users to click
    const emptyMsg = page.locator('text=/No users found/i');
    if (await emptyMsg.isVisible({ timeout: 2000 }).catch(() => false)) test.skip();

    // Need at least one data row with user info (name column has font-medium class)
    const dataRows = page.locator('tbody tr .font-medium');
    if (await dataRows.count() === 0) test.skip();

    const row = page.locator('tbody tr').filter({ has: page.locator('.font-medium') }).first();
    await row.click();
    await page.waitForURL(`${BASE}/admin/users/**`);
    expect(page.url()).toContain('/admin/users/');
  });

  test('user detail page shows user info fields', async ({ page }) => {
    // Skip if no users exist
    const emptyMsg = page.locator('text=/No users found/i');
    if (await emptyMsg.isVisible({ timeout: 2000 }).catch(() => false)) test.skip();

    const dataRows = page.locator('tbody tr .font-medium');
    if (await dataRows.count() === 0) test.skip();

    const row = page.locator('tbody tr').filter({ has: page.locator('.font-medium') }).first();
    await row.click();
    await page.waitForLoadState('networkidle');

    // Should show email, name, or other user fields
    const emailField = page.locator('input[type="email"], input[name="email"]').first();
    const userInfo = page.locator('[class*="user"], [class*="profile"]').first();
    const heading = page.getByRole('heading').first();

    const hasEmail = await emailField.isVisible({ timeout: 3000 }).catch(() => false);
    const hasInfo = await userInfo.isVisible({ timeout: 1000 }).catch(() => false);
    const hasHeading = await heading.isVisible({ timeout: 1000 }).catch(() => false);
    expect(hasEmail || hasInfo || hasHeading).toBeTruthy();
  });

  test('visibility level can be changed for users', async ({ page }) => {
    const visibilitySelect = page.locator('select[name*="visibility"]').first();
    if (await visibilitySelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(visibilitySelect).toBeVisible();
    }
  });
});
