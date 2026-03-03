import { test, expect } from '@playwright/test';

test.use({ storageState: { cookies: [], origins: [] } });

const BASE = '/omenaa';
const LOCALE = 'en';

test.describe('Password reset flow', () => {
  test.describe('Request form (no token)', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`${BASE}/${LOCALE}/auth/reset-password`);
      await page.waitForLoadState('networkidle');
    });

    test('renders reset password request form', async ({ page }) => {
      await expect(page.getByText('Reset your password')).toBeVisible();
      await expect(page.locator('#reset-email')).toBeVisible();
      await expect(page.getByRole('button', { name: /send reset link/i })).toBeVisible();
    });

    test('submitting shows success message', async ({ page }) => {
      await page.locator('#reset-email').fill('anyone@example.com');
      await page.getByRole('button', { name: /send reset link/i }).click();

      await expect(page.getByText('Check your email')).toBeVisible({ timeout: 5000 });
      await expect(page.getByText(/password reset link/i)).toBeVisible();
    });

    test('back to login link works', async ({ page }) => {
      const backLink = page.getByRole('link', { name: /back to login/i });
      await expect(backLink).toBeVisible();
      await expect(backLink).toHaveAttribute('href', `/${LOCALE}/login`);
    });
  });

  test.describe('Reset form (with token)', () => {
    test('renders new password form when token is present', async ({ page }) => {
      await page.goto(`${BASE}/${LOCALE}/auth/reset-password?token=test-token`);
      await page.waitForLoadState('networkidle');

      await expect(page.getByText('Set your new password')).toBeVisible();
      await expect(page.locator('#new-password')).toBeVisible();
      await expect(page.locator('#confirm-password')).toBeVisible();
      await expect(page.getByRole('button', { name: /reset password/i })).toBeVisible();
    });

    test('shows error for mismatched passwords', async ({ page }) => {
      await page.goto(`${BASE}/${LOCALE}/auth/reset-password?token=test-token`);
      await page.waitForLoadState('networkidle');

      await page.locator('#new-password').fill('NewPassword123!');
      await page.locator('#confirm-password').fill('DifferentPassword123!');
      await page.getByRole('button', { name: /reset password/i }).click();

      await expect(page.getByText(/do not match/i)).toBeVisible({ timeout: 3000 });
    });

    test('shows error for invalid/expired token', async ({ page }) => {
      await page.goto(`${BASE}/${LOCALE}/auth/reset-password?token=invalid-token`);
      await page.waitForLoadState('networkidle');

      await page.locator('#new-password').fill('NewPassword123!');
      await page.locator('#confirm-password').fill('NewPassword123!');
      await page.getByRole('button', { name: /reset password/i }).click();

      await page.waitForTimeout(3000);
      const body = await page.textContent('body');
      expect(body).toMatch(/invalid|expired|used|error/i);
    });
  });
});
