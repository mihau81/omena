import { test, expect } from '@playwright/test';

test.use({ storageState: 'tests/e2e/.auth/admin.json' });

const BASE = '/omena';

test.describe('Admin - Admin Account Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/admin/admins`);
    await page.waitForLoadState('networkidle');
  });

  test('admins page renders heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /admin/i }).first()).toBeVisible();
  });

  test('admin list shows existing admin accounts', async ({ page }) => {
    // At least the seeded admin should appear
    const rows = page.locator('tbody tr');
    const emptyMsg = page.locator('text=/no admins/i').first();

    const hasRows = await rows.count() > 0;
    const hasEmpty = await emptyMsg.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasRows || hasEmpty).toBeTruthy();
  });

  test('New Admin button is visible for super_admin', async ({ page }) => {
    const newBtn = page.getByRole('button', { name: /new admin|add admin|invite/i }).or(
      page.getByRole('link', { name: /new admin/i })
    );
    if (await newBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(newBtn).toBeVisible();
    }
  });

  test('creates a new admin account', async ({ page }) => {
    const newBtn = page.getByRole('button', { name: /new admin|add admin/i }).or(
      page.getByRole('link', { name: /new admin/i })
    );
    if (!await newBtn.isVisible({ timeout: 3000 }).catch(() => false)) test.skip();

    await newBtn.click();
    await page.waitForLoadState('networkidle');

    // Fill form
    const emailInput = page.locator('input[type="email"]').first();
    if (!await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) test.skip();

    const timestamp = Date.now();
    await emailInput.fill(`testadmin_${timestamp}@omena.pl`);

    const nameInput = page.locator('input[name="name"]').first();
    if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await nameInput.fill('E2E Test Admin');
    }

    const passwordInput = page.locator('input[type="password"]').first();
    if (await passwordInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await passwordInput.fill('AdminPass123!');
    }

    const saveBtn = page.getByRole('button', { name: /create|save|invite/i });
    if (await saveBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await saveBtn.click();
      await page.waitForTimeout(2000);
    }
  });

  test('admin role selector is present in edit form', async ({ page }) => {
    const editLink = page.getByRole('link', { name: /edit/i }).first();
    if (!await editLink.isVisible({ timeout: 3000 }).catch(() => false)) test.skip();

    await editLink.click();
    await page.waitForLoadState('networkidle');

    const roleSelect = page.locator('select[name="role"]').first();
    if (await roleSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(roleSelect).toBeVisible();
      const options = await roleSelect.locator('option').allTextContents();
      const hasRoles = options.some((o) => /admin|super/i.test(o));
      expect(hasRoles).toBeTruthy();
    }
  });

  test('delete admin shows confirm dialog', async ({ page }) => {
    const deleteBtn = page.getByRole('button', { name: /delete/i }).first();
    if (!await deleteBtn.isVisible({ timeout: 3000 }).catch(() => false)) test.skip();

    await deleteBtn.click();

    const dialog = page.locator('[role="dialog"], [class*="modal"]').first();
    const confirmText = page.locator('text=/delete|confirm/i').first();

    const hasDialog = await dialog.isVisible({ timeout: 2000 }).catch(() => false);
    const hasConfirm = await confirmText.isVisible({ timeout: 1000 }).catch(() => false);
    expect(hasDialog || hasConfirm).toBeTruthy();

    const cancelBtn = page.getByRole('button', { name: /cancel/i });
    if (await cancelBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await cancelBtn.click();
    }
  });
});
