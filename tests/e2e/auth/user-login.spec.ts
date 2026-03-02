import { test, expect } from '@playwright/test';

// Use no stored auth state for auth tests
test.use({ storageState: { cookies: [], origins: [] } });

const BASE = '/omena';
const LOCALE = 'en';

test.describe('User login', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/${LOCALE}/login`);
    await page.waitForLoadState('networkidle');
  });

  test('login page renders email input and magic link button', async ({ page }) => {
    const emailField = page.locator('input[type="email"]').first();
    await expect(emailField).toBeVisible();

    // Primary action is "Send magic link"
    const magicLinkBtn = page.getByRole('button', { name: /send magic link/i });
    await expect(magicLinkBtn).toBeVisible();
  });

  test('password field is hidden by default (collapsible)', async ({ page }) => {
    // Password input should not be visible initially
    const passwordField = page.locator('input[type="password"]').first();
    const isVisible = await passwordField.isVisible({ timeout: 1000 }).catch(() => false);
    expect(isVisible).toBeFalsy();

    // Click toggle to show password
    const toggle = page.locator('button', { hasText: /sign in with password/i });
    await expect(toggle).toBeVisible();
    await toggle.click();

    // Now password should be visible
    await expect(passwordField).toBeVisible();
  });

  test('magic link button is disabled without email', async ({ page }) => {
    const magicLinkBtn = page.getByRole('button', { name: /send magic link/i });
    await expect(magicLinkBtn).toBeDisabled();
  });

  test('magic link request shows success message', async ({ page }) => {
    const emailField = page.locator('input[type="email"]').first();
    await emailField.fill('anyone@example.com');

    const magicLinkBtn = page.getByRole('button', { name: /send magic link/i });
    await magicLinkBtn.click();

    // Should show "Check your email" success screen
    await expect(page.getByText('Check your email')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('anyone@example.com')).toBeVisible();
  });

  test('"Use a different email" returns to form', async ({ page }) => {
    const emailField = page.locator('input[type="email"]').first();
    await emailField.fill('test@example.com');
    await page.getByRole('button', { name: /send magic link/i }).click();

    await expect(page.getByText('Check your email')).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: /different email/i }).click();
    await expect(page.locator('input[type="email"]').first()).toBeVisible();
  });

  test('password login: invalid credentials shows error', async ({ page }) => {
    // Expand password section
    await page.locator('button', { hasText: /sign in with password/i }).click();

    await page.locator('input[type="email"]').first().fill('invalid@example.com');
    await page.locator('input[type="password"]').first().fill('wrongpassword');
    await page.getByRole('button', { name: /sign in$/i }).click();

    // Wait for error message
    await page.waitForTimeout(2000);
    const errorText = page.locator('[class*="red"]').first();
    await expect(errorText).toBeVisible({ timeout: 5000 });
  });

  test('forgot password link navigates to reset page', async ({ page }) => {
    // Expand password section
    await page.locator('button', { hasText: /sign in with password/i }).click();

    const forgotLink = page.getByRole('link', { name: /forgot password/i });
    await expect(forgotLink).toBeVisible();
    await expect(forgotLink).toHaveAttribute('href', `/${LOCALE}/auth/reset-password`);
  });

  test('register link navigates to register page', async ({ page }) => {
    const registerLink = page.getByRole('link', { name: /register/i });
    await expect(registerLink).toBeVisible();
    await expect(registerLink).toHaveAttribute('href', `/${LOCALE}/register`);
  });
});
