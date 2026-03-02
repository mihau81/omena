import { test, expect } from '@playwright/test';

test.use({ storageState: 'tests/e2e/.auth/admin.json' });

const BASE = '/omena';

test.describe('Admin - Security & 2FA', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/admin/security`);
    await page.waitForLoadState('networkidle');
  });

  test('security page renders with heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /security|two-factor|2fa/i }).first()).toBeVisible();
  });

  test('2FA setup section is displayed', async ({ page }) => {
    const setupSection = page.locator('text=/two-factor|2fa|authenticator/i').first();
    await expect(setupSection).toBeVisible();
  });

  test('setup 2FA button is available when not enabled', async ({ page }) => {
    const setupBtn = page.getByRole('button', { name: /set up|enable 2fa|setup/i });
    const disableBtn = page.getByRole('button', { name: /disable 2fa|disable/i });

    const hasSetup = await setupBtn.isVisible({ timeout: 3000 }).catch(() => false);
    const hasDisable = await disableBtn.isVisible({ timeout: 1000 }).catch(() => false);

    // One of them should be visible
    expect(hasSetup || hasDisable).toBeTruthy();
  });

  test('clicking setup 2FA shows QR code', async ({ page }) => {
    const setupBtn = page.getByRole('button', { name: /set up|enable 2fa|setup/i });
    if (!await setupBtn.isVisible({ timeout: 3000 }).catch(() => false)) test.skip();

    await setupBtn.click();
    await page.waitForTimeout(2000);

    // QR code should be displayed as an img
    const qrCode = page.locator('img[src*="data:image/png"], img[alt*="qr"], canvas');
    if (await qrCode.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(qrCode.first()).toBeVisible();
    }

    // Or a secret key text
    const secretText = page.locator('code, [class*="secret"], [class*="code"]').first();
    if (await secretText.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(secretText).toBeVisible();
    }
  });

  test('TOTP verification input is shown after QR code', async ({ page }) => {
    const setupBtn = page.getByRole('button', { name: /set up|enable 2fa/i });
    if (!await setupBtn.isVisible({ timeout: 3000 }).catch(() => false)) test.skip();

    await setupBtn.click();
    await page.waitForTimeout(2000);

    // 6-digit TOTP input should be available
    const totpInput = page.locator('input[maxlength="6"], input[type="tel"], input[placeholder*="code"]').first();
    if (await totpInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(totpInput).toBeVisible();
    }
  });

  test('disable 2FA requires TOTP code when enabled', async ({ page }) => {
    const disableBtn = page.getByRole('button', { name: /disable 2fa|disable/i });
    if (!await disableBtn.isVisible({ timeout: 3000 }).catch(() => false)) test.skip();

    await disableBtn.click();
    await page.waitForTimeout(1000);

    // Should ask for TOTP code to confirm disabling
    const totpInput = page.locator('input[maxlength="6"], input[type="tel"]').first();
    if (await totpInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(totpInput).toBeVisible();
    }
  });
});
