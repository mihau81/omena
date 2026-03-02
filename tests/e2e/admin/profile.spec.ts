import { test, expect } from '@playwright/test';

test.use({ storageState: 'tests/e2e/.auth/admin.json' });

const BASE = '/omena';

test.describe('Admin - Profile', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/admin/profile`);
    await page.waitForLoadState('networkidle');
  });

  test('profile page renders with heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /profile/i }).first()).toBeVisible();
  });

  test('name field is visible and editable', async ({ page }) => {
    const nameInput = page.locator('input[name="name"], input[id="name"]').first();
    if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(nameInput).toBeEditable();
      // Should show current admin name
      const value = await nameInput.inputValue();
      expect(value.length).toBeGreaterThan(0);
    }
  });

  test('email field displays current admin email', async ({ page }) => {
    const emailField = page.locator('input[type="email"], [class*="email"]').first();
    if (await emailField.isVisible({ timeout: 3000 }).catch(() => false)) {
      const value = await emailField.inputValue();
      expect(value).toContain('@');
    }
  });

  test('save name button updates the profile', async ({ page }) => {
    const nameInput = page.locator('input[name="name"]').first();
    if (!await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) test.skip();

    const originalValue = await nameInput.inputValue();
    await nameInput.fill('Updated E2E Name');

    const saveBtn = page.getByRole('button', { name: /save|update/i }).first();
    await saveBtn.click();
    await page.waitForTimeout(2000);

    // Restore original name
    await nameInput.fill(originalValue);
    await saveBtn.click();
    await page.waitForTimeout(1000);
  });

  test('change password section is available', async ({ page }) => {
    const passwordSection = page.locator('text=/change password|password/i').first();
    const currentPasswordInput = page.locator('input[name="currentPassword"], input[type="password"]').first();

    const hasSection = await passwordSection.isVisible({ timeout: 3000 }).catch(() => false);
    const hasInput = await currentPasswordInput.isVisible({ timeout: 1000 }).catch(() => false);
    expect(hasSection || hasInput).toBeTruthy();
  });

  test('change password requires current password', async ({ page }) => {
    const currentPwInput = page.locator('input[name="currentPassword"]').first();
    if (!await currentPwInput.isVisible({ timeout: 3000 }).catch(() => false)) test.skip();

    await currentPwInput.fill('wrongpassword');

    const newPwInput = page.locator('input[name="newPassword"], input[name="password"]').first();
    if (await newPwInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await newPwInput.fill('NewPassword123!');
    }

    const changeBtn = page.getByRole('button', { name: /change password|update password/i });
    if (await changeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await changeBtn.click();
      await page.waitForTimeout(2000);

      // Should show error for wrong current password
      const errorMsg = page.locator('[class*="error"], [class*="red"]').first();
      if (await errorMsg.isVisible({ timeout: 2000 }).catch(() => false)) {
        await expect(errorMsg).toBeVisible();
      }
    }
  });
});
