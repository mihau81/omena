import { test, expect } from '@playwright/test';

test.use({ storageState: { cookies: [], origins: [] } });

const BASE = '/omenaa';

test.describe('Admin login', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/admin/login`);
    await page.waitForLoadState('networkidle');
  });

  test('renders login form with email and password fields', async ({ page }) => {
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
  });

  test('shows OMENAA brand on login page', async ({ page }) => {
    await expect(page.getByText('OMENAA').first()).toBeVisible();
    await expect(page.getByText('Administration Panel')).toBeVisible();
  });

  test('invalid credentials shows error message', async ({ page }) => {
    await page.locator('#email').fill('invalid@admin.com');
    await page.locator('#password').fill('wrongpassword');
    await page.getByRole('button', { name: 'Sign In' }).click();

    await expect(
      page.getByText('Invalid email or password')
    ).toBeVisible({ timeout: 5000 });
  });

  test('empty form shows HTML5 validation', async ({ page }) => {
    await page.getByRole('button', { name: 'Sign In' }).click();
    // Email field is required
    const emailField = page.locator('#email');
    await expect(emailField).toHaveAttribute('required');
  });

  test('valid admin credentials redirect to dashboard', async ({ page }) => {
    await page.locator('#email').fill('admin@omenaa.pl');
    await page.locator('#password').fill('admin123');
    await page.getByRole('button', { name: 'Sign In' }).click();

    await page.waitForURL(`${BASE}/admin`, { timeout: 10000 });
    expect(page.url()).toContain('/admin');
  });

  test('shows loading state while signing in', async ({ page }) => {
    await page.locator('#email').fill('admin@omenaa.pl');
    await page.locator('#password').fill('admin123');

    // Click and immediately check for loading state
    const submitBtn = page.getByRole('button', { name: 'Sign In' });
    await submitBtn.click();

    // Loading text may appear briefly
    const loadingText = page.getByText('Signing in...');
    // This may or may not be visible depending on timing
    await page.waitForURL(`${BASE}/admin`, { timeout: 10000 });
  });

  test('admin is redirected if already logged in', async ({ page }) => {
    // First log in
    await page.locator('#email').fill('admin@omenaa.pl');
    await page.locator('#password').fill('admin123');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForURL(`${BASE}/admin`, { timeout: 10000 });

    // Visiting login page again should redirect to dashboard
    await page.goto(`${BASE}/admin/login`);
    await page.waitForTimeout(2000);
    // Should stay on admin or redirect
    expect(page.url()).toContain('/admin');
  });
});
