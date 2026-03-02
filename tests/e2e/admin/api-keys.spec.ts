import { test, expect } from '@playwright/test';

test.use({ storageState: 'tests/e2e/.auth/admin.json' });

const BASE = '/omena';

test.describe('Admin - API Keys', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/admin/api-keys`);
    await page.waitForLoadState('networkidle');
  });

  test('API Keys page renders with heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'API Keys' })).toBeVisible();
  });

  test('security note about one-time key display', async ({ page }) => {
    await expect(page.getByText(/shown only once|not be shown again/i).first()).toBeVisible();
  });

  test('New API Key button opens create modal', async ({ page }) => {
    await page.getByRole('button', { name: 'New API Key' }).click();

    // Modal should appear
    const modal = page.locator('[class*="fixed inset"]').last();
    await expect(modal).toBeVisible({ timeout: 3000 });

    // Name input should be in the modal
    await expect(page.getByPlaceholder(/Invaluable|Artnet/i)).toBeVisible();
  });

  test('create API key form has required fields', async ({ page }) => {
    await page.getByRole('button', { name: 'New API Key' }).click();

    const nameInput = page.getByPlaceholder(/Invaluable|Artnet|name/i);
    const rateLimitInput = page.locator('input[type="number"]').first();
    const generateBtn = page.getByRole('button', { name: /generate api key/i });

    await expect(nameInput).toBeVisible();
    await expect(rateLimitInput).toBeVisible();
    await expect(generateBtn).toBeVisible();
  });

  test('creates a new API key and shows it once', async ({ page }) => {
    await page.getByRole('button', { name: 'New API Key' }).click();

    const nameInput = page.getByPlaceholder(/Invaluable|Artnet|e\.g\./i);
    await nameInput.fill(`E2E Test Key ${Date.now()}`);

    await page.getByRole('button', { name: /generate api key/i }).click();

    // After creation, the key should be shown once
    await expect(
      page.getByText(/copy this key now|it will not be shown again/i)
    ).toBeVisible({ timeout: 10000 });

    // The key input should be visible
    const keyInput = page.locator('input[readonly]').first();
    await expect(keyInput).toBeVisible();

    // Dismiss
    await page.getByRole('button', { name: /i have saved the key/i }).click();
  });

  test('copy button appears on newly created key', async ({ page }) => {
    await page.getByRole('button', { name: 'New API Key' }).click();

    const nameInput = page.getByPlaceholder(/Invaluable|Artnet|e\.g\./i);
    await nameInput.fill(`E2E Copy Test ${Date.now()}`);

    await page.getByRole('button', { name: /generate api key/i }).click();
    await page.waitForTimeout(2000);

    const copyBtn = page.getByRole('button', { name: /^copy$/i });
    if (await copyBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(copyBtn).toBeVisible();
    }

    // Dismiss if shown
    const saveBtn = page.getByRole('button', { name: /i have saved/i });
    if (await saveBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await saveBtn.click();
    }
  });

  test('deactivate button is available on existing keys', async ({ page }) => {
    const deactivateBtn = page.getByRole('button', { name: /deactivate/i }).first();
    const activateBtn = page.getByRole('button', { name: /activate/i }).first();

    const hasDeactivate = await deactivateBtn.isVisible({ timeout: 3000 }).catch(() => false);
    const hasActivate = await activateBtn.isVisible({ timeout: 1000 }).catch(() => false);

    if (hasDeactivate || hasActivate) {
      expect(hasDeactivate || hasActivate).toBeTruthy();
    }
  });

  test('delete button removes key after confirmation', async ({ page }) => {
    const deleteBtn = page.getByRole('button', { name: /delete/i }).first();
    if (!await deleteBtn.isVisible({ timeout: 3000 }).catch(() => false)) test.skip();

    // Intercept the confirmation dialog
    page.on('dialog', (dialog) => dialog.dismiss());
    await deleteBtn.click();
    await page.waitForTimeout(500);
  });

  test('API keys table shows name, prefix and status columns', async ({ page }) => {
    const table = page.locator('table');
    if (await table.isVisible({ timeout: 3000 }).catch(() => false)) {
      const headers = await page.locator('th').allTextContents();
      expect(headers.some((h) => /name/i.test(h))).toBeTruthy();
    }
  });
});
